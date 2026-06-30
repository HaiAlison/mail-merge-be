import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { Campaign } from '../entity/campaign.entity';
import { CampaignRecipient } from '../entity/campaign-recipient.entity';
import { CampaignAttachment } from '../entity/campaign-attachment.entity';
import { CampaignEmailLog } from '../entity/campaign-email-log.entity';
import { MailModule } from '../mail/mail.module';
import { CampaignDataSource } from 'src/entity/campaign-data-source.entity';

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
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule { }
