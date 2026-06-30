import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CreateRecipientDto } from './dto/create-recipient.dto';
import { JwtPayload } from 'src/auth/strategies/jwt.strategy';
import { AuthUser } from 'src/utils/permission/user.decorator';
import { ApiAuthBearerGuard } from 'src/utils/api-auth-bearer/api-auth-bearer.guard';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entity/user.entity';
import { ApiBody, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UploadType } from './campaign.type';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) { }

  @Post()
  @UseGuards(ApiAuthBearerGuard)
  create(@Body() createCampaignDto: CreateCampaignDto, @AuthUser() jwtPayload: JwtPayload) {
    return this.campaignsService.create(createCampaignDto, jwtPayload);
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
}
