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
import { MfaService } from './mfa/mfa.service';
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
    private readonly mfaService: MfaService,
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

  // ─── MFA Login ────────────────────────────────────────────────────────

  /** Sign a short-lived MFA token (5 min) used during the MFA login flow */
  signMfaToken(user: Pick<User, 'id'>): string {
    return this.jwtService.sign(
      { sub: user.id, type: 'mfa' },
      { expiresIn: '5m' },
    );
  }

  /** Verify mfa_token JWT + TOTP code → issue real access + refresh tokens */
  async verifyMfaLogin(mfaToken: string, totpCode: string): Promise<AppTokens> {
    let payload: { sub: string; type?: string };
    try {
      payload = this.jwtService.verify(mfaToken);
    } catch {
      throw new UnauthorizedException('MFA token is invalid or expired.');
    }

    if (payload.type !== 'mfa') {
      throw new UnauthorizedException('Invalid MFA token.');
    }

    const isValid = await this.mfaService.verifyTotp(payload.sub, totpCode);
    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code.');
    }

    const user = await this.usersService.findById(payload.sub);
    return this.signTokens(user);
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

