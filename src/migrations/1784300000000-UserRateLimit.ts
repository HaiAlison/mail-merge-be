import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserRateLimit1784300000000 implements MigrationInterface {
  name = 'UserRateLimit1784300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "rate_limit_per_minute" integer NOT NULL DEFAULT 30`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "daily_limit" integer NOT NULL DEFAULT 500`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "daily_limit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "rate_limit_per_minute"`,
    );
  }
}
