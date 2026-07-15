import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, UnrecoverableError } from 'bullmq';
import { Repository } from 'typeorm';
import { CampaignEmailLog } from '../entity/campaign-email-log.entity';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { GmailAuthService } from './gmail-auth.service';
import { MAIL_QUEUE, SendEmailJobPayload } from './mail-queue.types';
import { MailService } from './mail.service';
import { gmail } from '@googleapis/gmail';

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
  ) {
    super();
  }

  async process(job: Job<SendEmailJobPayload>): Promise<void> {
    const payload = job.data;
    this.logger.log(`Processing email job ${job.id} → ${payload.to.join(',')}`);

    // 1. Update log status to SENDING
    await this.emailLogRepository.update(payload.emailLogId, {
      status: 'sending',
    });

    // 2. Get OAuth2 client with valid token
    let oauth2Client;
    try {
      oauth2Client = await this.gmailAuthService.getOAuth2Client(
        payload.userId,
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.notificationsGateway.sendToUser(payload.userId, 'campaign_error', {
          campaignId: payload.campaignId,
          message: 'Google Token expired. Please reconnect.',
        });

        if (payload.campaignId) {
          this.eventEmitter.emit('campaign.pause', {
            campaignId: payload.campaignId,
          });
        }
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }

    // 3. Build raw MIME message
    const raw = await this.mailService.buildRawEmail({
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      headers: payload.headers,
    });

    // 4. Send via Gmail API
    const mail = gmail({ version: 'v1', auth: oauth2Client });
    const response = await mail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    const gmailMessageId = response.data.id;
    const now = new Date();

    // 5. Update email log → SENT
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

    // 6. Emit email.sent event
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
