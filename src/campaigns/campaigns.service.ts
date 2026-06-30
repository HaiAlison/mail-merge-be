import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CreateRecipientDto } from './dto/create-recipient.dto';
import { Campaign } from '../entity/campaign.entity';
import { CampaignRecipient } from '../entity/campaign-recipient.entity';
import { CampaignAttachment } from '../entity/campaign-attachment.entity';
import { CampaignEmailLog } from '../entity/campaign-email-log.entity';
import 'multer';
import { handleError } from 'src/utils/common/handle';
import { uuid } from 'uuidv4';
import { JwtPayload } from 'src/auth/strategies/jwt.strategy';
import { MailQueueProducer } from '../mail/mail-queue.producer';
import { CampaignStatus } from '../entity/enums';
import { User } from '../entity/user.entity';
import { UploadType } from './campaign.type';
import { CampaignDataSource } from 'src/entity/campaign-data-source.entity';

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
  ) { }

  async create(createCampaignDto: CreateCampaignDto, jwtPayload: JwtPayload) {
    const { subject, content, recipients, attachmentIds, name, status, dataSourceId } = createCampaignDto;

    const campaign = this.campaignRepository.create({
      name,
      subject,
      content,
      totalRecipients: recipients?.length || 0,
      userId: jwtPayload.sub,
      status,
    });
    const savedCampaign = await this.campaignRepository.save(campaign);

    if (recipients?.length) {
      const recipientEntities = recipients.map((r) => {
        const { email, ...data } = r;
        return this.recipientRepository.create({
          campaign: savedCampaign,
          email,
          data,
        });
      });
      await this.recipientRepository.save(recipientEntities);
    }

    if (dataSourceId) {
      await this.datasourceRepository
        .createQueryBuilder()
        .update(CampaignDataSource)
        .set({ campaign: savedCampaign })
        .where('id = :id', { id: dataSourceId })
        .execute();
    }
    if (attachmentIds?.length) {
      // We need to use 'In' operator from typeorm, making sure it's imported
      // Or loop/query builder. simpler to use In if imported, but safely:
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
      const promiseAttachments = []
      const attachmentIds = []
      for (const file of files) {
        const id = uuid()
        switch (type) {
          case UploadType.ATTACHMENT:
            const attachment = this.attachmentRepository.create({
              id,
              fileName: file.originalname,
              filePath: file.path,
              fileSize: String(file.size),
              mimeType: file.mimetype,
            });
            promiseAttachments.push(this.attachmentRepository.save(attachment));
            attachmentIds.push(id)
            break;
          case UploadType.DATA_SOURCE:
            const dataSource = this.datasourceRepository.create({
              id,
              fileName: file.originalname,
              filePath: file.path,
              fileSize: String(file.size),
              mimeType: file.mimetype,
            });
            promiseAttachments.push(this.datasourceRepository.save(dataSource));
            attachmentIds.push(id)
            break;
        }

      }
      await Promise.all(promiseAttachments);
      return type === UploadType.DATA_SOURCE ? attachmentIds[0] : attachmentIds;
    } catch (error) {
      throw handleError(error)
    }
  }

  async addDataSource(file: MulterFile, campaignId: string) {
    try {
      const attachment = this.attachmentRepository.create({
        fileName: file.originalname,
        filePath: file.path,
        fileSize: String(file.size),
        mimeType: file.mimetype,
        campaign: await this.findOne(campaignId)
      });
      await this.attachmentRepository.save(attachment);
      return attachment;
    } catch (error) {
      throw handleError(error)
    }
  }


  findAll() {
    return this.campaignRepository.find();
  }

  async findOne(id: string) {
    const campaign = await this.campaignRepository.findOne({
      where: { id },
      relations: ['recipients', 'attachments', 'dataSource'],
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
    const recipient = this.recipientRepository.create({
      ...createRecipientDto,
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

    if (campaign.status === CampaignStatus.SENDING || campaign.status === CampaignStatus.SENT) {
      throw new BadRequestException(`Campaign is already in status: ${campaign.status}`);
    }

    const recipients = campaign.recipients ?? [];
    if (recipients.length === 0) {
      throw new BadRequestException('Campaign has no recipients');
    }

    const from = `${user.firstName ?? 'Sender'} <${user.email}>`;
    const scheduledAt = options?.scheduledAt ? new Date(options.scheduledAt) : undefined;

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
