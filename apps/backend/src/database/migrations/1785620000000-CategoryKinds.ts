import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gives every category a kind, and every listing a bag of category-specific
 * attributes.
 *
 * The kind is what lets the posting form stop asking a tractor how many kilos
 * it weighs. It lives on the row rather than in a lookup table because there
 * are five of them and they change roughly never; the field spec each kind
 * expands into lives in code (`category-forms.ts`), since it is presentation,
 * not data.
 *
 * `attributes` is jsonb rather than a column per field. A column per field
 * would mean a migration every time a category gains a question, and would
 * leave eleven of twelve categories with a null in it. Server-side validation
 * against the spec keeps the bag from becoming a dumping ground.
 */
export class CategoryKinds1785620000000 implements MigrationInterface {
  name = 'CategoryKinds1785620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."categories_kind_enum" AS ENUM('produce', 'supply', 'machinery', 'service', 'land')`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD "kind" "public"."categories_kind_enum" NOT NULL DEFAULT 'produce'`,
    );

    // Backfill the seeded categories. Anything else stays 'produce', which is
    // the permissive spec — it asks the most questions and requires none.
    await queryRunner.query(
      `UPDATE "categories" SET "kind" = 'supply'
        WHERE "slug" IN ('urug-va-kochat', 'ogit-va-kimyo', 'chorva-ozuqasi')`,
    );
    await queryRunner.query(
      `UPDATE "categories" SET "kind" = 'machinery' WHERE "slug" = 'texnika'`,
    );
    await queryRunner.query(
      `UPDATE "categories" SET "kind" = 'service' WHERE "slug" = 'xizmatlar'`,
    );
    await queryRunner.query(`UPDATE "categories" SET "kind" = 'land' WHERE "slug" = 'yer'`);

    await queryRunner.query(
      `ALTER TABLE "listings" ADD "attributes" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );

    // Machinery and land buyers filter on condition and tenure before anything
    // else; a GIN index makes those containment lookups cheap when they land.
    await queryRunner.query(
      `CREATE INDEX "idx_listings_attributes" ON "listings" USING GIN ("attributes")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_listings_attributes"`);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "attributes"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "kind"`);
    await queryRunner.query(`DROP TYPE "public"."categories_kind_enum"`);
  }
}
