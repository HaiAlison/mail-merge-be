import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../entity/campaign.entity';
import { CampaignRecipient } from '../entity/campaign-recipient.entity';
import { EmailSentEvent } from '../mail/mail-queue.types';
import {
  CampaignStatus,
  NotificationType,
  RecipientStatus,
} from '../entity/enums';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CampaignsListener {
  private readonly logger = new Logger(CampaignsListener.name);

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(CampaignRecipient)
    private readonly recipientRepository: Repository<CampaignRecipient>,
    private readonly notificationsService: NotificationsService,
  ) {}

  @OnEvent('email.sent')
  async handleEmailSentEvent(event: EmailSentEvent) {
    const { payload } = event;
    const now = new Date();

    try {
      // 1. Update recipient status
      if (payload.recipientId) {
        await this.recipientRepository.update(payload.recipientId, {
          status: RecipientStatus.SENT,
          sentAt: now,
          errorMessage: null,
        });
      }

      // 2. Increment campaign sent_count
      if (payload.campaignId) {
        await this.campaignRepository.increment(
          { id: payload.campaignId },
          'sentCount',
          1,
        );
        if (payload.campaignStatus === CampaignStatus.SCHEDULED) {
          await this.campaignRepository.decrement(
            { id: payload.campaignId },
            'schedulingCount',
            1,
          );
        }

        const isDone = await this.checkAndMarkCampaignDone(payload.campaignId);

        // Only notify when the campaign fully completes (not on every email)
        if (isDone && payload.userId) {
          const campaign = await this.campaignRepository.findOne({
            where: { id: payload.campaignId },
          });
          const allFailed =
            campaign && campaign.failedCount === campaign.totalRecipients;

          await this.notificationsService.createNotification({
            userId: payload.userId,
            type: allFailed
              ? NotificationType.CAMPAIGN_FAILED
              : NotificationType.CAMPAIGN_COMPLETED,
            title: allFailed ? 'Campaign Failed' : 'Campaign Completed',
            message: allFailed
              ? `Campaign "${payload.subject}" finished but all emails failed to send.`
              : `Campaign "${payload.subject}" has been sent successfully.`,
            metadata: { campaignId: payload.campaignId },
          });
        }
      }
    } catch (error) {
      this.logger.error(
        `Error handling email.sent event for campaign ${payload.campaignId}:`,
        error,
      );
    }
  }

  /**
   * Returns true if the campaign just transitioned to done (sent / failed).
   */
  private async checkAndMarkCampaignDone(campaignId: string): Promise<boolean> {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
    });
    if (!campaign) return false;

    const total = campaign.totalRecipients ?? 0;
    const done = (campaign.sentCount ?? 0) + (campaign.failedCount ?? 0);

    if (total > 0 && done >= total) {
      const newStatus =
        campaign.failedCount === total
          ? CampaignStatus.FAILED
          : CampaignStatus.SENT;
      await this.campaignRepository.update(campaignId, {
        status: newStatus,
        sentAt: new Date(),
      });
      this.logger.log(
        `Campaign ${campaignId} completed (${campaign.sentCount} sent, ${campaign.failedCount} failed)`,
      );
      return true;
    }

    return false;
  }

  @OnEvent('email.failed')
  async handleEmailFailedEvent(event: {
    payload: EmailSentEvent['payload'];
    error: Error;
  }) {
    const { payload, error } = event;

    try {
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

        const isDone = await this.checkAndMarkCampaignDone(payload.campaignId);

        // Notify user when all emails done and there are failures
        if (isDone && payload.userId) {
          const campaign = await this.campaignRepository.findOne({
            where: { id: payload.campaignId },
          });
          if (campaign && (campaign.failedCount ?? 0) > 0) {
            const allFailed = campaign.failedCount === campaign.totalRecipients;
            await this.notificationsService.createNotification({
              userId: payload.userId,
              type: allFailed
                ? NotificationType.CAMPAIGN_FAILED
                : NotificationType.CAMPAIGN_COMPLETED,
              title: allFailed
                ? 'Campaign Failed'
                : 'Campaign Completed with Errors',
              message: allFailed
                ? `Campaign "${payload.subject}" failed — all ${campaign.totalRecipients} emails could not be sent.`
                : `Campaign "${payload.subject}" finished with ${campaign.failedCount} failed and ${campaign.sentCount} sent.`,
              metadata: { campaignId: payload.campaignId },
            });
          }
        }
      }
    } catch (err) {
      this.logger.error(
        `Error handling email.failed event for campaign ${payload.campaignId}:`,
        err,
      );
    }
  }

  @OnEvent('campaign.pause')
  async handleCampaignPauseEvent(event: { campaignId: string }) {
    try {
      await this.campaignRepository.update(event.campaignId, {
        status: CampaignStatus.PAUSED,
      });
      this.logger.log(`Campaign ${event.campaignId} paused due to error`);
    } catch (err) {
      this.logger.error(
        `Error handling campaign.pause event for campaign ${event.campaignId}:`,
        err,
      );
    }
  }
}
