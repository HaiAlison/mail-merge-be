import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../entity/user.entity';

@Injectable()
export class GmailAuthService {
  private readonly logger = new Logger(GmailAuthService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Returns a configured OAuth2Client with a valid access token for a user.
   * Refreshes the token automatically if expired or missing.
   */
  async getOAuth2Client(userId: string): Promise<OAuth2Client> {
    const user = await this.userRepository.findOne({ where: { id: userId }, select: ["googleRefreshToken", 'id'] });

    if (!user) {
      throw new UnauthorizedException(`User ${userId} not found`);
    }

    if (!user.googleRefreshToken) {
      throw new UnauthorizedException(
        `User ${userId} has no Google refresh token. Please re-authenticate with Gmail scope.`,
      );
    }

    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');

    const oauth2Client = new OAuth2Client(clientId, clientSecret);

    oauth2Client.setCredentials({
      refresh_token: user.googleRefreshToken,
    });

    // Force a token refresh to get a valid access token
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
      this.logger.debug(`Token refreshed for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to refresh token for user ${userId}`,
        error.message,
      );
      throw new UnauthorizedException(
        `Failed to refresh Google access token for user ${userId}. Please re-authenticate.`,
      );
    }

    return oauth2Client;
  }
}
