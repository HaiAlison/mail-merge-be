import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * Global unsubscribe list.
 * Một record = email đó đã opt-out khỏi TẤT CẢ campaign của owner_user_id.
 */
@Entity('email_unsubscribes')
@Unique('uq_unsubscribe_owner_email', ['ownerUserId', 'email'])
export class EmailUnsubscribe {
  @PrimaryGeneratedColumn('uuid')
  id: string;
 
  /** User ID của người gửi campaign (owner) */
  @Index()
  @Column({ name: 'owner_user_id', type: 'uuid' })
  ownerUserId: string;

  /** Email của người nhận đã unsubscribe */
  @Index()
  @Column({ length: 255 })
  email: string;

  /** Campaign trigger unsubscribe (optional — for audit) */
  @Column({ name: 'source_campaign_id', type: 'uuid', nullable: true })
  sourceCampaignId: string | null;

  @CreateDateColumn({ name: 'unsubscribed_at', type: 'timestamptz' })
  unsubscribedAt: Date;
}
