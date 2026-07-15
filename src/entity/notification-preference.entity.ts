import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { SubscribableNotificationType } from './enums';
import { BaseTimeStampEntity } from '../utils/config/database/base-entity';

@Entity('notification_preferences')
@Unique(['userId', 'notificationType'])
export class NotificationPreference extends BaseTimeStampEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    name: 'notification_type',
    type: 'enum',
    enum: SubscribableNotificationType,
  })
  notificationType: SubscribableNotificationType;

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled: boolean;
}
