import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { GmailAuthService } from './gmail-auth.service';
import { MailQueueProducer } from './mail-queue.producer';
import { MailQueueConsumer } from './mail-queue.consumer';
import { MAIL_QUEUE } from './mail-queue.types';
import { CampaignEmailLog } from '../entity/campaign-email-log.entity';
import { CampaignRecipient } from '../entity/campaign-recipient.entity';
import { Campaign } from '../entity/campaign.entity';
import { User } from '../entity/user.entity';

@Module({
  imports: [
    // Register entities used in this module
    TypeOrmModule.forFeature([
      CampaignEmailLog,
      CampaignRecipient,
      Campaign,
      User,
    ]),
    // Register BullMQ queue (Redis connection picked from env via BullModule.forRootAsync in AppModule)
    BullModule.registerQueue({
      name: MAIL_QUEUE,
    }),
  ],
  controllers: [MailController],
  providers: [
    MailService,
    GmailAuthService,
    MailQueueProducer,
    MailQueueConsumer,
  ],
  exports: [MailService, MailQueueProducer],
})
export class MailModule {}
