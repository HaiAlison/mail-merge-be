import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { BaseTimeStampEntity } from 'src/utils/config/database/base-entity';
import { Signature } from './signatures.entity';

@Entity('signature_attachments')
export class SignatureAttachment extends BaseTimeStampEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column({ name: 'signature_id', type: 'uuid', nullable: true })
    signatureId: string;

    @ManyToOne(() => Signature, (signature) => signature.attachments, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'signature_id' })
    signature: Signature;

    @Column({ name: 'file_name', length: 255 })
    fileName: string;

    @Column({ name: 'file_path', type: 'text' })
    filePath: string;

    @Column({ name: 'file_size', type: 'bigint' })
    fileSize: string; // BigInt behaves like string in JS/TypeORM usually

    @Column({ name: 'mime_type', type: 'varchar', length: 100, nullable: true })
    mimeType: string | null;

}
