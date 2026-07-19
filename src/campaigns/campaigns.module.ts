import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignDataSource } from 'src/entity/campaign-data-source.entity';
import { UsersModule } from 'src/users/users.module';
import { CampaignAttachment } from '../entity/campaign-attachment.entity';
import { CampaignEmailLog } from '../entity/campaign-email-log.entity';
import { CampaignRecipient } from '../entity/campaign-recipient.entity';
import { Campaign } from '../entity/campaign.entity';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UnsubscribeModule } from 'src/unsubscribe/unsubscribe.module';
import { CampaignQueueConsumer } from './campaign-queue.consumer';
import { CampaignQueueProducer } from './campaign-queue.producer';
import { CAMPAIGN_QUEUE } from './campaign-queue.types';
import { CampaignsController } from './campaigns.controller';
import { CampaignsListener } from './campaigns.listener';
import { CampaignsService } from './campaigns.service';
import { FileParserService } from './file-parser.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Campaign,
      CampaignRecipient,
      CampaignAttachment,
      CampaignDataSource,
      CampaignEmailLog,
    ]),
    BullModule.registerQueue({ name: CAMPAIGN_QUEUE }),
    MailModule,
    UsersModule,
    NotificationsModule,
    UnsubscribeModule,
  ],
  controllers: [CampaignsController],
  providers: [
    CampaignsService,
    CampaignsListener,
    FileParserService,
    CampaignQueueProducer,
    CampaignQueueConsumer,
  ],
  exports: [CampaignsService],
})
export class CampaignsModule {}
