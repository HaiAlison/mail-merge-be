import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  CAMPAIGN_QUEUE,
  PARSE_FILE_JOB,
  ParseFileJobPayload,
} from './campaign-queue.types';

@Injectable()
export class CampaignQueueProducer {
  constructor(
    @InjectQueue(CAMPAIGN_QUEUE) private readonly campaignQueue: Queue,
  ) {}

  async enqueueParseFile(payload: ParseFileJobPayload): Promise<void> {
    await this.campaignQueue.add(PARSE_FILE_JOB, payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  }
}
