import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Campaign } from './campaign.entity';
import { BaseTimeStampEntity } from 'src/utils/config/database/base-entity';

@Entity('campaign_attachments')
export class CampaignAttachment extends BaseTimeStampEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'campaign_id', type: 'uuid', nullable: true })
  campaignId: string;

  @ManyToOne(() => Campaign, (campaign) => campaign.attachments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  @Column({ name: 'file_name', length: 255 })
  fileName: string;

  @Column({ name: 'file_path', type: 'text' })
  filePath: string;

  @Column({ name: 'file_size', type: 'bigint' })
  fileSize: string; // BigInt behaves like string in JS/TypeORM usually

  @Column({ name: 'mime_type', type: 'varchar', length: 100, nullable: true })
  mimeType: string | null;

}
