import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Full-text search over listing title + description.
 *
 * The vector is a stored generated column so Postgres maintains it on every
 * write and the GIN index stays usable by a plain `search_vector @@ query`
 * predicate — no trigger to keep in sync.
 *
 * Configuration is 'simple' rather than a language dictionary: Postgres ships
 * no Uzbek stemmer, and 'simple' (lowercase + de-accent, no stemming) is the
 * correct behaviour for mixed Uzbek/Russian product names.
 */
export class ListingFullTextSearch1785447500000 implements MigrationInterface {
  name = 'ListingFullTextSearch1785447500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "listings"
      ADD COLUMN "search_vector" tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
        setweight(to_tsvector('simple', coalesce("description", '')), 'B') ||
        setweight(to_tsvector('simple', coalesce("title_ru", '')), 'A') ||
        setweight(to_tsvector('simple', coalesce("description_ru", '')), 'B')
      ) STORED
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_listings_search_vector" ON "listings" USING GIN ("search_vector")`,
    );

    // pg_trgm powers "did you mean" style fuzzy matching on short titles, which
    // full-text alone handles poorly for single-word queries ("pomidr").
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);
    await queryRunner.query(
      `CREATE INDEX "idx_listings_title_trgm" ON "listings" USING GIN ("title" gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_listings_title_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_listings_search_vector"`);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN IF EXISTS "search_vector"`);
  }
}
