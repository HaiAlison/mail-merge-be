import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { MAIL_QUEUE, SEND_EMAIL_JOB, SendEmailJobPayload } from './mail-queue.types';
import { MailService } from './mail.service';
import { GmailAuthService } from './gmail-auth.service';
import { CampaignEmailLog } from '../entity/campaign-email-log.entity';
import { CampaignRecipient } from '../entity/campaign-recipient.entity';
import { Campaign } from '../entity/campaign.entity';
import { RecipientStatus } from '../entity/enums';
import { google } from 'googleapis';

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
    @InjectRepository(CampaignRecipient)
    private readonly recipientRepository: Repository<CampaignRecipient>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
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
    const oauth2Client = await this.gmailAuthService.getOAuth2Client(payload.userId);

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
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    const gmailMessageId = response.data.id!;
    const now = new Date();

    // 5. Update email log → SENT
    await this.emailLogRepository.update(payload.emailLogId, {
      status: 'sent',
      metadata: { gmailMessageId, sentAt: now.toISOString() } as any,
    });

    // 6. Update recipient status (if linked to a campaign recipient)
    if (payload.recipientId) {
      await this.recipientRepository.update(payload.recipientId, {
        status: RecipientStatus.SENT,
        sentAt: now,
        errorMessage: null,
      });
    }

    // 7. Increment campaign sent_count (if linked to a campaign)
    if (payload.campaignId) {
      await this.campaignRepository.increment(
        { id: payload.campaignId },
        'sentCount',
        1,
      );
      await this.checkAndMarkCampaignDone(payload.campaignId);
    }

    this.logger.log(`✅ Email ${job.id} sent — gmailMessageId=${gmailMessageId}`);
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
      await this.emailLogRepository.update(payload.emailLogId, {
        status: 'failed',
        metadata: { error: error.message, failedAt: new Date().toISOString() } as any,
      });

      if (payload.recipientId) {
        await this.recipientRepository.update(payload.recipientId, {
          status: RecipientStatus.FAILED,
          errorMessage: error.message,
        });
      }

      if (payload.campaignId) {
        await this.campaignRepository.increment(
          { id: payload.campaignId },
          'failedCount',
          1,
        );
        await this.checkAndMarkCampaignDone(payload.campaignId);
      }
    }
  }

  /** Mark campaign as SENT once sent + failed counts equal total */
  private async checkAndMarkCampaignDone(campaignId: string): Promise<void> {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
    });
    if (!campaign) return;

    const total = campaign.totalRecipients ?? 0;
    const done = (campaign.sentCount ?? 0) + (campaign.failedCount ?? 0);

    if (total > 0 && done >= total) {
      await this.campaignRepository.update(campaignId, {
        status: campaign.failedCount === total ? 'failed' : 'sent' as any,
        sentAt: new Date(),
      });
      this.logger.log(`Campaign ${campaignId} completed (${campaign.sentCount} sent, ${campaign.failedCount} failed)`);
    }
  }
}
