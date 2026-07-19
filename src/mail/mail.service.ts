import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignEmailLog } from '../entity/campaign-email-log.entity';
import { User } from '../entity/user.entity';
import { BuildRawEmailDto } from './dto/mail.dto';
import {
  GetEmailResponseDto,
  SendEmailDto,
  SendEmailResponseDto,
} from './dto/send-email.dto';
import { MailQueueProducer } from './mail-queue.producer';
import { Campaign } from 'src/entity/campaign.entity';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailQueueProducer: MailQueueProducer,
    @InjectRepository(CampaignEmailLog)
    private readonly emailLogRepository: Repository<CampaignEmailLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC API (Resend-inspired)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * POST /mail/send
   * Enqueues a single email to BullMQ and returns the emailLogId immediately.
   */
  async sendEmail(
    dto: SendEmailDto,
    userId: string,
  ): Promise<SendEmailResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    // Normalize `to` to array
    const toArray = Array.isArray(dto.to) ? dto.to : [dto.to];

    // Validate content
    if (!dto.html && !dto.text) {
      throw new BadRequestException('Either html or text must be provided');
    }
    const campaign = await this.campaignRepository.findOne({ where: { id: dto.campaignId } });
    if (!campaign) throw new BadRequestException('Campaign not found');
    // Create initial email log entry
    const log = this.emailLogRepository.create({
      campaignId: dto.campaignId ?? null,
      recipientId: dto.recipientId ?? null,
      status: dto.scheduledAt ? 'scheduled' : 'queued',
      metadata: {
        from: dto.from ?? `${user.firstName ?? 'Sender'} <${user.email}>`,
        to: toArray,
        subject: dto.subject,
      },
    });
    const savedLog = await this.emailLogRepository.save(log);

    const idempotencyKey = dto.idempotencyKey ?? `${savedLog.id}_${Date.now()}`;
    const from = dto.from ?? `${user.firstName ?? 'Sender'} <${user.email}>`;

    // Enqueue job
    await this.mailQueueProducer.enqueue(
      {
        emailLogId: savedLog.id,
        userId,
        campaignId: dto.campaignId,
        recipientId: dto.recipientId,
        from,
        to: toArray,
        subject: dto.subject,
        html: dto.html ?? '',
        text: dto.text,
        headers: dto.headers,
        idempotencyKey,
        campaignStatus: campaign.status,
        campaignName: campaign.name,
      },
      { scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined },
    );

    return { id: savedLog.id };
  }

  /**
   * GET /mail/:id
   * Retrieve email log by ID.
   */
  async getEmail(id: string): Promise<GetEmailResponseDto> {
    const log = await this.emailLogRepository.findOne({ where: { id } });
    if (!log) throw new NotFoundException(`Email log ${id} not found`);

    return {
      id: log.id,
      from: log.metadata?.from,
      to: log.metadata?.to,
      subject: log.metadata?.subject,
      status: log.status,
      gmailMessageId: log.metadata?.gmailMessageId ?? null,
      sentAt: log.metadata?.sentAt ?? null,
      createdAt: log.createdAt,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INTERNAL HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  private encodeAddress(address: string): string {
    const match = address.match(/^(.*?)\s*<(.+)>$/);
    if (match) {
      const name = match[1].trim().replace(/^"|"$/g, '').trim();
      const email = match[2].trim();
      if (name) {
        const encodedName = `=?UTF-8?B?${Buffer.from(name).toString('base64')}?=`;
        return `${encodedName} <${email}>`;
      }
    }
    return address;
  }

  /**
   * Build a base64url-encoded RFC 2822 MIME message for Gmail API.
   */
  buildRawEmail(dto: BuildRawEmailDto): string {
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const subjectEncoded = `=?UTF-8?B?${Buffer.from(dto.subject).toString('base64')}?=`;
    const fromEncoded = this.encodeAddress(dto.from);
    const toEncoded = dto.to
      .map((address) => this.encodeAddress(address))
      .join(', ');

    // ── Unsubscribe headers (RFC 2369 + RFC 8058) ───────────────────────────
    const unsubscribeHeaders: string[] = [];
    if (dto.unsubscribeUrl) {
      unsubscribeHeaders.push(
        `List-Unsubscribe: <${dto.unsubscribeUrl}>`,
        `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
      );
    }

    const headerLines = [
      `From: ${fromEncoded}`,
      `To: ${toEncoded}`,
      `Subject: ${subjectEncoded}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ...unsubscribeHeaders,
      ...Object.entries(dto.headers ?? {}).map(([k, v]) => `${k}: ${v}`),
    ].join('\r\n');

    // ── Append unsubscribe footer to plain text ──────────────────────────────
    const plainText = dto.unsubscribeUrl
      ? `${dto.text ?? ''}\r\n\r\n--\r\nTo unsubscribe, visit: ${dto.unsubscribeUrl}`
      : (dto.text ?? '');

    // ── Append unsubscribe footer to HTML ───────────────────────────────────
    const unsubscribeFooterHtml = dto.unsubscribeUrl
      ? `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;">
  You received this email because you were added to a mailing list.<br/>
  <a href="${dto.unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
</div>`
      : '';
    const htmlBody = `${dto.html ?? ''}${unsubscribeFooterHtml}`;

    const textPart = [
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      plainText,
    ].join('\r\n');

    const htmlPart = [
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      htmlBody,
      `--${boundary}--`,
    ].join('\r\n');

    const raw = `${headerLines}\r\n\r\n${textPart}\r\n${htmlPart}`;
    return Buffer.from(raw).toString('base64url');
  }
}
