import { BaseTimeStampEntity } from 'src/utils/config/database/base-entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne
} from 'typeorm';
import { Campaign } from './campaign.entity';

@Entity('campaign_data_source')
export class CampaignDataSource extends BaseTimeStampEntity {
  @OneToOne(() => Campaign, (campaign) => campaign.dataSource)
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
