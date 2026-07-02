import { MigrationInterface, QueryRunner } from "typeorm";

export class AddParseStatus1782963336149 implements MigrationInterface {
    name = 'AddParseStatus1782963336149'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."campaigns_parse_status_enum" AS ENUM('pending', 'processing', 'done', 'failed')`);
        await queryRunner.query(`ALTER TABLE "campaigns" ADD "parse_status" "public"."campaigns_parse_status_enum" NOT NULL DEFAULT 'pending'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN "parse_status"`);
        await queryRunner.query(`DROP TYPE "public"."campaigns_parse_status_enum"`);
    }

}
