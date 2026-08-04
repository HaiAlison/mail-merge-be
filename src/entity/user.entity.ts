import { Entity, Column, Index } from 'typeorm';
import { BaseTimeStampEntity } from 'src/utils/config/database/base-entity';
import { encryptionTransformer } from 'src/utils/transformers/encryption.transformer';

@Entity('users')
export class User extends BaseTimeStampEntity {
  /** Google "sub" / profile id — dùng để nhận diện tài khoản khi đăng nhập lại */
  @Index({ unique: true, where: '"google_provider_id" IS NOT NULL' })
  @Column({ name: 'google_provider_id', length: 255, nullable: true })
  googleProviderId: string | null;

  @Index({ unique: true })
  @Column({ length: 255 })
  email: string;

  @Column({ name: 'first_name', length: 255, nullable: true })
  firstName: string | null;

  @Column({ name: 'last_name', length: 255, nullable: true })
  lastName: string | null;

  @Column({ type: 'text', nullable: true })
  picture: string | null;

  /** Google OAuth refresh token — Google chỉ gửi lần đầu (hoặc khi re-consent); giữ lại nếu đã có */
  @Column({
    name: 'google_refresh_token',
    type: 'text',
    nullable: true,
    transformer: encryptionTransformer,
    select: false
  })
  googleRefreshToken: string | null;

  /** Hashed password for email/password auth (null for Google-only accounts) */
  @Column({ type: 'text', nullable: true, select: false })
  password: string | null;

  @Column({ name: 'rate_limit_per_minute', type: 'int', default: 30 })
  rateLimitPerMinute: number;

  @Column({ name: 'daily_limit', type: 'int', default: 500 })
  dailyLimit: number;

  // ─── MFA ──────────────────────────────────────────────────────────────

  @Column({
    name: 'mfa_secret',
    type: 'text',
    nullable: true,
    transformer: encryptionTransformer,
    select: false,
  })
  mfaSecret: string | null;

  @Column({ name: 'is_mfa_enabled', type: 'boolean', default: false })
  isMfaEnabled: boolean;

  @Column({
    name: 'mfa_backup_codes',
    type: 'text',
    nullable: true,
    select: false,
  })
  mfaBackupCodes: string | null;
}
