import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { CursorPaginationDto } from 'src/utils/common/dto';
import { Response } from 'src/utils/interceptors/transform.interceptor';
import { CursorPaginationResponse } from 'src/utils/common/cursor-pagination';
import { Campaign } from 'src/entity/campaign.entity';
import { CampaignRecipient } from 'src/entity/campaign-recipient.entity';
import { CampaignEmailLog } from 'src/entity/campaign-email-log.entity';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(
    @Body() createCampaignDto: CreateCampaignDto,
    @CurrentUser() user: User,
  ) {
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
  findAll(@Query() pagination: CursorPaginationDto): Promise<CursorPaginationResponse<Campaign>> {
    return this.campaignsService.findAll(pagination);
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

  @Get(':id/recipients')
  @ApiOperation({
    summary: 'List Campaign Recipients',
    description: 'Cursor-paginated list of recipients for a campaign.',
  })
  findRecipients(
    @Param('id') id: string,
    @Query() pagination: CursorPaginationDto,
  ): Promise<CursorPaginationResponse<CampaignRecipient>> {
    return this.campaignsService.findRecipients(id, pagination);
  }

  @Get(':id/logs')
  @ApiOperation({
    summary: 'List Campaign Email Logs',
    description: 'Cursor-paginated list of email logs for a campaign.',
  })
  findEmailLogs(
    @Param('id') id: string,
    @Query() pagination: CursorPaginationDto,
  ): Promise<CursorPaginationResponse<CampaignEmailLog>> {
    return this.campaignsService.findEmailLogs(id, pagination);
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
    description:
      'Render mail-merge variables and enqueue all recipients to Gmail send queue. Returns immediately.',
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
    description:
      'Resumes a paused campaign, re-enqueuing failed/pending recipients.',
  })
  resumeCampaign(@Param('id') id: string, @CurrentUser() user: User) {
    return this.campaignsService.resumeCampaign(id, user);
  }
  @Post(':id/test')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Send Test Campaign',
    description:
      "Sends a test email to the specified address using the first recipient's data.",
  })
  sendTestCampaign(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() body: { email: string },
  ) {
    return this.campaignsService.sendTestCampaign(id, user, body.email);
  }
}
