import { BaseTimeStampEntity } from "src/utils/config/database/base-entity";
import { Column, Entity, OneToMany } from "typeorm";
import { SignatureAttachment } from "./signature-attachment.entity";

@Entity('signatures')
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
}