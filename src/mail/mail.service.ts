import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BuildRawEmailDto } from './dto/mail.dto';
import { SendEmailDto, SendEmailResponseDto, GetEmailResponseDto } from './dto/send-email.dto';
import { MailQueueProducer } from './mail-queue.producer';
import { CampaignEmailLog } from '../entity/campaign-email-log.entity';
import { User } from '../entity/user.entity';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);

    constructor(
        private readonly mailQueueProducer: MailQueueProducer,
        @InjectRepository(CampaignEmailLog)
        private readonly emailLogRepository: Repository<CampaignEmailLog>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) { }

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

    /**
     * Build a base64url-encoded RFC 2822 MIME message for Gmail API.
     */
    buildRawEmail(dto: BuildRawEmailDto): string {
        const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        const subjectEncoded = `=?UTF-8?B?${Buffer.from(dto.subject).toString('base64')}?=`;

        const headerLines = [
            `From: ${dto.from}`,
            `To: ${dto.to.join(', ')}`,
            `Subject: ${subjectEncoded}`,
            `MIME-Version: 1.0`,
            `Content-Type: multipart/alternative; boundary="${boundary}"`,
            ...Object.entries(dto.headers ?? {}).map(([k, v]) => `${k}: ${v}`),
        ].join('\r\n');

        const textPart = [
            `--${boundary}`,
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: quoted-printable',
            '',
            dto.text ?? '',
        ].join('\r\n');

        const htmlPart = [
            `--${boundary}`,
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: quoted-printable',
            '',
            dto.html ?? '',
            `--${boundary}--`,
        ].join('\r\n');

        const raw = `${headerLines}\r\n\r\n${textPart}\r\n${htmlPart}`;
        return Buffer.from(raw).toString('base64url');
    }
}
