import { MigrationInterface, QueryRunner } from "typeorm";

export class CampaignIndex1783211684260 implements MigrationInterface {
    name = 'CampaignIndex1783211684260'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "campaign_attachments" ADD "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "campaign_attachments" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "campaign_email_logs" ADD "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "campaign_email_logs" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "campaign_recipients" ADD "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "campaign_recipients" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "campaigns" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "campaigns" ALTER COLUMN "updated_at" DROP NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "cursor_index_campaigns" ON "campaigns" ("created_at", "id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."cursor_index_campaigns"`);
        await queryRunner.query(`ALTER TABLE "campaigns" ALTER COLUMN "updated_at" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "campaign_recipients" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "campaign_recipients" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "campaign_email_logs" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "campaign_email_logs" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "campaign_attachments" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "campaign_attachments" DROP COLUMN "updated_at"`);
    }

}
