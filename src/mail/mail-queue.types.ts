import { CampaignStatus } from "src/entity/enums";

export const MAIL_QUEUE = 'mail-queue';
export const SEND_EMAIL_JOB = 'send-email';

export interface SendEmailJobPayload {
  /** CampaignEmailLog ID — dùng để update status sau khi gửi */
  emailLogId: string;
  /** User ID — để lấy OAuth tokens */
  userId: string;
  /** Campaign ID (optional, nếu gửi từ campaign) */
  campaignId?: string;
  /** Recipient ID (optional) */
  recipientId?: string;
  /** Sender: "Name <email@gmail.com>" */
  from: string;
  /** Recipient emails */
  to: string[];
  /** Email subject */
  subject: string;
  /** HTML content (sau khi đã render mail-merge variables) */
  html: string;
  /** Plain text fallback */
  text?: string;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Idempotency: campaignId_recipientId hoặc uuid */
  idempotencyKey: string;
  /** Loại campaign */
  campaignStatus: CampaignStatus;
  campaignName: string;
  /** URL unsubscribe nhúng vào email (optional — chỉ khi là campaign) */
  unsubscribeUrl?: string;
}

export interface EmailSentEvent {
  payload: SendEmailJobPayload;
  gmailMessageId: string;
}
