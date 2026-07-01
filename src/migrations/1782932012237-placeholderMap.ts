import { MigrationInterface, QueryRunner } from "typeorm";

export class PlaceholderMap1782932012237 implements MigrationInterface {
    name = 'PlaceholderMap1782932012237'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "campaigns" ADD "placeholders_map" jsonb NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TYPE "public"."campaigns_status_enum" RENAME TO "campaigns_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."campaigns_status_enum" AS ENUM('draft', 'scheduled', 'sending', 'sent', 'failed', 'paused')`);
        await queryRunner.query(`ALTER TABLE "campaigns" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "campaigns" ALTER COLUMN "status" TYPE "public"."campaigns_status_enum" USING "status"::"text"::"public"."campaigns_status_enum"`);
        await queryRunner.query(`ALTER TABLE "campaigns" ALTER COLUMN "status" SET DEFAULT 'draft'`);
        await queryRunner.query(`DROP TYPE "public"."campaigns_status_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."campaigns_status_enum_old" AS ENUM('draft', 'scheduled', 'sending', 'sent', 'failed')`);
        await queryRunner.query(`ALTER TABLE "campaigns" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "campaigns" ALTER COLUMN "status" TYPE "public"."campaigns_status_enum_old" USING "status"::"text"::"public"."campaigns_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "campaigns" ALTER COLUMN "status" SET DEFAULT 'draft'`);
        await queryRunner.query(`DROP TYPE "public"."campaigns_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."campaigns_status_enum_old" RENAME TO "campaigns_status_enum"`);
        await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN "placeholders_map"`);
    }

}
