import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Price offers inside a conversation, and the agreed price on the listing.
 *
 * Two problems this closes.
 *
 * A listing only became `sold` when the seller pressed a button on their own
 * profile — an action that removes their listing from the feed and gains them
 * nothing. Reviews require `sold`, ratings require reviews, and trust requires
 * ratings, so the entire trust loop hung off the one action a seller is
 * actively disincentivised to take. Accepting an offer closes the sale as a
 * side effect of something both sides already want to do.
 *
 * And the price index read `listings.price` — the *asking* price — even for
 * sold rows. Agricultural sales almost always close below asking, so the
 * recommender was systematically high. `sold_price` records what was actually
 * agreed, and the recommender prefers it.
 *
 * Offers live in their own table rather than as columns on `messages`: a
 * message is an immutable timeline entry while an offer has a lifecycle
 * (pending → accepted | declined | expired), and "every offer on this listing"
 * has to be a real query, not a scan of message bodies.
 */
export class Offers1785780000000 implements MigrationInterface {
  name = 'Offers1785780000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."offers_status_enum" AS ENUM('pending', 'accepted', 'declined', 'expired')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."offers_from_role_enum" AS ENUM('buyer', 'seller')`,
    );

    await queryRunner.query(
      `CREATE TABLE "offers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "chat_id" uuid NOT NULL,
        "listing_id" uuid NOT NULL,
        "sender_id" uuid NOT NULL,
        "from_role" "public"."offers_from_role_enum" NOT NULL,
        "amount" numeric(14,2) NOT NULL,
        "price_unit" "public"."listings_price_unit_enum" NOT NULL,
        "quantity" numeric(14,3),
        "quantity_unit" "public"."listings_quantity_unit_enum",
        "note" character varying(300),
        "status" "public"."offers_status_enum" NOT NULL DEFAULT 'pending',
        "responded_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_offers" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_offers_amount_positive" CHECK ("amount" > 0)
      )`,
    );

    await queryRunner.query(
      `ALTER TABLE "offers" ADD CONSTRAINT "FK_offers_chat" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD CONSTRAINT "FK_offers_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD CONSTRAINT "FK_offers_sender" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // The thread renders offers newest-first alongside its messages.
    await queryRunner.query(
      `CREATE INDEX "idx_offers_chat_created" ON "offers" ("chat_id", "created_at" DESC)`,
    );
    // Expiring the losers when one offer is accepted, and the "you have an open
    // offer" guard, both look up pending offers for a listing.
    await queryRunner.query(
      `CREATE INDEX "idx_offers_listing_pending" ON "offers" ("listing_id") WHERE "status" = 'pending'`,
    );

    // At most one live offer per side per conversation. Without this, tapping
    // the button twice on a slow connection leaves two open offers and the
    // counterpart can accept either — which price actually won is then a race.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_offers_one_pending_per_side"
         ON "offers" ("chat_id", "from_role") WHERE "status" = 'pending'`,
    );

    await queryRunner.query(
      `ALTER TABLE "listings" ADD "sold_price" numeric(14,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "listings" ADD "sold_quantity" numeric(14,3)`,
    );

    await queryRunner.query(
      `ALTER TYPE "public"."messages_type_enum" ADD VALUE IF NOT EXISTS 'offer'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres cannot drop a value from an enum, so `messages_type_enum` keeps
    // 'offer'. Harmless: nothing writes it once the table is gone.
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "sold_quantity"`);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "sold_price"`);
    await queryRunner.query(`DROP INDEX "public"."idx_offers_one_pending_per_side"`);
    await queryRunner.query(`DROP INDEX "public"."idx_offers_listing_pending"`);
    await queryRunner.query(`DROP INDEX "public"."idx_offers_chat_created"`);
    await queryRunner.query(`ALTER TABLE "offers" DROP CONSTRAINT "FK_offers_sender"`);
    await queryRunner.query(`ALTER TABLE "offers" DROP CONSTRAINT "FK_offers_listing"`);
    await queryRunner.query(`ALTER TABLE "offers" DROP CONSTRAINT "FK_offers_chat"`);
    await queryRunner.query(`DROP TABLE "offers"`);
    await queryRunner.query(`DROP TYPE "public"."offers_from_role_enum"`);
    await queryRunner.query(`DROP TYPE "public"."offers_status_enum"`);
  }
}
