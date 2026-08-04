import { MigrationInterface, QueryRunner } from "typeorm";

export class Mfa1785764347906 implements MigrationInterface {
    name = 'Mfa1785764347906'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP CONSTRAINT "FK_notification_preferences_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notification_preferences_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_unsub_owner_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_unsub_email"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP CONSTRAINT "UQ_notification_preferences_user_type"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "mfa_secret" text`);
        await queryRunner.query(`ALTER TABLE "users" ADD "is_mfa_enabled" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "users" ADD "mfa_backup_codes" text`);
        await queryRunner.query(`CREATE INDEX "IDX_64c90edc7310c6be7c10c96f67" ON "notification_preferences" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_e34fdb9cc82c6be961574e4a3e" ON "email_unsubscribes" ("owner_user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_34fe78276da2e5aea0cf792350" ON "email_unsubscribes" ("email") `);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD CONSTRAINT "UQ_f22207503ea3210d2c18182cd4f" UNIQUE ("user_id", "notification_type")`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD CONSTRAINT "FK_64c90edc7310c6be7c10c96f675" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP CONSTRAINT "FK_64c90edc7310c6be7c10c96f675"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP CONSTRAINT "UQ_f22207503ea3210d2c18182cd4f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_34fe78276da2e5aea0cf792350"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e34fdb9cc82c6be961574e4a3e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_64c90edc7310c6be7c10c96f67"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "mfa_backup_codes"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_mfa_enabled"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "mfa_secret"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD CONSTRAINT "UQ_notification_preferences_user_type" UNIQUE ("user_id", "notification_type")`);
        await queryRunner.query(`CREATE INDEX "idx_unsub_email" ON "email_unsubscribes" ("email") `);
        await queryRunner.query(`CREATE INDEX "idx_unsub_owner_user_id" ON "email_unsubscribes" ("owner_user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_notification_preferences_user_id" ON "notification_preferences" ("user_id") `);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD CONSTRAINT "FK_notification_preferences_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
