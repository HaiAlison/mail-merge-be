import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttachmentCampaign1782506324507 implements MigrationInterface {
  name = 'AttachmentCampaign1782506324507';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "campaign_attachments" ALTER COLUMN "campaign_id" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "campaign_attachments" ALTER COLUMN "campaign_id" SET NOT NULL`,
    );
  }
}
