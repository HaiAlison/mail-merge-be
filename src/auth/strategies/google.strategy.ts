import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || '',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || '',
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL') || '',
      scope: ['email', 'profile', 'https://www.googleapis.com/auth/gmail.send'],
    });
  }

  /**
   * Lần đầu: tạo user + lưu Google refresh token (nếu Google trả về).
   * Lần sau: cùng Google account → upsert theo googleProviderId, cập nhật refresh token nếu có mới.
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): Promise<{
    user: ReturnType<UsersService['toPublicUser']>;
    googleAccessToken: string;
  }> {
    const { name, emails, photos } = profile;
    const email = emails?.[0]?.value;
    if (!email) {
      throw new UnauthorizedException('Google account has no email');
    }

    const user = await this.usersService.upsertGoogleUser({
      googleProviderId: profile.id,
      email,
      firstName: name?.givenName,
      lastName: name?.familyName,
      picture: photos?.[0]?.value,
      googleRefreshToken: refreshToken || undefined,
    });

    return {
      user: this.usersService.toPublicUser(user),
      googleAccessToken: accessToken,
    };
  }
}
