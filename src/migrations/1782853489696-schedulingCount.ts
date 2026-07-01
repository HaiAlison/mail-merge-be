import { MigrationInterface, QueryRunner } from "typeorm";

export class SchedulingCount1782853489696 implements MigrationInterface {
    name = 'SchedulingCount1782853489696'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "campaigns" ADD "scheduling_count" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN "scheduling_count"`);
    }

}
