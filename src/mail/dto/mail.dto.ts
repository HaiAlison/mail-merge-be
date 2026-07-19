import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';

// ─── Raw MIME Builder DTO ───────────────────────────────────────────────────

export class BuildRawEmailDto {
  @ApiProperty({ example: 'Sender Name <sender@gmail.com>' })
  @IsString()
  from: string;

  @ApiProperty({ example: ['recipient@example.com'], type: [String] })
  @IsString({ each: true })
  @IsArray()
  to: string[];

  @ApiProperty({ example: 'Hello from Mail Merge!' })
  @IsString()
  subject: string;

  @ApiPropertyOptional({ example: 'Plain text fallback' })
  @IsString()
  @IsOptional()
  text?: string;

  @ApiPropertyOptional({ example: '<p>Hello <strong>World</strong></p>' })
  @IsString()
  @IsOptional()
  html?: string;

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  /** Unsubscribe URL — injected into List-Unsubscribe header + email footer */
  @ApiPropertyOptional({ example: 'https://api.example.com/unsubscribe?token=xxx' })
  @IsString()
  @IsOptional()
  unsubscribeUrl?: string;
}
