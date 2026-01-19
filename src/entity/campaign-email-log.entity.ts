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
import { EmailLogStatus } from './enums';

@Entity('campaign_email_logs')
export class CampaignEmailLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column({ name: 'campaign_id', type: 'uuid' })
    campaignId: string;

    @ManyToOne(() => Campaign, (campaign) => campaign.emailLogs, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'campaign_id' })
    campaign: Campaign;

    @Index()
    @Column({ name: 'recipient_id', type: 'uuid' })
    recipientId: string;

    // Assuming we might want a relation to CampaignRecipient later, but for now just ID
    // @ManyToOne(() => CampaignRecipient)
    // @JoinColumn({ name: 'recipient_id' })
    // recipient: CampaignRecipient;

    @Column({
        type: 'varchar', // Keeping as varchar to match flexible schema, but logical enum
        length: 50,
    })
    status: string; // sent, delivered, opened, etc.

    @Column('jsonb', { default: {} })
    metadata: Record<string, any>;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;
}
