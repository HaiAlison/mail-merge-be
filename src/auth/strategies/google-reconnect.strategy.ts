import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

/**
 * Strategy riêng cho reconnect flow.
 * Tên: 'google-reconnect' — dùng với @UseGuards(GoogleReconnectGuard).
 *
 * Điểm khác vs GoogleStrategy:
 *  - callbackURL: /auth/google/reconnect/callback
 *  - accessType: 'offline' + prompt: 'consent' → Google luôn trả về refresh_token
 */
@Injectable()
export class GoogleReconnectStrategy extends PassportStrategy(
  Strategy,
  'google-reconnect',
) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || '',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || '',
      callbackURL:
        configService.get<string>('GOOGLE_RECONNECT_CALLBACK_URL') ||
        configService
          .get<string>('GOOGLE_CALLBACK_URL', '')
          .replace('/callback', '/reconnect/callback'),
      scope: [
        'email',
        'profile',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.settings.basic',
      ],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): Promise<{
    user: ReturnType<UsersService['toPublicUser']>;
    googleAccessToken: string;
    googleRefreshToken: string;
  }> {
    const { name, emails, photos } = profile;
    const email = emails?.[0]?.value;
    if (!email) {
      throw new UnauthorizedException('Google account has no email');
    }

    if (!refreshToken) {
      throw new UnauthorizedException(
        'Google did not return a refresh token. Please revoke access at https://myaccount.google.com/permissions and try again.',
      );
    }

    // Lưu refresh_token mới vào DB
    const user = await this.usersService.upsertGoogleUser({
      googleProviderId: profile.id,
      email,
      firstName: name?.givenName,
      lastName: name?.familyName,
      picture: photos?.[0]?.value,
      googleRefreshToken: refreshToken,
    });

    return {
      user: this.usersService.toPublicUser(user),
      googleAccessToken: accessToken,
      googleRefreshToken: refreshToken,
    };
  }
}
