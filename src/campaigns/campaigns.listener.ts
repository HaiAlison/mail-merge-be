import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../entity/campaign.entity';
import { CampaignRecipient } from '../entity/campaign-recipient.entity';
import { EmailSentEvent } from '../mail/mail-queue.types';
import { RecipientStatus } from '../entity/enums';

@Injectable()
export class CampaignsListener {
  private readonly logger = new Logger(CampaignsListener.name);

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(CampaignRecipient)
    private readonly recipientRepository: Repository<CampaignRecipient>,
  ) {}

  @OnEvent('email.sent')
  async handleEmailSentEvent(event: EmailSentEvent) {
    const { payload, gmailMessageId } = event;
    const now = new Date();

    try {
      // 1. Update recipient status (if linked to a campaign recipient)
      if (payload.recipientId) {
        await this.recipientRepository.update(payload.recipientId, {
          status: RecipientStatus.SENT,
          sentAt: now,
          errorMessage: null,
        });
      }

      // 2. Increment campaign sent_count (if linked to a campaign)
      if (payload.campaignId) {
        await this.campaignRepository.increment(
          { id: payload.campaignId },
          'sentCount',
          1,
        );
        await this.checkAndMarkCampaignDone(payload.campaignId);
      }
    } catch (error) {
      this.logger.error(
        `Error handling email.sent event for campaign ${payload.campaignId}:`,
        error,
      );
    }
  }

  private async checkAndMarkCampaignDone(campaignId: string): Promise<void> {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
    });
    if (!campaign) return;

    const total = campaign.totalRecipients ?? 0;
    const done = (campaign.sentCount ?? 0) + (campaign.failedCount ?? 0);

    if (total > 0 && done >= total) {
      await this.campaignRepository.update(campaignId, {
        status: campaign.failedCount === total ? 'failed' : ('sent' as any),
        sentAt: new Date(),
      });
      this.logger.log(
        `Campaign ${campaignId} completed (${campaign.sentCount} sent, ${campaign.failedCount} failed)`,
      );
    }
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
        await this.checkAndMarkCampaignDone(payload.campaignId);
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
        status: 'paused' as any,
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
