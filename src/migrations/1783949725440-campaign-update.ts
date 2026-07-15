import { MigrationInterface, QueryRunner } from "typeorm";

export class CampaignUpdate1783949725440 implements MigrationInterface {
    name = 'CampaignUpdate1783949725440'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "campaigns" ADD "signature_id" uuid`);
        await queryRunner.query(`ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipient_email_unique" UNIQUE ("campaign_id", "email")`);
        await queryRunner.query(`ALTER TABLE "campaigns" ADD CONSTRAINT "FK_0af84d19e90eb918553b883a964" FOREIGN KEY ("signature_id") REFERENCES "signatures"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "campaigns" DROP CONSTRAINT "FK_0af84d19e90eb918553b883a964"`);
        await queryRunner.query(`ALTER TABLE "campaign_recipients" DROP CONSTRAINT "campaign_recipient_email_unique"`);
        await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN "signature_id"`);
    }

}
