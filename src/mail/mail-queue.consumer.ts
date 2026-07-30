import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, UnrecoverableError } from 'bullmq';
import { In, Repository } from 'typeorm';
import { CampaignEmailLog } from '../entity/campaign-email-log.entity';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { GmailAuthService } from './gmail-auth.service';
import { MAIL_QUEUE, SendEmailJobPayload } from './mail-queue.types';
import { MailService } from './mail.service';
import { gmail } from '@googleapis/gmail';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationType } from 'src/entity/enums';
import { downloadFileFromCloud } from 'src/utils/common/handle';
import { GMAIL_SIMPLE_UPLOAD_LIMIT } from 'src/utils/common/constant';

@Processor(MAIL_QUEUE, {
  concurrency: 5, // process 5 emails in parallel per worker
})
export class MailQueueConsumer extends WorkerHost {
  private readonly logger = new Logger(MailQueueConsumer.name);

  constructor(
    private readonly mailService: MailService,
    private readonly gmailAuthService: GmailAuthService,
    @InjectRepository(CampaignEmailLog)
    private readonly emailLogRepository: Repository<CampaignEmailLog>,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly eventEmitter: EventEmitter2,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<SendEmailJobPayload>): Promise<void> {
    const payload = job.data;
    this.logger.log(`Processing email job ${job.id} → ${payload.to.join(',')}`);

    // 1. Guard: nếu log đã bị set 'pending' (do auth fail trước đó), bỏ qua ngay
    const existingLog = await this.emailLogRepository.findOne({
      where: { id: payload.emailLogId },
      select: ['id', 'status'],
    });
    if (existingLog?.status === 'pending') {
      this.logger.warn(
        `[${payload.campaignId}] Skipping job ${job.id} — log is pending (auth unavailable)`,
      );
      return;
    }

    // 2. Update log status to SENDING
    await this.emailLogRepository.update(payload.emailLogId, {
      status: 'sending',
    });

    // 3. Get OAuth2 client with valid token
    let oauth2Client;
    try {
      oauth2Client = await this.gmailAuthService.getOAuth2Client(
        payload.userId,
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.notificationsGateway.sendToUser(payload.userId, NotificationType.CAMPAIGN_FAILED, {
          campaignId: payload.campaignId,
          message: 'Google Token expired. Please reconnect.',
        });

        if (payload.campaignId) {
          // Đặt tất cả email logs còn đang 'queued' / 'sending' của campaign → 'pending'
          // để các job còn lại không bị xử lý lãng phí khi biết chắc token không hợp lệ
          await this.emailLogRepository.update(
            {
              campaignId: payload.campaignId,
              status: In(['queued', 'sending']),
            },
            { status: 'pending' },
          );
          this.logger.warn(
            `[${payload.campaignId}] Auth failed — remaining queued jobs set to pending`,
          );

          this.eventEmitter.emit('campaign.pause', {
            campaignId: payload.campaignId,
          });
          this.notificationsService.createNotification({
            userId: payload.userId,
            type: NotificationType.CAMPAIGN_FAILED,
            title: 'Campaign Paused',
            message: `Your Google Token expired. Please reconnect.`,
            metadata: { campaignId: payload.campaignId },
          });
        }
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }

    // 4. Download attachments from S3 if present
    let emailAttachments: { filename: string; content: Buffer; contentType: string }[] | undefined;
    if (payload.attachments?.length) {
      emailAttachments = await Promise.all(
        payload.attachments.map(async (att) => ({
          filename: att.fileName,
          content: await downloadFileFromCloud(att.filePath, att.fileName),
          contentType: att.mimeType,
        })),
      );
    }

    // 5. Build raw MIME message
    const raw = this.mailService.buildRawEmail({
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      headers: payload.headers,
      unsubscribeUrl: payload.unsubscribeUrl,
      attachments: emailAttachments,
    });

    // 6. Send via Gmail API — use media upload for large messages (> 5 MB)
    const mail = gmail({ version: 'v1', auth: oauth2Client });
    const rawBuffer = Buffer.from(raw, 'base64url');
    let response;

    if (rawBuffer.length > GMAIL_SIMPLE_UPLOAD_LIMIT) {
      // Resumable/media upload for messages with large attachments
      response = await mail.users.messages.send({
        userId: 'me',
        uploadType: 'media',
        media: {
          mimeType: 'message/rfc822',
          body: rawBuffer,
        },
      } as any);
    } else {
      response = await mail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      });
    }

    const gmailMessageId = response.data.id;
    const now = new Date();

    // 7. Update email log → SENT
    await this.emailLogRepository
      .createQueryBuilder()
      .update(CampaignEmailLog)
      .set({
        status: 'sent',
        metadata: () => "COALESCE(metadata, '{}'::jsonb) || :newMetadata::jsonb",
      })
      .setParameter('newMetadata', JSON.stringify({ gmailMessageId, sentAt: now.toISOString() }))
      .where('id = :id', { id: payload.emailLogId })
      .execute();

    // 8. Emit email.sent event
    this.eventEmitter.emit('email.sent', { payload, gmailMessageId });

    this.logger.log(
      `✅ Email ${job.id} sent — gmailMessageId=${gmailMessageId}`,
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<SendEmailJobPayload>, error: Error): Promise<void> {
    const payload = job.data;
    const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 3);

    this.logger.error(
      `❌ Email job ${job.id} failed (attempt ${job.attemptsMade}): ${error.message}`,
    );

    if (isLastAttempt) {
      // Max retries reached → mark as FAILED
      await this.emailLogRepository
        .createQueryBuilder()
        .update(CampaignEmailLog)
        .set({
          status: 'failed',
          metadata: () => "COALESCE(metadata, '{}'::jsonb) || :newMetadata::jsonb",
        })
        .setParameter('newMetadata', JSON.stringify({
          error: error.message,
          failedAt: new Date().toISOString(),
        }))
        .where('id = :id', { id: payload.emailLogId })
        .execute();

      this.eventEmitter.emit('email.failed', { payload, error });
    }
  }
}
