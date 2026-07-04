import { MigrationInterface, QueryRunner } from 'typeorm';

export class CampaignDatasource1782574576325 implements MigrationInterface {
  name = 'CampaignDatasource1782574576325';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "campaign_data_source" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "campaign_id" uuid, "file_name" character varying(255) NOT NULL, "file_path" text NOT NULL, "file_size" bigint NOT NULL, "mime_type" character varying(100), CONSTRAINT "REL_76fe9a62c4d711864f6d8cab82" UNIQUE ("campaign_id"), CONSTRAINT "PK_c95db20f7685e9cb8ae29242da0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_76fe9a62c4d711864f6d8cab82" ON "campaign_data_source" ("campaign_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "campaign_data_source" ADD CONSTRAINT "FK_76fe9a62c4d711864f6d8cab824" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "campaign_data_source" DROP CONSTRAINT "FK_76fe9a62c4d711864f6d8cab824"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_76fe9a62c4d711864f6d8cab82"`,
    );
    await queryRunner.query(`DROP TABLE "campaign_data_source"`);
  }
}
