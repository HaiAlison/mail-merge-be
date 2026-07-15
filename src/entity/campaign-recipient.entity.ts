import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Campaign } from './campaign.entity';
import { RecipientStatus } from './enums';
import { BaseTimeStampEntity } from 'src/utils/config/database/base-entity';

@Entity('campaign_recipients')
@Unique('campaign_recipient_email_unique', ['campaignId', 'email'])
export class CampaignRecipient extends BaseTimeStampEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId: string;

  @ManyToOne(() => Campaign, (campaign) => campaign.recipients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  @Index()
  @Column({ length: 255 })
  email: string;

  @Column('jsonb', { default: {} })
  data: Record<string, any>;

  @Column({
    type: 'enum',
    enum: RecipientStatus,
    default: RecipientStatus.PENDING, // Mapping varchar to enum for better type safety
  })
  status: RecipientStatus;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

}
