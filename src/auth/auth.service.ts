import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { UsersService } from '../users/users.service';
import { User } from '../entity/user.entity';

export type AppTokens = {
  access_token: string;
  refresh_token: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  // ─── JWT ─────────────────────────────────────────────────────────────

  /** Issue access + refresh JWT pair for a user */
  signTokens(user: Pick<User, 'id' | 'email'>): AppTokens {
    const accessExpires =
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
    const refreshExpires =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    const access_token = this.jwtService.sign(
      { sub: user.id, email: user.email },
      {
        expiresIn: accessExpires as `${number}m` | `${number}d` | `${number}h`,
      },
    );
    const refresh_token = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      {
        expiresIn: refreshExpires as `${number}m` | `${number}d` | `${number}h`,
      },
    );
    return { access_token, refresh_token };
  }

  /** Rotate app JWT refresh token → new access + refresh pair */
  async refreshAppTokens(refreshToken: string): Promise<AppTokens> {
    try {
      const payload = this.jwtService.verify<{ sub: string; type?: string }>(
        refreshToken,
      );
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const user = await this.usersService.findById(payload.sub);
      return this.signTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────

  /** Refresh Google OAuth access token using the stored refresh token (for Gmail API calls) */
  async refreshGoogleOAuthToken(googleRefreshToken: string) {
    try {
      const response = await lastValueFrom(
        this.httpService.post('https://oauth2.googleapis.com/token', null, {
          params: {
            client_id: this.configService.get<string>('GOOGLE_CLIENT_ID'),
            client_secret: this.configService.get<string>(
              'GOOGLE_CLIENT_SECRET',
            ),
            refresh_token: googleRefreshToken,
            grant_type: 'refresh_token',
          },
        }),
      );
      return response.data;
    } catch {
      throw new InternalServerErrorException('Failed to refresh Google token');
    }
  }
}
