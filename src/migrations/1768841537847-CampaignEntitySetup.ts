import { MigrationInterface, QueryRunner } from 'typeorm';

export class CampaignEntitySetup1768841537847 implements MigrationInterface {
  name = 'CampaignEntitySetup1768841537847';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."campaign_recipients_status_enum" AS ENUM('pending', 'sent', 'failed', 'bounced')`,
    );
    await queryRunner.query(
      `CREATE TABLE "campaign_recipients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "campaign_id" uuid NOT NULL, "email" character varying(255) NOT NULL, "data" jsonb NOT NULL DEFAULT '{}', "status" "public"."campaign_recipients_status_enum" NOT NULL DEFAULT 'pending', "sent_at" TIMESTAMP WITH TIME ZONE, "error_message" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_30d346f6af084aa7b916945a4f1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_37f67f778844dcc3a0d641a617" ON "campaign_recipients" ("campaign_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cd1c7a0260c46906e79fc86068" ON "campaign_recipients" ("email") `,
    );
    await queryRunner.query(
      `CREATE TABLE "campaign_attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "campaign_id" uuid NOT NULL, "file_name" character varying(255) NOT NULL, "file_path" text NOT NULL, "file_size" bigint NOT NULL, "mime_type" character varying(100), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9a0fd016d6f1c5c603f7705bfa7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8d55fbe79ee7db4c4e8f352ebd" ON "campaign_attachments" ("campaign_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "campaign_email_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "campaign_id" uuid NOT NULL, "recipient_id" uuid NOT NULL, "status" character varying(50) NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c6d13432d2bde109705e0a12bef" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6492c9c65ca7e75f8b627c2af2" ON "campaign_email_logs" ("campaign_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_002c4612dddd7b07f5a6d5a58d" ON "campaign_email_logs" ("recipient_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."campaigns_status_enum" AS ENUM('draft', 'scheduled', 'sending', 'sent', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "campaigns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "subject" character varying(500) NOT NULL, "content" text NOT NULL, "placeholders" text array NOT NULL DEFAULT '{}', "status" "public"."campaigns_status_enum" NOT NULL DEFAULT 'draft', "total_recipients" integer NOT NULL DEFAULT '0', "sent_count" integer NOT NULL DEFAULT '0', "failed_count" integer NOT NULL DEFAULT '0', "scheduled_at" TIMESTAMP WITH TIME ZONE, "sent_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_831e3fcd4fc45b4e4c3f57a9ee4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_45455b21195721407322ddce00" ON "campaigns" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8b6b94352da69af03dbaf87c63" ON "campaigns" ("status") `,
    );
    await queryRunner.query(
      `ALTER TABLE "campaign_recipients" ADD CONSTRAINT "FK_37f67f778844dcc3a0d641a6173" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaign_attachments" ADD CONSTRAINT "FK_8d55fbe79ee7db4c4e8f352ebdf" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaign_email_logs" ADD CONSTRAINT "FK_6492c9c65ca7e75f8b627c2af2e" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "campaign_email_logs" DROP CONSTRAINT "FK_6492c9c65ca7e75f8b627c2af2e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaign_attachments" DROP CONSTRAINT "FK_8d55fbe79ee7db4c4e8f352ebdf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaign_recipients" DROP CONSTRAINT "FK_37f67f778844dcc3a0d641a6173"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8b6b94352da69af03dbaf87c63"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_45455b21195721407322ddce00"`,
    );
    await queryRunner.query(`DROP TABLE "campaigns"`);
    await queryRunner.query(`DROP TYPE "public"."campaigns_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_002c4612dddd7b07f5a6d5a58d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6492c9c65ca7e75f8b627c2af2"`,
    );
    await queryRunner.query(`DROP TABLE "campaign_email_logs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8d55fbe79ee7db4c4e8f352ebd"`,
    );
    await queryRunner.query(`DROP TABLE "campaign_attachments"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cd1c7a0260c46906e79fc86068"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_37f67f778844dcc3a0d641a617"`,
    );
    await queryRunner.query(`DROP TABLE "campaign_recipients"`);
    await queryRunner.query(
      `DROP TYPE "public"."campaign_recipients_status_enum"`,
    );
  }
}
