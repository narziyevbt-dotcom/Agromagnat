import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Listing, ListingStatus } from '../listings/entities/listing.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { CreateReviewDto, RatingBreakdown, SellerReviewsDto } from './dto/review.dto';
import { Review } from './entities/review.entity';

/** Postgres unique-violation code. */
const UNIQUE_VIOLATION = '23505';

export const REVIEWS_PAGE_SIZE = 20;

const EMPTY_BREAKDOWN: RatingBreakdown = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger('Reviews');

  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------------- create

  /**
   * A buyer rates a seller once per completed deal.
   *
   * "Completed" means the seller marked the listing sold. That is the only
   * signal the platform has — the money changes hands off-platform — so it is
   * what gates the review, and it is why a review cannot be left on an active
   * listing: otherwise a competitor could rate a rival on a listing nobody ever
   * bought.
   */
  async create(listingId: string, authorId: string, dto: CreateReviewDto): Promise<Review> {
    const listing = await this.listings.findOne({ where: { id: listingId } });
    if (!listing) {
      throw new NotFoundException("E'lon topilmadi");
    }
    if (listing.sellerId === authorId) {
      throw new BadRequestException("O'zingizga baho qo'yib bo'lmaydi");
    }
    if (listing.status !== ListingStatus.SOLD) {
      throw new BadRequestException(
        "Baho faqat sotilgan e'lon uchun qo'yiladi",
      );
    }

    let review: Review;
    try {
      review = await this.dataSource.transaction(async (manager) => {
        const saved = await manager.save(
          manager.create(Review, {
            listingId,
            authorId,
            sellerId: listing.sellerId,
            rating: dto.rating,
            comment: dto.comment?.trim() || null,
          }),
        );
        await this.recomputeSellerRating(manager, listing.sellerId);
        return saved;
      });
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException("Siz bu e'lon uchun allaqachon baho qo'ygansiz");
      }
      throw error;
    }

    void this.pushNewReview(listing.sellerId, authorId, dto.rating);
    return this.reviews.findOneOrFail({
      where: { id: review.id },
      relations: { author: true },
    });
  }

  // ------------------------------------------------------------------ read

  /**
   * A seller's public reviews, with the histogram the profile header renders.
   *
   * The aggregates are computed over the same visible set as the list, not read
   * off users.rating_avg — a moderator hiding a review has to change the number
   * a buyer sees, or hiding it accomplishes nothing.
   */
  async findForSeller(sellerId: string, page = 1, limit = REVIEWS_PAGE_SIZE): Promise<SellerReviewsDto> {
    const safePage = Math.max(1, page);

    const [items, total] = await this.reviews.findAndCount({
      where: { sellerId, isHidden: false },
      relations: { author: true, listing: true },
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * limit,
      take: limit,
    });

    const rows = await this.reviews
      .createQueryBuilder('review')
      .select('review.rating', 'rating')
      .addSelect('COUNT(*)', 'count')
      .where('review.seller_id = :sellerId', { sellerId })
      .andWhere('review.is_hidden = false')
      .groupBy('review.rating')
      .getRawMany<{ rating: number; count: string }>();

    const breakdown: RatingBreakdown = { ...EMPTY_BREAKDOWN };
    let sum = 0;
    let count = 0;
    for (const row of rows) {
      const key = String(row.rating) as keyof RatingBreakdown;
      const n = Number(row.count);
      breakdown[key] = n;
      sum += row.rating * n;
      count += n;
    }

    return {
      items,
      total,
      average: count ? (sum / count).toFixed(2) : '0.00',
      breakdown,
    };
  }

  /**
   * The caller's own review of a listing, if any. The web form asks for this
   * before rendering, so a buyer who already rated sees their stars rather than
   * an empty form that will 409.
   */
  async findMine(listingId: string, authorId: string): Promise<Review | null> {
    return this.reviews.findOne({ where: { listingId, authorId } });
  }

  // ------------------------------------------------------------ moderation

  /** Hides or restores a review, then rebuilds the seller's denormalised rating. */
  async setHidden(reviewId: string, hidden: boolean): Promise<Review> {
    const review = await this.reviews.findOne({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException('Baho topilmadi');
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.update(Review, reviewId, { isHidden: hidden });
      await this.recomputeSellerRating(manager, review.sellerId);
      return manager.findOneOrFail(Review, { where: { id: reviewId } });
    });
  }

  async findAllForModeration(page = 1, limit = REVIEWS_PAGE_SIZE) {
    const safePage = Math.max(1, page);
    const [items, total] = await this.reviews.findAndCount({
      relations: { author: true, seller: true, listing: true },
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * limit,
      take: limit,
    });
    return { items, total };
  }

  // ---------------------------------------------------------------- helpers

  /**
   * Rebuilds users.rating_avg and rating_count from the reviews table.
   *
   * Recomputed rather than incremented: an increment is only correct while every
   * write is an insert, and hiding, restoring and cascade-deleting all move the
   * average too. One aggregate over an indexed (seller_id) scan is cheap enough
   * that being right is the easy option.
   */
  private async recomputeSellerRating(
    manager: EntityManager,
    sellerId: string,
  ): Promise<void> {
    await manager.query(
      `UPDATE users u
          SET rating_avg = COALESCE(agg.avg_rating, 0),
              rating_count = COALESCE(agg.count_rating, 0)
         FROM (
           SELECT ROUND(AVG(rating)::numeric, 2) AS avg_rating,
                  COUNT(*)                       AS count_rating
             FROM reviews
            WHERE seller_id = $1 AND is_hidden = false
         ) AS agg
        WHERE u.id = $1`,
      [sellerId],
    );
  }

  private async pushNewReview(
    sellerId: string,
    authorId: string,
    rating: number,
  ): Promise<void> {
    try {
      const author = await this.dataSource
        .getRepository(User)
        .findOne({ where: { id: authorId }, select: { id: true, name: true } });
      await this.notifications.notifyNewReview(sellerId, rating, author?.name ?? null);
    } catch (error) {
      this.logger.warn(`Review push for ${sellerId} failed: ${String(error)}`);
    }
  }
}
