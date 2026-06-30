import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const BLOOM_KEY = 'bloom:registered_emails';
const BLOOM_ERROR_RATE = 0.01; // 1% false positive rate
const BLOOM_CAPACITY = 10_000_000; // 10M users

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly config: ConfigService) { }

  onModuleInit() {
    this.client = new Redis(
      this.config.getOrThrow<string>('REDIS_URL'),
      {
        maxRetriesPerRequest: 3,
        // enableOfflineQueue: false,
        connectTimeout: 10_000,
        commandTimeout: 5_000,
        lazyConnect: false,
        keepAlive: 30_000,
        family: 4,
      },
    );

    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error', (err) => this.logger.error('Redis error', err));
    this.client.on('reconnecting', () =>
      this.logger.warn('Redis reconnecting...'),
    );
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  // ─── Bloom filter: email existence ──────────────────────────────────

  /**
   * Reserve the Bloom filter on startup.
   * Safe to call multiple times (idempotent — ignores "ERR item exists").
   */
  async initEmailBloom(): Promise<void> {
    try {
      await (this.client as any).call(
        'BF.RESERVE',
        BLOOM_KEY,
        BLOOM_ERROR_RATE,
        BLOOM_CAPACITY,
        'EXPANSION',
        2,
      );
      this.logger.log(
        `Bloom filter "${BLOOM_KEY}" initialized (cap=${BLOOM_CAPACITY}, fp=${BLOOM_ERROR_RATE})`,
      );
    } catch (err: any) {
      if (!err.message?.includes('ERR item exists')) {
        throw err;
      }
      // Already exists — that's fine
    }
  }

  /**
   * Seed the Bloom filter with a batch of emails (called on startup).
   * BF.MADD is idempotent — safe to re-run.
   */
  async bloomSeedEmails(emails: string[]): Promise<void> {
    if (emails.length === 0) return;
    await (this.client as any).call('BF.MADD', BLOOM_KEY, ...emails);
  }

  /**
   * Add a single email after successful DB insert.
   * Call this AFTER the user row is committed.
   */
  async bloomAddEmail(email: string): Promise<void> {
    await (this.client as any).call(
      'BF.ADD',
      BLOOM_KEY,
      email.toLowerCase().trim(),
    );
  }

  /**
   * Check email membership in the Bloom filter.
   *
   * Returns:
   *   false → email is DEFINITELY not registered (skip DB, allow signup)
   *   true  → email is POSSIBLY registered (must confirm with DB)
   *
   * Memory: ~1.2 MB per 1M emails at 1% FP rate
   * Latency: ~0.1ms
   */
  async bloomEmailExists(email: string): Promise<boolean> {
    const result = await (this.client as any).call(
      'BF.EXISTS',
      BLOOM_KEY,
      email.toLowerCase().trim(),
    );
    return result === 1;
  }

  // ─── OTP: Email passwordless login ──────────────────────────────────

  private otpKey(email: string) {
    return `otp:${email.toLowerCase().trim()}`;
  }

  /**
   * Store an OTP for an email with a TTL (default 5 minutes).
   * Overwrites any existing OTP for that email.
   */
  async setOtp(email: string, otp: string, ttlSeconds = 300): Promise<void> {
    await this.client.set(this.otpKey(email), otp, 'EX', ttlSeconds);
  }

  /** Retrieve the stored OTP for an email (null if expired or not set). */
  async getOtp(email: string): Promise<string | null> {
    return this.client.get(this.otpKey(email));
  }

  /** Delete the OTP after successful verification (prevent reuse). */
  async deleteOtp(email: string): Promise<void> {
    await this.client.del(this.otpKey(email));
  }

  /**
   * Returns the remaining TTL (seconds) for the OTP key.
   * -2 = key does not exist, -1 = no TTL (should not happen)
   * Used to enforce cooldown: reject new OTP request if TTL > 240 (< 60s since last send).
   */
  async getOtpTtl(email: string): Promise<number> {
    return this.client.ttl(this.otpKey(email));
  }
}
