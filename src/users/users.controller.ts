import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User } from '../entity/user.entity';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@Req() req: { user: User }) {
    return this.usersService.toPublicUser(req.user);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  getUserDetail(@CurrentUser() user: User) {
    return user;
  }
}
