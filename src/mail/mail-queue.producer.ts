import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  MAIL_QUEUE,
  SEND_EMAIL_JOB,
  SendEmailJobPayload,
} from './mail-queue.types';

@Injectable()
export class MailQueueProducer {
  private readonly logger = new Logger(MailQueueProducer.name);

  constructor(
    @InjectQueue(MAIL_QUEUE)
    private readonly mailQueue: Queue<SendEmailJobPayload>,
  ) {}

  /**
   * Enqueue a single email send job.
   * - Uses idempotencyKey as jobId to prevent duplicates.
   * - Supports delayed sending via `scheduledAt`.
   */
  async enqueue(
    payload: SendEmailJobPayload,
    options?: { scheduledAt?: Date },
  ): Promise<string> {
    const delay = options?.scheduledAt
      ? Math.max(0, options.scheduledAt.getTime() - Date.now())
      : 0;

    const job = await this.mailQueue.add(SEND_EMAIL_JOB, payload, {
      jobId: payload.idempotencyKey, // prevents duplicate sends
      delay,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5_000, // 5s, 25s, 125s
      },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
    });

    this.logger.log(
      `Enqueued email job ${job.id} for ${payload.to.join(',')}${delay ? ` (delayed ${delay}ms)` : ''}`,
    );

    return job.id;
  }

  /**
   * Enqueue multiple emails for a campaign in bulk.
   */
  async enqueueBatch(
    payloads: SendEmailJobPayload[],
    options?: { scheduledAt?: Date },
  ): Promise<string[]> {
    const delay = options?.scheduledAt
      ? Math.max(0, options.scheduledAt.getTime() - Date.now())
      : 0;

    const jobs = await this.mailQueue.addBulk(
      payloads.map((payload) => ({
        name: SEND_EMAIL_JOB,
        data: payload,
        opts: {
          jobId: payload.idempotencyKey,
          delay,
          attempts: 3,
          backoff: { type: 'exponential' as const, delay: 5_000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 500 },
        },
      })),
    );

    this.logger.log(`Enqueued ${jobs.length} email jobs for campaign`);
    return jobs.map((j) => j.id);
  }
}
