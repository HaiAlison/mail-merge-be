import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from '../entity/user.entity';
import { ApiAuthBearerGuard } from 'src/utils/api-auth-bearer/api-auth-bearer.guard';
import { AuthUser } from 'src/utils/permission/user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get('me')
  getMe(@Req() req: { user: User }) {
    return this.usersService.toPublicUser(req.user);
  }

  @Get()
  @UseGuards(ApiAuthBearerGuard)
  getUserDetail(@AuthUser() jwtPayload) {
    const user = this.usersService.findById(jwtPayload.sub)
    return user;
  }
}
