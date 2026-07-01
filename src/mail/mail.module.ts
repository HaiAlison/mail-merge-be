import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignEmailLog } from '../entity/campaign-email-log.entity';
import { CampaignRecipient } from '../entity/campaign-recipient.entity';
import { Campaign } from '../entity/campaign.entity';
import { User } from '../entity/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { GmailAuthService } from './gmail-auth.service';
import { MailQueueConsumer } from './mail-queue.consumer';
import { MailQueueProducer } from './mail-queue.producer';
import { MAIL_QUEUE } from './mail-queue.types';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

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
    NotificationsModule,
  ],
  controllers: [MailController],
  providers: [
    MailService,
    GmailAuthService,
    MailQueueProducer,
    MailQueueConsumer,
  ],
  exports: [MailService, MailQueueProducer, GmailAuthService],
})
export class MailModule { }
