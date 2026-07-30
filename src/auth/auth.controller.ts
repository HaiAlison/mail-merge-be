import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  Body,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GoogleReconnectGuard } from './guards/google-reconnect.guard';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  // ─── Google OAuth ──────────────────────────────────────────────────

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  googleAuthRedirect(
    @Req()
    req: {
      user: {
        user: { id: string; email: string };
        googleAccessToken: string;
        googleRefreshToken: string;
      };
    },
    @Res() res: Response,
  ) {
    const { user } = req.user;
    const tokens = this.authService.signTokens(user);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const params = new URLSearchParams({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      userId: user.id,
    });
    res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
  }

  // ─── Google Reconnect (lấy lại refresh token) ──────────────────────

  /**
   * Redirect user đến Google consent screen.
   * Dùng khi googleRefreshToken bị mất hoặc hết hạn.
   * Frontend gọi: window.location.href = '/auth/google/reconnect'
   */
  @Get('google/reconnect')
  @UseGuards(GoogleReconnectGuard)
  async googleReconnect() {}

  /**
   * Google redirect về đây sau khi user đồng ý.
   * Lưu refresh_token mới vào DB và redirect FE.
   */
  @Get('google/reconnect/callback')
  @UseGuards(GoogleReconnectGuard)
  async googleReconnectCallback(
    @Req()
    req: {
      user: {
        user: { id: string; email: string };
        googleAccessToken: string;
        googleRefreshToken: string;
      };
    },
    @Res() res: Response,
  ) {
    const { user } = req.user;
    const tokens = this.authService.signTokens(user);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const params = new URLSearchParams({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      userId: user.id,
      reconnected: 'true',
    });
    res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
  }

  // ─── Token Management ──────────────────────────────────────────────

  /** Rotate app JWT refresh → new access + refresh pair */
  @Post('refresh')
  async refreshAppTokens(@Body() body: RefreshTokenDto) {
    return this.authService.refreshAppTokens(body.refresh_token);
  }

  /** Refresh Google OAuth access token (used before Gmail API calls) */
  @Post('google/refresh')
  async refreshGoogleToken(@Body('refresh_token') refresh_token: string) {
    return this.authService.refreshGoogleOAuthToken(refresh_token);
  }
}
