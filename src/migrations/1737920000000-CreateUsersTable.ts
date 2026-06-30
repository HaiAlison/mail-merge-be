import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1737920000000 implements MigrationInterface {
  name = 'CreateUsersTable1737920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "google_provider_id" character varying(255) NOT NULL,
        "email" character varying(255) NOT NULL,
        "first_name" character varying(255),
        "last_name" character varying(255),
        "picture" text,
        "google_refresh_token" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_google_provider_id" ON "users" ("google_provider_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_email" ON "users" ("email")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_users_email"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_users_google_provider_id"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
