import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MailService } from './mail.service';
import {
  SendEmailDto,
  SendEmailResponseDto,
  GetEmailResponseDto,
} from './dto/send-email.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entity/user.entity';

@ApiTags('Mail')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  /**
   * POST /mail/send
   * Enqueue a single email to be sent via Gmail API.
   * Inspired by Resend's POST /emails endpoint.
   */
  @Post('send')
  @ApiOperation({
    summary: 'Send Email',
    description:
      'Enqueue a single email for delivery via Gmail API. Returns immediately with an email log ID.',
  })
  @ApiResponse({
    status: 201,
    description: 'Email enqueued successfully',
    type: SendEmailResponseDto,
  })
  async sendMail(
    @Body() dto: SendEmailDto,
    @CurrentUser() user: User,
  ): Promise<SendEmailResponseDto> {
    return this.mailService.sendEmail(dto, user.id);
  }

  /**
   * GET /mail/:id
   * Retrieve status of a sent email by its log ID.
   * Inspired by Resend's GET /emails/:id endpoint.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Retrieve Email Status',
    description: 'Get status and metadata of a previously enqueued email.',
  })
  @ApiResponse({
    status: 200,
    description: 'Email log found',
    type: GetEmailResponseDto,
  })
  async getEmail(@Param('id') id: string): Promise<GetEmailResponseDto> {
    return this.mailService.getEmail(id);
  }
}
