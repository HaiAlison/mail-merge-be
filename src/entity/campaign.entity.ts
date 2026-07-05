import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CampaignAttachment } from './campaign-attachment.entity';
import { CampaignDataSource } from './campaign-data-source.entity';
import { CampaignEmailLog } from './campaign-email-log.entity';
import { CampaignRecipient } from './campaign-recipient.entity';
import { CampaignStatus, ParseStatus } from './enums';
import { BaseTimeStampEntity } from 'src/utils/config/database/base-entity';
@Entity('campaigns')
@Index('cursor_index_campaigns', ['createdAt', 'id'], { unique: true })
export class Campaign extends BaseTimeStampEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 500 })
  subject: string;

  @Column('text')
  content: string;

  @Column('text', { array: true, default: '{}' })
  placeholders: string[];

  @Column('jsonb', { name: 'placeholders_map', default: {} })
  placeholdersMap: Record<string, string>;

  @Index()
  @Column({
    type: 'enum',
    enum: CampaignStatus,
    default: CampaignStatus.DRAFT,
  })
  status: CampaignStatus;

  @Column({
    name: 'parse_status',
    type: 'enum',
    enum: ParseStatus,
    default: ParseStatus.PENDING,
  })
  parseStatus: ParseStatus;

  @Column({ name: 'total_recipients', default: 0 })
  totalRecipients?: number;

  @Column({ name: 'sent_count', default: 0 })
  sentCount?: number;

  @Column({ name: 'scheduling_count', default: 0 })
  schedulingCount?: number;

  @Column({ name: 'failed_count', default: 0 })
  failedCount?: number;

  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt?: Date | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt?: Date | null;

  @OneToMany(() => CampaignRecipient, (recipient) => recipient.campaign)
  recipients: CampaignRecipient[];

  @OneToMany(() => CampaignAttachment, (attachment) => attachment.campaign)
  attachments: CampaignAttachment[];

  @Column({ name: 'data_source_id', type: 'uuid', nullable: true })
  dataSourceId: string;

  @OneToOne(() => CampaignDataSource, (datasource) => datasource.campaign, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'data_source_id' })
  dataSource: CampaignDataSource;

  @OneToMany(() => CampaignEmailLog, (log) => log.campaign)
  emailLogs: CampaignEmailLog[];
}
