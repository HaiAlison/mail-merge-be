import { BaseTimeStampEntity } from "src/utils/config/database/base-entity";
import { Column, Entity, OneToMany, OneToOne } from "typeorm";
import { SignatureAttachment } from "./signature-attachment.entity";
import { Campaign } from "./campaign.entity";

@Entity('signatures_')
export class Signature extends BaseTimeStampEntity {
    @Column()
    name: string;

    @Column()
    content: string;

    @Column({ name: 'user_id', type: 'uuid' })
    userId: string;

    @OneToMany(() => SignatureAttachment, (attachment) => attachment.signature)
    attachments: SignatureAttachment[];

    @Column({ name: 'is_default', type: 'boolean', default: false })
    isDefault: boolean;

    @OneToOne(() => Campaign, (campaign) => campaign.dataSource)
    campaign: Campaign;
}