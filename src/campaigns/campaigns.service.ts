import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { Campaign } from '../entity/campaign.entity';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private campaignRepository: Repository<Campaign>,
  ) { }

  create(createCampaignDto: CreateCampaignDto) {
    const campaign = this.campaignRepository.create(createCampaignDto);
    return this.campaignRepository.save(campaign);
  }

  findAll() {
    return this.campaignRepository.find();
  }

  async findOne(id: string) {
    const campaign = await this.campaignRepository.findOne({ where: { id } });
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
}
