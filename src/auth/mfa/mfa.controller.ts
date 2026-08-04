import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User } from 'src/entity/user.entity';
import { MfaService } from './mfa.service';
import { MfaTokenDto } from './dto/mfa-token.dto';

@Controller('auth/mfa')
@UseGuards(AuthGuard('jwt'))
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Post('setup')
  setup(@CurrentUser() user: User) {
    return this.mfaService.setup(user);
  }

  @Post('verify-setup')
  verifySetup(@CurrentUser() user: User, @Body() dto: MfaTokenDto) {
    return this.mfaService.verifySetup(user, dto.token);
  }

  @Post('disable')
  disable(@CurrentUser() user: User, @Body() dto: MfaTokenDto) {
    return this.mfaService.disable(user, dto.token);
  }
}
