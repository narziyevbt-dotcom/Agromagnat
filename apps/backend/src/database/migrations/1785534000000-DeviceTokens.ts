import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Push registrations, one row per installation.
 *
 * `users.push_token` from the initial schema is superseded by this table and is
 * left in place rather than dropped — dropping a column is destructive and the
 * mobile client that writes it has not shipped yet. See docs/PUSH.md.
 */
export class DeviceTokens1785534000000 implements MigrationInterface {
  name = 'DeviceTokens1785534000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."device_tokens_platform_enum" AS ENUM('android', 'ios', 'web')`,
    );
    await queryRunner.query(
      `CREATE TABLE "device_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "token" character varying(400) NOT NULL,
        "platform" "public"."device_tokens_platform_enum" NOT NULL DEFAULT 'android',
        "last_used_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_device_tokens" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_device_tokens_token" ON "device_tokens" ("token")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_device_tokens_user" ON "device_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" ADD CONSTRAINT "FK_device_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "device_tokens" DROP CONSTRAINT "FK_device_tokens_user"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_device_tokens_user"`);
    await queryRunner.query(`DROP INDEX "public"."idx_device_tokens_token"`);
    await queryRunner.query(`DROP TABLE "device_tokens"`);
    await queryRunner.query(`DROP TYPE "public"."device_tokens_platform_enum"`);
  }
}
