import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as jwt from 'jsonwebtoken';
import { EmailUnsubscribe } from 'src/entity/email-unsubscribe.entity';
import { Repository } from 'typeorm';

export interface UnsubscribeTokenPayload {
  ownerUserId: string;
  email: string;
  campaignId?: string;
}

@Injectable()
export class UnsubscribeService {
  private readonly logger = new Logger(UnsubscribeService.name);
  private readonly secret: string;
  /** Base URL của app — dùng để build link unsubscribe */
  private readonly appUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(EmailUnsubscribe)
    private readonly unsubscribeRepository: Repository<EmailUnsubscribe>,
  ) {
    this.secret = this.configService.getOrThrow<string>(
      'UNSUBSCRIBE_JWT_SECRET',
    );
    this.appUrl = this.configService.get<string>('FRONTEND_URL');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Token helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generates a signed JWT for the unsubscribe link.
   * No expiry — the unsubscribe right should not expire.
   */
  generateToken(payload: UnsubscribeTokenPayload): string {
    return jwt.sign(payload, this.secret, { algorithm: 'HS256' });
  }

  verifyToken(token: string): UnsubscribeTokenPayload {
    try {
      return jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
      }) as UnsubscribeTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid or tampered unsubscribe token');
    }
  }

  /**
   * Builds the full unsubscribe URL to embed in the email.
   * e.g. https://api.example.com/unsubscribe?token=xxx
   */
  buildUnsubscribeUrl(payload: UnsubscribeTokenPayload): string {
    const token = this.generateToken(payload);
    return `${this.appUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Core logic
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Marks an email as unsubscribed from all campaigns of ownerUserId.
   * Idempotent — calling twice is safe (conflict is ignored).
   */
  async unsubscribe(token: string): Promise<{ email: string }> {
    const payload = this.verifyToken(token);
    const { ownerUserId, email, campaignId } = payload;

    if (!ownerUserId || !email) {
      throw new BadRequestException('Token missing required fields');
    }

    await this.unsubscribeRepository
      .createQueryBuilder()
      .insert()
      .into(EmailUnsubscribe)
      .values({
        ownerUserId,
        email: email.toLowerCase().trim(),
        sourceCampaignId: campaignId ?? null,
      })
      .orIgnore() // ON CONFLICT DO NOTHING — idempotent
      .execute();

    this.logger.log(`Unsubscribed ${email} from owner ${ownerUserId}`);
    return { email };
  }

  /**
   * Checks whether an email has unsubscribed from a given owner's campaigns.
   */
  async isUnsubscribed(ownerUserId: string, email: string): Promise<boolean> {
    const count = await this.unsubscribeRepository.count({
      where: { ownerUserId, email: email.toLowerCase().trim() },
    });
    return count > 0;
  }

  /**
   * Filters out unsubscribed emails from a list.
   * Returns only emails that are NOT in the unsubscribe list.
   */
  async filterUnsubscribed(
    ownerUserId: string,
    emails: string[],
  ): Promise<string[]> {
    if (emails.length === 0) return [];

    const normalised = emails.map((e) => e.toLowerCase().trim());

    const unsubscribed = await this.unsubscribeRepository
      .createQueryBuilder('u')
      .select('u.email')
      .where('u.owner_user_id = :ownerUserId', { ownerUserId })
      .andWhere('u.email IN (:...emails)', { emails: normalised })
      .getMany();

    const unsubscribedSet = new Set(unsubscribed.map((u) => u.email));
    return emails.filter((e) => !unsubscribedSet.has(e.toLowerCase().trim()));
  }
}
