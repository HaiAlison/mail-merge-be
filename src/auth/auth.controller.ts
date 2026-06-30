import { Controller, Get, Post, Req, Res, UseGuards, Body } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) { }

  // ─── Google OAuth ──────────────────────────────────────────────────

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() { }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  googleAuthRedirect(
    @Req()
    req: {
      user: {
        user: { id: string; email: string };
        googleAccessToken: string;
      };
    },
    @Res() res: Response,
  ) {
    const { user, googleAccessToken } = req.user;
    const tokens = this.authService.signTokens(user);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const params = new URLSearchParams({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      userId: user.id,
      googleAccessToken,
    });
    res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
  }

  // ─── Token Management ──────────────────────────────────────────────

  /** Rotate app JWT refresh → new access + refresh pair */
  @Post('refresh')
  async refreshAppTokens(@Body() body: RefreshTokenDto) {
    return this.authService.refreshAppTokens(body.refreshToken);
  }

  /** Refresh Google OAuth access token (used before Gmail API calls) */
  @Post('google/refresh')
  async refreshGoogleToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshGoogleOAuthToken(refreshToken);
  }
}
