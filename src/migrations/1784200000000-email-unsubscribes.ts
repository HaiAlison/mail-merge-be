import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailUnsubscribes1784200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "email_unsubscribes" (
        "id"                 uuid              NOT NULL DEFAULT gen_random_uuid(),
        "owner_user_id"      uuid              NOT NULL,
        "email"              varchar(255)      NOT NULL,
        "source_campaign_id" uuid              NULL,
        "unsubscribed_at"    timestamptz       NOT NULL DEFAULT now(),
        CONSTRAINT "pk_email_unsubscribes" PRIMARY KEY ("id"),
        CONSTRAINT "uq_unsubscribe_owner_email" UNIQUE ("owner_user_id", "email")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_unsub_owner_user_id" ON "email_unsubscribes" ("owner_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_unsub_email" ON "email_unsubscribes" ("email")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "email_unsubscribes"`);
  }
}
