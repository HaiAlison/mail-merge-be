import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignDataSource } from 'src/entity/campaign-data-source.entity';
import { UsersModule } from 'src/users/users.module';
import { CampaignAttachment } from '../entity/campaign-attachment.entity';
import { CampaignEmailLog } from '../entity/campaign-email-log.entity';
import { CampaignRecipient } from '../entity/campaign-recipient.entity';
import { Campaign } from '../entity/campaign.entity';
import { MailModule } from '../mail/mail.module';
import { CampaignsController } from './campaigns.controller';
import { CampaignsListener } from './campaigns.listener';
import { CampaignsService } from './campaigns.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Campaign,
      CampaignRecipient,
      CampaignAttachment,
      CampaignDataSource,
      CampaignEmailLog,
    ]),
    MailModule,
    UsersModule,
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignsListener],
  exports: [CampaignsService],
})
export class CampaignsModule { }
