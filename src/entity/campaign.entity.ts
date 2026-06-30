import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CampaignAttachment } from './campaign-attachment.entity';
import { CampaignDataSource } from './campaign-data-source.entity';
import { CampaignEmailLog } from './campaign-email-log.entity';
import { CampaignRecipient } from './campaign-recipient.entity';
import { CampaignStatus } from './enums';
@Entity('campaigns')
export class Campaign {
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

  @Index()
  @Column({
    type: 'enum',
    enum: CampaignStatus,
    default: CampaignStatus.DRAFT,
  })
  status: CampaignStatus;

  @Column({ name: 'total_recipients', default: 0 })
  totalRecipients?: number;

  @Column({ name: 'sent_count', default: 0 })
  sentCount?: number;

  @Column({ name: 'failed_count', default: 0 })
  failedCount?: number;

  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt?: Date | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => CampaignRecipient, (recipient) => recipient.campaign)
  recipients: CampaignRecipient[];

  @OneToMany(() => CampaignAttachment, (attachment) => attachment.campaign)
  attachments: CampaignAttachment[];

  @OneToOne(() => CampaignDataSource, (datasource) => datasource.campaign)
  dataSource: CampaignDataSource;

  @OneToMany(() => CampaignEmailLog, (log) => log.campaign)
  emailLogs: CampaignEmailLog[];
}
