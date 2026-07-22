import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, UnrecoverableError } from 'bullmq';
import { In, Repository } from 'typeorm';
import { Campaign } from '../entity/campaign.entity';
import { CampaignRecipient } from '../entity/campaign-recipient.entity';
import { ParseStatus } from '../entity/enums';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import {
  CAMPAIGN_QUEUE,
  PARSE_FILE_JOB,
  ParseFileJobPayload,
} from './campaign-queue.types';
import { FileParserService } from './file-parser.service';
import { IParsedRow } from './campaign.type';
import { getStreamFromCloud } from '../utils/common/handle';

const BATCH_SIZE = 500;

@Processor(CAMPAIGN_QUEUE, { concurrency: 2 })
export class CampaignQueueConsumer extends WorkerHost {
  private readonly logger = new Logger(CampaignQueueConsumer.name);

  constructor(
    private readonly fileParserService: FileParserService,
    private readonly notificationsGateway: NotificationsGateway,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(CampaignRecipient)
    private readonly recipientRepository: Repository<CampaignRecipient>,
  ) {
    super();
  }

  async process(job: Job<ParseFileJobPayload>): Promise<void> {
    if (job.name !== PARSE_FILE_JOB) return;

    const { campaignId, filePath, fileName, mimeType, placeholdersMap, userId } =
      job.data;
    this.logger.log(`[${campaignId}] Starting file parse job`);

    // Mark campaign as processing
    await this.campaignRepository.update(campaignId, {
      parseStatus: ParseStatus.PROCESSING,
    });

    this.notificationsGateway.sendToUser(userId, 'campaign.parse.started', {
      campaignId,
    });

    try {
      let batch: Omit<Partial<CampaignRecipient>, 'id'>[] = [];
      let totalProcessed = 0;

      const flushBatch = async () => {
        if (batch.length === 0) return;
        await this.recipientRepository
          .createQueryBuilder()
          .insert()
          .into(CampaignRecipient)
          .values(batch as any[])
          .orIgnore() // skip duplicate emails
          .execute();
        batch = [];
      };

      const stream = await getStreamFromCloud(filePath, fileName);

      await this.fileParserService.streamRows(
        stream,
        mimeType,
        async (row: IParsedRow) => {
          const { email, ...rest } = row;
          if (!email) return; // skip rows without email

          // Remap column keys using placeholdersMap
          const data: Record<string, string> = {};
          for (const [origKey, val] of Object.entries(rest)) {
            const mappedKey = placeholdersMap[origKey] || origKey;
            data[mappedKey] = val;
          }

          batch.push({
            campaignId,
            email: email.trim().toLowerCase(),
            data,
          } as any);

          if (batch.length >= BATCH_SIZE) {
            await flushBatch();
          }
        },
        (processed) => {
          totalProcessed = processed;
          // Emit progress every 500 rows
          if (processed % BATCH_SIZE === 0) {
            this.notificationsGateway.sendToUser(
              userId,
              'campaign.parse.progress',
              {
                campaignId,
                processed,
              },
            );
          }
        },
      );

      // Flush remaining rows
      await flushBatch();

      // Update campaign with final count and mark done
      const totalRecipients = await this.recipientRepository.count({
        where: { campaignId },
      });
      await this.campaignRepository.update(campaignId, {
        parseStatus: ParseStatus.DONE,
        totalRecipients,
      });

      this.notificationsGateway.sendToUser(userId, 'campaign.parse.completed', {
        campaignId,
        totalRecipients,
      });

      this.logger.log(
        `[${campaignId}] Parse job completed: ${totalRecipients} recipients`,
      );
    } catch (error) {
      this.logger.error(`[${campaignId}] Parse job failed:`, error);

      await this.campaignRepository.update(campaignId, {
        parseStatus: ParseStatus.FAILED,
      });

      this.notificationsGateway.sendToUser(userId, 'campaign.parse.failed', {
        campaignId,
        error: error.message,
      });

      throw new UnrecoverableError(error.message);
    }
  }
}
