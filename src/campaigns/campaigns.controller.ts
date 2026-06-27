import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  Inject,
  forwardRef,
  UploadedFiles,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CreateRecipientDto } from './dto/create-recipient.dto';
import { JwtPayload } from 'src/auth/strategies/jwt.strategy';
import { AuthUser } from 'src/utils/permission/user.decorator';
import { ApiAuthBearerGuard } from 'src/utils/api-auth-bearer/api-auth-bearer.guard';

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
    return this.campaignsService.processUpload(files);
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
}
