import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

// ─── Request DTO (Resend-inspired) ──────────────────────────────────────────

export class SendEmailDto {
  @ApiPropertyOptional({
    description: "Sender address. Defaults to user's Gmail if omitted.",
    example: 'Your Name <you@gmail.com>',
  })
  @IsString()
  @IsOptional()
  from?: string;

  @ApiProperty({
    description: 'Recipient(s). Max 50.',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: ['recipient@example.com'],
  })
  to: string | string[];

  @ApiProperty({ example: 'Hello from Mail Merge! 👋' })
  @IsString()
  subject: string;

  @ApiPropertyOptional({ example: '<h1>Hello!</h1><p>This is your email.</p>' })
  @IsString()
  @IsOptional()
  html?: string;

  @ApiPropertyOptional({ example: 'Hello! This is your email.' })
  @IsString()
  @IsOptional()
  text?: string;

  @ApiPropertyOptional({
    description:
      'ISO 8601 datetime to schedule the email. e.g. 2026-08-05T11:00:00Z',
    example: '2026-08-05T11:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @ApiPropertyOptional({
    type: Object,
    example: { 'X-Custom-Header': 'value' },
  })
  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  // ─── Internal fields (set by service/campaigns) ───────────────────────────

  /** Campaign ID (set internally when sending from a campaign) */
  campaignId?: string;

  /** Recipient ID (set internally) */
  recipientId?: string;

  /** Unique key to prevent duplicate sends (default: auto-generated) */
  idempotencyKey?: string;
}

// ─── Response DTOs ───────────────────────────────────────────────────────────

export class SendEmailResponseDto {
  @ApiProperty({
    description: 'Email log ID (equivalent to Resend email ID)',
    example: 'a1b2c3d4-...',
  })
  id: string;
}

export class GetEmailResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Sender <you@gmail.com>' })
  from: string;

  @ApiProperty({ example: ['recipient@example.com'] })
  to: string[];

  @ApiProperty({ example: 'Hello from Mail Merge!' })
  subject: string;

  @ApiProperty({
    description: 'Current status',
    enum: ['queued', 'scheduled', 'sending', 'sent', 'failed'],
    example: 'sent',
  })
  status: string;

  @ApiPropertyOptional({
    description: 'Gmail message ID after successful send',
    nullable: true,
  })
  gmailMessageId: string | null;

  @ApiPropertyOptional({ nullable: true })
  sentAt: string | null;

  @ApiProperty()
  createdAt: Date;
}
