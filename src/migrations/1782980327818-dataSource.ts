import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSource1782980327818 implements MigrationInterface {
    name = 'DataSource1782980327818'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "campaign_data_source" DROP CONSTRAINT "FK_76fe9a62c4d711864f6d8cab824"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_76fe9a62c4d711864f6d8cab82"`);
        await queryRunner.query(`ALTER TABLE "campaign_data_source" DROP CONSTRAINT "REL_76fe9a62c4d711864f6d8cab82"`);
        await queryRunner.query(`ALTER TABLE "campaign_data_source" DROP COLUMN "campaign_id"`);
        await queryRunner.query(`ALTER TABLE "campaigns" ADD "data_source_id" uuid`);
        await queryRunner.query(`ALTER TABLE "campaigns" ADD CONSTRAINT "UQ_d9102a1c4f89710bc6837a22193" UNIQUE ("data_source_id")`);
        await queryRunner.query(`ALTER TABLE "campaigns" ADD CONSTRAINT "FK_d9102a1c4f89710bc6837a22193" FOREIGN KEY ("data_source_id") REFERENCES "campaign_data_source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "campaigns" DROP CONSTRAINT "FK_d9102a1c4f89710bc6837a22193"`);
        await queryRunner.query(`ALTER TABLE "campaigns" DROP CONSTRAINT "UQ_d9102a1c4f89710bc6837a22193"`);
        await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN "data_source_id"`);
        await queryRunner.query(`ALTER TABLE "campaign_data_source" ADD "campaign_id" uuid`);
        await queryRunner.query(`ALTER TABLE "campaign_data_source" ADD CONSTRAINT "REL_76fe9a62c4d711864f6d8cab82" UNIQUE ("campaign_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_76fe9a62c4d711864f6d8cab82" ON "campaign_data_source" ("campaign_id") `);
        await queryRunner.query(`ALTER TABLE "campaign_data_source" ADD CONSTRAINT "FK_76fe9a62c4d711864f6d8cab824" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
