import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as otplib from 'otplib';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { User } from 'src/entity/user.entity';
import { RedisService } from 'src/redis/redis.service';

const ISSUER = 'MailMerge';
const BACKUP_CODE_COUNT = 8;
const MAX_MFA_ATTEMPTS = 5;

@Injectable()
export class MfaService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly redisService: RedisService,
  ) {}

  /** Generate TOTP secret + QR code. Does NOT enable MFA yet. */
  async setup(user: User) {
    const secret = otplib.generateSecret();

    await this.userRepository.update(user.id, {
      mfaSecret: secret,
      isMfaEnabled: false,
      mfaBackupCodes: null,
    });

    const otpauthUrl = otplib.generateURI({ issuer: ISSUER, label: user.email, secret });
    console.log(otpauthUrl)
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return { qrCodeDataUrl, secret };
  }

  /** Verify TOTP token against stored secret → enable MFA + return backup codes */
  async verifySetup(user: User, token: string) {
    const fullUser = await this.getUserWithMfaFields(user.id);

    if (!fullUser.mfaSecret) {
      throw new BadRequestException(
        'MFA setup has not been initiated. Call POST /auth/mfa/setup first.',
      );
    }
    if (fullUser.isMfaEnabled) {
      throw new BadRequestException('MFA is already enabled.');
    }

    const isValid = otplib.verify({
      token,
      secret: fullUser.mfaSecret,
    });
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP token.');
    }

    const backupCodes = this.generateBackupCodes();
    const hashedCodes = backupCodes.map((code) => this.hashCode(code));

    await this.userRepository.update(user.id, {
      isMfaEnabled: true,
      mfaBackupCodes: JSON.stringify(hashedCodes),
    });

    return { backupCodes };
  }

  /** Verify TOTP token → disable MFA + clear secrets */
  async disable(user: User, token: string) {
    const fullUser = await this.getUserWithMfaFields(user.id);

    if (!fullUser.isMfaEnabled) {
      throw new BadRequestException('MFA is not enabled.');
    }

    const isValid = otplib.verify({
      token,
      secret: fullUser.mfaSecret!,
    });
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP token.');
    }

    await this.userRepository.update(user.id, {
      mfaSecret: null,
      isMfaEnabled: false,
      mfaBackupCodes: null,
    });

    return { message: 'MFA has been disabled.' };
  }

  // ─── Public helpers (used by AuthService for login flow) ────────────

  /** Verify a TOTP code for a given user. Returns true if valid. */
  async verifyTotp(userId: string, token: string): Promise<boolean> {
    const attempts = await this.redisService.getMfaAttempts(userId);
    if (attempts >= MAX_MFA_ATTEMPTS) {
      throw new HttpException(
        'Exceeded maximum verification attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.getUserWithMfaFields(userId);
    if (!user.mfaSecret) return false;

    const response = await otplib.verify({ token, secret: user.mfaSecret });
    const isValid = response.valid ?? response; // Handle both object and boolean

    if (!isValid) {
      await this.redisService.incrementMfaAttempts(userId);
      return false;
    }

    await this.redisService.resetMfaAttempts(userId);
    return true;
  }

  // ─── Private helpers ───────────────────────────────────────────────

  private async getUserWithMfaFields(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'email', 'isMfaEnabled', 'mfaSecret', 'mfaBackupCodes'],
    });
    if (!user) {
      throw new BadRequestException('User not found.');
    }
    return user;
  }

  private generateBackupCodes(): string[] {
    return Array.from({ length: BACKUP_CODE_COUNT }, () =>
      crypto.randomBytes(4).toString('hex'),
    );
  }

  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }
}
