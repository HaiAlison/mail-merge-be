import { MigrationInterface, QueryRunner } from "typeorm";

export class Signature1783866774349 implements MigrationInterface {
    name = 'Signature1783866774349'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "signatures" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "name" character varying NOT NULL, "content" character varying NOT NULL, "user_id" uuid NOT NULL, "is_default" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_458d09273884d9bbb51c7bde4a7" PRIMARY KEY ("id"))`)
        await queryRunner.query(`CREATE TABLE "signature_attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "signature_id" uuid, "file_name" character varying(255) NOT NULL, "file_path" text NOT NULL, "file_size" bigint NOT NULL, "mime_type" character varying(100), CONSTRAINT "PK_ab6b7cf4e7b676fab1dcf27ca1f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_23b7ba3e1891a0aa9b9be5d722" ON "signature_attachments" ("signature_id") `);
        await queryRunner.query(`ALTER TABLE "signature_attachments" ADD CONSTRAINT "FK_23b7ba3e1891a0aa9b9be5d722f" FOREIGN KEY ("signature_id") REFERENCES "signatures"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "signature_attachments" DROP CONSTRAINT "FK_23b7ba3e1891a0aa9b9be5d722f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_23b7ba3e1891a0aa9b9be5d722"`);
        await queryRunner.query(`DROP TABLE "signature_attachments"`);
        await queryRunner.query(`DROP TABLE "signatures"`);
    }

}
