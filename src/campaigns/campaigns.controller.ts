import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entity/user.entity';
import { UploadType } from './campaign.type';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CreateRecipientDto } from './dto/create-recipient.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) { }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createCampaignDto: CreateCampaignDto, @CurrentUser() user: User) {
    return this.campaignsService.create(createCampaignDto, user);
  }

  @Post('/attachments')
  @UseInterceptors(FilesInterceptor('files', 10, { dest: './uploads' }))
  uploadFile(@UploadedFiles() files: any) {
    return this.campaignsService.processUpload(files, UploadType.ATTACHMENT);
  }

  @Post('/data-source')
  @UseInterceptors(FileInterceptor('file', { dest: './uploads' }))
  uploadDataSource(@UploadedFile() file: any) {
    return this.campaignsService.processUpload([file], UploadType.DATA_SOURCE);
  }


  @Get()
  findAll() {
    return this.campaignsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(id, updateCampaignDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.campaignsService.remove(id);
  }

  @Post(':id/recipients')
  addRecipient(
    @Param('id') id: string,
    @Body() createRecipientDto: CreateRecipientDto,
  ) {
    return this.campaignsService.addRecipient(id, createRecipientDto);
  }

  /**
   * POST /campaigns/:id/send
   * Trigger sending of all recipients in a campaign via Gmail API.
   * Supports optional `scheduledAt` for delayed delivery.
   */
  @Post(':id/send')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Send Campaign',
    description: 'Render mail-merge variables and enqueue all recipients to Gmail send queue. Returns immediately.',
  })
  sendCampaign(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() body: { scheduledAt?: string },
  ) {
    return this.campaignsService.sendCampaign(id, user, body);
  }

  @Post(':id/resume')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Resume Campaign',
    description: 'Resumes a paused campaign, re-enqueuing failed/pending recipients.',
  })
  resumeCampaign(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.campaignsService.resumeCampaign(id, user);
  }

  @Post(':id/test')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Send Test Campaign',
    description: 'Sends a test email to the specified address using the first recipient\'s data.',
  })
  sendTestCampaign(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() body: { email: string },
  ) {
    return this.campaignsService.sendTestCampaign(id, user, body.email);
  }
}
