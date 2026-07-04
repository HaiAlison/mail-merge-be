import { MigrationInterface, QueryRunner } from 'typeorm';

export class RecipientNullable1782853047650 implements MigrationInterface {
  name = 'RecipientNullable1782853047650';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "campaign_email_logs" ALTER COLUMN "recipient_id" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "campaign_email_logs" ALTER COLUMN "recipient_id" SET NOT NULL`,
    );
  }
}
