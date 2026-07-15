import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { SignaturesService } from './signatures.service';
import { CreateSignatureDto } from './dto/signature.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User } from 'src/entity/user.entity';
import { CursorPaginationDto } from 'src/utils/common/dto';
import { UpdateSignatureDto } from './dto/update-signature.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('signatures')
export class SignaturesController {
  constructor(private readonly signaturesService: SignaturesService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createSignature(
    @Body() createSignatureDto: CreateSignatureDto,
    @CurrentUser() user: User
  ) {
    return this.signaturesService.createSignature(user.id, createSignatureDto);
  }

  @Post('attachment')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('file'))
  async uploadSignatureAttachment(
    @UploadedFile() file,
    @CurrentUser() user: User
  ) {
    return this.signaturesService.uploadSignatureAttachment(file, user.id);
  }


  @Post('sync')
  @UseGuards(AuthGuard('jwt'))
  async syncSignature(@CurrentUser() user: User) {
    return this.signaturesService.syncSignature(user);
  }
  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  async updateSignature(
    @Param('id') id: string,
    @Body() updateSignatureDto: UpdateSignatureDto,
    @CurrentUser() user: User
  ) {
    return this.signaturesService.updateSignature(id, updateSignatureDto, user.id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async deleteSignature(
    @Param('id') id: string,
    @CurrentUser() user: User
  ) {
    return this.signaturesService.deleteSignature(id, user.id);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async getAllSignatures(
    @CurrentUser() user: User,
    @Query() pagination: CursorPaginationDto
  ) {
    return this.signaturesService.getAllSignatures(pagination, user.id);
  }
}
