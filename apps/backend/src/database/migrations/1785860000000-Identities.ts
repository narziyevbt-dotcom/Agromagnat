import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Separates *who a person is* from *how they proved it*.
 *
 * Until now the phone number was the identity: `users.phone` was NOT NULL and
 * unique, and the only way in was an SMS code. That makes browsing impossible
 * without an SMS, which is the wrong trade — a buyer evaluating the market
 * costs us nothing and an SMS costs money, so the sign-up wall was charging us
 * to turn visitors away.
 *
 * `auth_identities` holds one row per proof: a Google subject, a phone number,
 * an Apple ID later. Adding a provider becomes a row rather than a migration,
 * and a person can hold several without duplicate accounts.
 *
 * The phone stays special. It is not a login credential any more but it is
 * still the thing that makes a seller reachable and accountable, so it is
 * required before any action that touches another user — see PhoneVerifiedGuard.
 */
export class Identities1785860000000 implements MigrationInterface {
  name = 'Identities1785860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."auth_identities_provider_enum" AS ENUM('google', 'phone', 'telegram')`,
    );

    await queryRunner.query(
      `CREATE TABLE "auth_identities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "provider" "public"."auth_identities_provider_enum" NOT NULL,
        "provider_user_id" character varying(255) NOT NULL,
        "email" character varying(320),
        "last_login_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_auth_identities" PRIMARY KEY ("id")
      )`,
    );

    // One account per (provider, subject). This is the join that turns a
    // returning Google user into the same person rather than a new one.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_auth_identities_provider_subject"
         ON "auth_identities" ("provider", "provider_user_id")`,
    );
    // And one identity per provider per user, so a second Google account
    // cannot be silently attached to an existing profile.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_auth_identities_user_provider"
         ON "auth_identities" ("user_id", "provider")`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_identities" ADD CONSTRAINT "FK_auth_identities_user"
         FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Backfill: every existing account proved itself by phone.
    await queryRunner.query(
      `INSERT INTO "auth_identities" ("user_id", "provider", "provider_user_id", "last_login_at")
       SELECT "id", 'phone', "phone", "updated_at" FROM "users"`,
    );

    await queryRunner.query(
      `ALTER TABLE "users" ADD "phone_verified_at" TIMESTAMP WITH TIME ZONE`,
    );
    // Existing accounts only ever existed because an OTP succeeded, so their
    // phone is verified by construction. Leaving it null would lock every
    // current seller out of their own listings on the next deploy.
    await queryRunner.query(
      `UPDATE "users" SET "phone_verified_at" = "created_at" WHERE "phone" IS NOT NULL`,
    );

    await queryRunner.query(`ALTER TABLE "users" ADD "email" character varying(320)`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "telegram_chat_id" character varying(64)`,
    );

    // A Google-only account has no phone yet.
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL`);

    // The old unique index counted NULLs as distinct, which is what we want
    // here — many accounts may have no phone — but it has to be rebuilt as a
    // partial index so the intent is explicit rather than incidental.
    await queryRunner.query(`DROP INDEX "public"."idx_users_phone"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_users_phone" ON "users" ("phone") WHERE "phone" IS NOT NULL`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_users_telegram_chat" ON "users" ("telegram_chat_id")
         WHERE "telegram_chat_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_users_telegram_chat"`);
    await queryRunner.query(`DROP INDEX "public"."idx_users_phone"`);
    // Rows with no phone cannot survive the NOT NULL; they never existed before
    // this migration, so removing them restores the prior state exactly.
    await queryRunner.query(`DELETE FROM "users" WHERE "phone" IS NULL`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "phone" SET NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_users_phone" ON "users" ("phone")`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "telegram_chat_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone_verified_at"`);
    await queryRunner.query(
      `ALTER TABLE "auth_identities" DROP CONSTRAINT "FK_auth_identities_user"`,
    );
    await queryRunner.query(`DROP TABLE "auth_identities"`);
    await queryRunner.query(`DROP TYPE "public"."auth_identities_provider_enum"`);
  }
}
