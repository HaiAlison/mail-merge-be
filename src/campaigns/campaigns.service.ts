import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CreateRecipientDto } from './dto/create-recipient.dto';
import { Campaign } from '../entity/campaign.entity';
import { CampaignRecipient } from '../entity/campaign-recipient.entity';
import { CampaignAttachment } from '../entity/campaign-attachment.entity';
import 'multer'; // Ensure multer types are loaded if needed, or rely on global
import { handleError } from 'src/utils/common/handle';
import { UUID } from 'typeorm/driver/mongodb/bson.typings';
import { uuid } from 'uuidv4';
import { JwtPayload } from 'src/auth/strategies/jwt.strategy';

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
  ) { }

  async create(createCampaignDto: CreateCampaignDto, jwtPayload: JwtPayload) {
    const { subject, content, recipients, attachmentIds, name, status } = createCampaignDto;

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

  async processUpload(files: MulterFile[]) {
    try {
      const promiseAttachments = []
      const attachmentIds = []
      console.log(files)
      for (const file of files) {
        const id = uuid()
        const attachment = this.attachmentRepository.create({
          id,
          fileName: file.originalname,
          filePath: file.path,
          fileSize: String(file.size),
          mimeType: file.mimetype,
        });
        promiseAttachments.push(this.attachmentRepository.save(attachment));
        attachmentIds.push(id)
      }
      await Promise.all(promiseAttachments);
      return attachmentIds;
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
      relations: ['recipients', 'attachments'],
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
}
