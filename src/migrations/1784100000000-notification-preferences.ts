import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationPreferences1784100000000 implements MigrationInterface {
  name = 'NotificationPreferences1784100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add weekly.summary to existing notifications_type_enum
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'weekly.summary'`,
    );

    // Create subscribable notification type enum
    await queryRunner.query(
      `CREATE TYPE "public"."notification_preferences_notification_type_enum" AS ENUM('campaign.completed', 'campaign.failed', 'weekly.summary')`,
    );

    // Create notification_preferences table
    await queryRunner.query(`
      CREATE TABLE "notification_preferences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "user_id" uuid NOT NULL,
        "notification_type" "public"."notification_preferences_notification_type_enum" NOT NULL,
        "is_enabled" boolean NOT NULL DEFAULT true,
        CONSTRAINT "UQ_notification_preferences_user_type" UNIQUE ("user_id", "notification_type"),
        CONSTRAINT "PK_notification_preferences" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_notification_preferences_user_id" ON "notification_preferences" ("user_id")`,
    );

    await queryRunner.query(`
      ALTER TABLE "notification_preferences"
      ADD CONSTRAINT "FK_notification_preferences_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_preferences" DROP CONSTRAINT "FK_notification_preferences_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notification_preferences_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "notification_preferences"`);
    await queryRunner.query(
      `DROP TYPE "public"."notification_preferences_notification_type_enum"`,
    );
  }
}
