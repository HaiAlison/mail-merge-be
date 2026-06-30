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
    transformer: encryptionTransformer 
  })
  googleRefreshToken: string | null;

  /** Hashed password for email/password auth (null for Google-only accounts) */
  @Column({ type: 'text', nullable: true })
  password: string | null;
}
