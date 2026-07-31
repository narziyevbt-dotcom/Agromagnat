import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes for the price recommender's two hot queries.
 *
 * Both are partial. The recommender only ever looks at sold listings inside a
 * 60-day window and active listings inside a 30-day one, and a partial index
 * over those statuses is a fraction of the size of a full one — which matters
 * because it stays in cache, and a percentile query that spills to disk is the
 * difference between the posting form feeling instant and feeling broken.
 *
 * `sold_at DESC` is in the key rather than only in the predicate so the window
 * filter is an index range scan instead of a filter over every sold row.
 */
export class PriceIndexQueryIndexes1785700000000 implements MigrationInterface {
  name = 'PriceIndexQueryIndexes1785700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "idx_listings_sold_price"
         ON "listings" ("category_id", "price_unit", "region_id", "sold_at" DESC)
       WHERE "status" = 'sold' AND "deleted_at" IS NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_listings_active_price"
         ON "listings" ("category_id", "price_unit", "region_id", "created_at" DESC)
       WHERE "status" = 'active' AND "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_listings_active_price"`);
    await queryRunner.query(`DROP INDEX "public"."idx_listings_sold_price"`);
  }
}
