import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { google } from 'googleapis';
import 'multer';
import { CampaignDataSource } from 'src/entity/campaign-data-source.entity';
import { GmailAuthService } from 'src/mail/gmail-auth.service';
import { MailService } from 'src/mail/mail.service';
import { UsersService } from 'src/users/users.service';
import { handleError } from 'src/utils/common/handle';
import { Repository } from 'typeorm';
import { uuid } from 'uuidv4';
import { CampaignAttachment } from '../entity/campaign-attachment.entity';
import { CampaignEmailLog } from '../entity/campaign-email-log.entity';
import { CampaignRecipient } from '../entity/campaign-recipient.entity';
import { Campaign } from '../entity/campaign.entity';
import { CampaignStatus } from '../entity/enums';
import { User } from '../entity/user.entity';
import { MailQueueProducer } from '../mail/mail-queue.producer';
import { CampaignQueueProducer } from './campaign-queue.producer';
import { UploadType } from './campaign.type';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CreateRecipientDto } from './dto/create-recipient.dto';
import { FileParserService } from './file-parser.service';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CursorPaginationDto } from 'src/utils/common/dto';
import { cursorPagination, CursorPaginationResponse } from 'src/utils/common/cursor-pagination';
// Define interface for Multer file since types might be missing
export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private campaignRepository: Repository<Campaign>,
    @InjectRepository(CampaignRecipient)
    private recipientRepository: Repository<CampaignRecipient>,
    @InjectRepository(CampaignAttachment)
    private attachmentRepository: Repository<CampaignAttachment>,
    @InjectRepository(CampaignDataSource)
    private datasourceRepository: Repository<CampaignDataSource>,
    @InjectRepository(CampaignEmailLog)
    private emailLogRepository: Repository<CampaignEmailLog>,
    private readonly mailQueueProducer: MailQueueProducer,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly gmailAuthService: GmailAuthService,
    private readonly fileParserService: FileParserService,
    private readonly campaignQueueProducer: CampaignQueueProducer,
  ) { }

  async create(createCampaignDto: CreateCampaignDto, user: User) {
    const {
      subject,
      content,
      placeholders,
      placeholdersMap,
      attachmentIds,
      name,
      status,
      dataSourceId,
    } = createCampaignDto;

    const campaign = this.campaignRepository.create({
      name,
      subject,
      content,
      totalRecipients: 0,
      userId: user.id,
      status,
      placeholders: placeholders,
      placeholdersMap: placeholdersMap || {},
    });
    const savedCampaign = await this.campaignRepository.save(campaign);

    if (dataSourceId) {
      // Link data source to campaign
      const dataSource = await this.datasourceRepository.findOne({
        where: { id: dataSourceId },
      });
      await this.datasourceRepository
        .createQueryBuilder()
        .update(Campaign)
        .set({ dataSourceId: dataSourceId })
        .where('id = :id', { id: campaign.id })
        .execute();

      // Enqueue background parse job
      if (dataSource) {
        await this.campaignQueueProducer.enqueueParseFile({
          campaignId: savedCampaign.id,
          dataSourceId,
          filePath: dataSource.filePath,
          mimeType: dataSource.mimeType,
          placeholdersMap: placeholdersMap || {},
          userId: user.id,
        });
      }
    }

    if (attachmentIds?.length) {
      await this.attachmentRepository
        .createQueryBuilder()
        .update(CampaignAttachment)
        .set({ campaign: savedCampaign })
        .where('id IN (:...ids)', { ids: attachmentIds })
        .execute();
    }

    return this.findOne(savedCampaign.id);
  }

  async processUpload(files: MulterFile[], type: UploadType) {
    try {
      const results: { id: string; headers?: string[] }[] = [];

      for (const file of files) {
        const id = uuid();
        switch (type) {
          case UploadType.ATTACHMENT: {
            const attachment = this.attachmentRepository.create({
              id,
              fileName: file.originalname,
              filePath: file.path,
              fileSize: String(file.size),
              mimeType: file.mimetype,
            });
            await this.attachmentRepository.save(attachment);
            results.push({ id });
            break;
          }
          case UploadType.DATA_SOURCE: {
            const dataSource = this.datasourceRepository.create({
              id,
              fileName: file.originalname,
              filePath: file.path,
              fileSize: String(file.size),
              mimeType: file.mimetype,
            });
            await this.datasourceRepository.save(dataSource);

            // Extract headers and preview rows for FE to use in mapping and review
            const preview = await this.fileParserService.extractPreview(
              file.path,
              file.mimetype,
              3,
            );
            results.push({
              id,
              headers: preview.headers,
              previewRows: preview.previewRows,
            } as any);
            break;
          }
        }
      }

      if (type === UploadType.DATA_SOURCE) {
        return results[0]; // { id, headers }
      }
      return results.map((r) => r.id); // attachment IDs array
    } catch (error) {
      throw handleError(error);
    }
  }

  async addDataSource(file: MulterFile, campaignId: string) {
    try {
      const attachment = this.attachmentRepository.create({
        fileName: file.originalname,
        filePath: file.path,
        fileSize: String(file.size),
        mimeType: file.mimetype,
        campaign: await this.findOne(campaignId),
      });
      await this.attachmentRepository.save(attachment);
      return attachment;
    } catch (error) {
      throw handleError(error);
    }
  }

  async findAll(pagination: CursorPaginationDto): Promise<CursorPaginationResponse<Campaign>> {
    const queryBuilder = this.campaignRepository.createQueryBuilder('campaign');
    return await cursorPagination(queryBuilder, pagination)
  }

  async findOne(id: string) {
    const campaign = await this.campaignRepository.findOne({
      where: { id },
      relations: ['recipients', 'attachments', 'dataSource', 'emailLogs'],
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID "${id}" not found`);
    }
    return campaign;
  }

  async update(id: string, updateCampaignDto: UpdateCampaignDto) {
    await this.findOne(id); // Ensure exists
    await this.campaignRepository.update(id, updateCampaignDto);
    return this.findOne(id);
  }

  async remove(id: string) {
    const result = await this.campaignRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Campaign with ID "${id}" not found`);
    }
    return { deleted: true };
  }

  async addRecipient(
    campaignId: string,
    createRecipientDto: CreateRecipientDto,
  ) {
    const campaign = await this.findOne(campaignId);

    const mappedData: Record<string, any> = {};
    if (campaign.placeholdersMap) {
      for (const [origKey, val] of Object.entries(
        createRecipientDto.data || {},
      )) {
        const mappedKey = campaign.placeholdersMap[origKey];
        mappedData[mappedKey || origKey] = val;
      }
    } else {
      Object.assign(mappedData, createRecipientDto.data || {});
    }

    const recipient = this.recipientRepository.create({
      ...createRecipientDto,
      data: mappedData,
      campaign,
    });
    await this.recipientRepository.save(recipient);

    // Update total recipients count
    await this.campaignRepository.increment(
      { id: campaignId },
      'totalRecipients',
      1,
    );
    return recipient;
  }

  async updateRecipientStatus(id: string, status: any, errorMessage?: string) {
    return this.recipientRepository.update(id, {
      status,
      errorMessage,
      sentAt: status === 'sent' ? new Date() : null,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SEND CAMPAIGN
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * POST /campaigns/:id/send
   * Renders mail-merge variables per recipient and enqueues batch to BullMQ.
   * Inspired by Resend's POST /emails/batch.
   */
  async sendCampaign(
    campaignId: string,
    user: User,
    options?: { scheduledAt?: string },
  ) {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
      relations: ['recipients'],
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    if (campaign.userId !== user.id) {
      throw new BadRequestException('You do not own this campaign');
    }

    if (
      campaign.status === CampaignStatus.SENDING ||
      campaign.status === CampaignStatus.SENT
    ) {
      throw new BadRequestException(
        `Campaign is already in status: ${campaign.status}`,
      );
    }

    const recipients = campaign.recipients ?? [];
    if (recipients.length === 0) {
      throw new BadRequestException('Campaign has no recipients');
    }

    const from = `${user.firstName ?? 'Sender'} <${user.email}>`;
    const scheduledAt = options?.scheduledAt
      ? new Date(options.scheduledAt)
      : undefined;

    // 1. Create email log entries for each recipient
    const logs = this.emailLogRepository.create(
      recipients.map((r) => ({
        campaignId,
        recipientId: r.id,
        status: scheduledAt ? 'scheduled' : 'queued',
        metadata: {
          from,
          to: [r.email],
          subject: campaign.subject,
        },
      })),
    );
    const savedLogs = await this.emailLogRepository.save(logs);

    // 2. Render mail-merge variables and build job payloads
    const payloads = recipients.map((recipient, i) => ({
      emailLogId: savedLogs[i].id,
      userId: user.id,
      campaignId,
      recipientId: recipient.id,
      from,
      to: [recipient.email],
      subject: renderTemplate(campaign.subject, recipient.data),
      html: renderTemplate(campaign.content, recipient.data),
      idempotencyKey: `${campaignId}_${recipient.id}`,
    }));

    // 3. Enqueue batch
    await this.mailQueueProducer.enqueueBatch(payloads, { scheduledAt });

    // 4. Update campaign status
    await this.campaignRepository.update(campaignId, {
      status: scheduledAt ? CampaignStatus.SCHEDULED : CampaignStatus.SENDING,
      ...(scheduledAt ? { scheduledAt } : {}),
    });

    return {
      campaignId,
      queued: recipients.length,
      scheduledAt: scheduledAt?.toISOString() ?? null,
    };
  }

  async resumeCampaign(campaignId: string, user: User) {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
      relations: ['recipients'],
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    if (campaign.userId !== user.id) {
      throw new BadRequestException('You do not own this campaign');
    }

    if (campaign.status !== CampaignStatus.PAUSED) {
      throw new BadRequestException(
        `Campaign is not paused, current status: ${campaign.status}`,
      );
    }

    const recipients = campaign.recipients ?? [];
    if (recipients.length === 0) {
      throw new BadRequestException('Campaign has no recipients');
    }

    // Filter recipients that are not successfully sent yet
    const pendingRecipients = recipients.filter(
      (r) => r.status !== ('sent' as any),
    );

    if (pendingRecipients.length === 0) {
      await this.campaignRepository.update(campaignId, {
        status: CampaignStatus.SENT,
      });
      return { campaignId, resumed: 0 };
    }

    const from = `${user.firstName ?? 'Sender'} <${user.email}>`;

    // 1. Create email log entries for the pending recipients
    const logs = this.emailLogRepository.create(
      pendingRecipients.map((r) => ({
        campaignId,
        recipientId: r.id,
        status: 'queued',
        metadata: {
          from,
          to: [r.email],
          subject: campaign.subject,
          resumedAt: new Date().toISOString(),
        },
      })),
    );
    const savedLogs = await this.emailLogRepository.save(logs);

    // 2. Render mail-merge variables and build job payloads
    const payloads = pendingRecipients.map((recipient, i) => ({
      emailLogId: savedLogs[i].id,
      userId: user.id,
      campaignId,
      recipientId: recipient.id,
      from,
      to: [recipient.email],
      subject: renderTemplate(campaign.subject, recipient.data),
      html: renderTemplate(campaign.content, recipient.data),
      idempotencyKey: `${campaignId}_resume_${recipient.id}_${savedLogs[i].id}`,
    }));

    // 3. Enqueue batch
    await this.mailQueueProducer.enqueueBatch(payloads);

    // 4. Update campaign status
    await this.campaignRepository.update(campaignId, {
      status: CampaignStatus.SENDING,
    });

    return {
      campaignId,
      resumed: pendingRecipients.length,
    };
  }

  async sendTestCampaign(campaignId: string, user: User, testEmail: string) {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
      relations: ['recipients'],
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    console.log(campaign.userId, user.id);
    if (campaign.userId !== user.id) {
      throw new BadRequestException('You do not own this campaign');
    }

    const from = `${user.firstName ?? 'Sender'} <${user.email}>`;

    // Use first recipient's data if available, or dummy data
    const dummyData = campaign.recipients?.[0]?.data ?? {};

    // 1. Create email log entry for the test email
    const log = this.emailLogRepository.create({
      campaignId,
      status: 'queued',
      metadata: {
        from,
        to: [testEmail],
        subject: campaign.subject,
        isTest: true,
      },
    });
    const savedLog = await this.emailLogRepository.save(log);

    // 2. Render mail-merge variables and build job payload
    const payload = {
      emailLogId: savedLog.id,
      userId: user.id,
      campaignId,
      from,
      to: [testEmail],
      subject: renderTemplate(campaign.subject, dummyData),
      html: renderTemplate(campaign.content, dummyData),
      idempotencyKey: `${campaignId}_test_${savedLog.id}`,
      isTest: true,
    };

    // 3. Get OAuth2 client
    const oauth2Client = await this.gmailAuthService.getOAuth2Client(user.id);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // 4. Build raw MIME message
    const raw = this.mailService.buildRawEmail(payload);

    // 5. Send directly via Gmail API
    try {
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      });

      const gmailMessageId = response.data.id;

      // Update log to 'sent'
      await this.emailLogRepository.update(savedLog.id, {
        status: 'sent',
        metadata: {
          ...savedLog.metadata,
          gmailMessageId,
          sentAt: new Date().toISOString(),
        } as any,
      });

      return {
        campaignId,
        testEmail,
        status: 'success',
        gmailMessageId,
      };
    } catch (error) {
      // Update log to 'failed'
      await this.emailLogRepository.update(savedLog.id, {
        status: 'failed',
        metadata: { ...savedLog.metadata, error: error.message } as any,
      });

      throw new BadRequestException(
        `Failed to send test email: ${error.message}`,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: render {{placeholder}} mail-merge template
// ─────────────────────────────────────────────────────────────────────────────

function renderTemplate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const value = data[key];
    return value !== undefined && value !== null ? String(value) : `{{${key}}}`;
  });
}
