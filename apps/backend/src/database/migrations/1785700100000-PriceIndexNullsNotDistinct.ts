import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes the price-index uniqueness constraint actually cover the national row.
 *
 * `price_index.region_id` is NULL for the national aggregate, and in a plain
 * unique index every NULL is distinct from every other NULL. So the nightly
 * snapshot's `ON CONFLICT (day, category_id, region_id, unit)` never matched a
 * national row: each run inserted a fresh duplicate, and the series would have
 * grown one extra row per category per unit per night, forever, while every
 * regional row upserted correctly. The chart would have started double-plotting
 * the national line within a day of the cron going live.
 *
 * `NULLS NOT DISTINCT` (Postgres 15+, and this project runs 16) is the direct
 * fix: it makes two NULL region_ids collide the way the constraint always
 * intended. The alternative — a COALESCE to a sentinel UUID — works on older
 * servers but hides the intent in an expression index and makes every query
 * that filters on region_id look wrong.
 *
 * Any duplicates already written are collapsed to the most recently updated row
 * before the index is rebuilt, since the index cannot be created while they
 * exist.
 */
export class PriceIndexNullsNotDistinct1785700100000 implements MigrationInterface {
  name = 'PriceIndexNullsNotDistinct1785700100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "price_index" a
        USING "price_index" b
        WHERE a."day" = b."day"
          AND a."category_id" = b."category_id"
          AND a."region_id" IS NOT DISTINCT FROM b."region_id"
          AND a."unit" = b."unit"
          AND (a."updated_at", a."id") < (b."updated_at", b."id")`,
    );

    await queryRunner.query(`DROP INDEX "public"."idx_price_index_unique"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_price_index_unique"
         ON "price_index" ("day", "category_id", "region_id", "unit")
         NULLS NOT DISTINCT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_price_index_unique"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_price_index_unique"
         ON "price_index" ("day", "category_id", "region_id", "unit")`,
    );
  }
}
