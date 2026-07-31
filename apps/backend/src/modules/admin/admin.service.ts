import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { RedisService } from '../../redis/redis.service';
import { Listing, ListingStatus } from '../listings/entities/listing.entity';
import { Report, ReportStatus } from '../reports/entities/report.entity';
import { User } from '../users/entities/user.entity';

export interface AdminOverview {
  totalUsers: number;
  newUsers7d: number;
  activeListings: number;
  pendingListings: number;
  openReports: number;
  totalViews: number;
  totalCalls: number;
}

export interface AdminPage<T> {
  items: T[];
  total: number;
}

/**
 * Moderation is low-volume, human-paced work, so admin lists use plain
 * offset pagination with totals — the keyset machinery the public feed needs
 * would only make these queries harder to read.
 */
const PAGE_SIZE = 30;

@Injectable()
export class AdminService {
  private readonly logger = new Logger('Admin');

  constructor(
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    private readonly redis: RedisService,
  ) {}

  // ---------------------------------------------------------------- overview

  async overview(): Promise<AdminOverview> {
    const [userRow, listingRow, openReports] = await Promise.all([
      this.users
        .createQueryBuilder('u')
        .select('COUNT(*)', 'total')
        .addSelect(
          "COUNT(*) FILTER (WHERE u.created_at >= NOW() - INTERVAL '7 days')",
          'recent',
        )
        .where('u.deleted_at IS NULL')
        .getRawOne<{ total: string; recent: string }>(),
      this.listings
        .createQueryBuilder('l')
        .select('COUNT(*) FILTER (WHERE l.status = :active)', 'active')
        .addSelect('COUNT(*) FILTER (WHERE l.status = :pending)', 'pending')
        .addSelect('COALESCE(SUM(l.view_count), 0)', 'views')
        .addSelect('COALESCE(SUM(l.call_count), 0)', 'calls')
        .where('l.deleted_at IS NULL')
        .setParameters({ active: ListingStatus.ACTIVE, pending: ListingStatus.PENDING })
        .getRawOne<{ active: string; pending: string; views: string; calls: string }>(),
      this.reports.count({ where: { status: ReportStatus.OPEN } }),
    ]);

    return {
      totalUsers: Number(userRow?.total ?? 0),
      newUsers7d: Number(userRow?.recent ?? 0),
      activeListings: Number(listingRow?.active ?? 0),
      pendingListings: Number(listingRow?.pending ?? 0),
      openReports,
      totalViews: Number(listingRow?.views ?? 0),
      totalCalls: Number(listingRow?.calls ?? 0),
    };
  }

  // ---------------------------------------------------------------- listings

  async findListings(options: {
    status?: ListingStatus;
    q?: string;
    page?: number;
  }): Promise<AdminPage<Listing>> {
    const page = Math.max(1, options.page ?? 1);

    const qb = this.listings
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.seller', 'seller')
      .leftJoinAndSelect('listing.category', 'category')
      .leftJoinAndSelect('listing.region', 'region')
      .leftJoinAndSelect('listing.district', 'district')
      .leftJoinAndSelect('listing.photos', 'photo')
      .where('listing.deleted_at IS NULL')
      .orderBy('listing.createdAt', 'DESC');

    if (options.status) {
      qb.andWhere('listing.status = :status', { status: options.status });
    }
    if (options.q?.trim()) {
      // Admins search by whatever they have in front of them — a title
      // fragment or the seller's phone from a complaint call.
      qb.andWhere(
        new Brackets((where) => {
          where
            .where('listing.title ILIKE :q', { q: `%${options.q!.trim()}%` })
            .orWhere('seller.phone LIKE :phone', { phone: `%${options.q!.trim()}%` });
        }),
      );
    }

    const [items, total] = await qb
      .skip((page - 1) * PAGE_SIZE)
      .take(PAGE_SIZE)
      .getManyAndCount();

    return { items, total };
  }

  /** Moderation approve: pending -> active, with a fresh 14-day clock. */
  async approveListing(id: string): Promise<Listing> {
    const listing = await this.requireListing(id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    await this.listings.update(id, {
      status: ListingStatus.ACTIVE,
      moderationVerdict: 'allow',
      moderationReason: null,
      expiresAt,
    });

    await this.invalidateFeed();
    this.logger.log(`Listing ${id} approved`);
    return this.requireListing(id);
  }

  /**
   * Reject/block with a reason the seller will read. The reason is mandatory —
   * "bloklangan" with no explanation teaches sellers the moderation is
   * arbitrary, and the book's risk chapter is explicit that one bad experience
   * travels through a whole village.
   */
  async blockListing(id: string, reason: string): Promise<Listing> {
    if (!reason?.trim()) {
      throw new BadRequestException('Sabab ko‘rsatilishi shart');
    }
    await this.requireListing(id);

    await this.listings.update(id, {
      status: ListingStatus.BLOCKED,
      moderationVerdict: 'block',
      moderationReason: reason.trim(),
    });

    await this.invalidateFeed();
    this.logger.log(`Listing ${id} blocked: ${reason.trim()}`);
    return this.requireListing(id);
  }

  /** Paid TOP placement. days <= 0 removes the promotion. */
  async promoteListing(id: string, days: number): Promise<Listing> {
    await this.requireListing(id);

    if (days <= 0) {
      await this.listings.update(id, { isPromoted: false, promotedUntil: null });
    } else {
      const until = new Date();
      until.setDate(until.getDate() + Math.min(days, 90));
      await this.listings.update(id, { isPromoted: true, promotedUntil: until });
    }

    await this.invalidateFeed();
    return this.requireListing(id);
  }

  // ------------------------------------------------------------------- users

  async findUsers(options: { q?: string; page?: number }): Promise<AdminPage<User>> {
    const page = Math.max(1, options.page ?? 1);

    const qb = this.users
      .createQueryBuilder('u')
      .where('u.deleted_at IS NULL')
      .orderBy('u.createdAt', 'DESC');

    if (options.q?.trim()) {
      qb.andWhere(
        new Brackets((where) => {
          where
            .where('u.phone LIKE :phone', { phone: `%${options.q!.trim()}%` })
            .orWhere('u.name ILIKE :name', { name: `%${options.q!.trim()}%` });
        }),
      );
    }

    const [items, total] = await qb
      .skip((page - 1) * PAGE_SIZE)
      .take(PAGE_SIZE)
      .getManyAndCount();

    return { items, total };
  }

  /** The turquoise check badge — granted only after a human has looked. */
  async setUserVerified(id: string, verified: boolean): Promise<User> {
    const user = await this.requireUser(id);
    await this.users.update(user.id, { isVerified: verified });
    return this.requireUser(id);
  }

  /**
   * Blocking stops new logins and token refreshes immediately; an already
   * issued access token lives out its 15 minutes. Their active listings are
   * pulled from the feed at the same time — a blocked scammer's listings
   * staying visible would defeat the point.
   */
  async setUserBlocked(id: string, blocked: boolean): Promise<User> {
    const user = await this.requireUser(id);
    await this.users.update(user.id, { isBlocked: blocked });

    if (blocked) {
      await this.listings.update(
        { sellerId: user.id, status: ListingStatus.ACTIVE },
        {
          status: ListingStatus.BLOCKED,
          moderationVerdict: 'block',
          moderationReason: 'Sotuvchi hisobi bloklangan',
        },
      );
      await this.invalidateFeed();
    }

    return this.requireUser(id);
  }

  // ----------------------------------------------------------------- reports

  async findReports(options: {
    status?: ReportStatus;
    page?: number;
  }): Promise<AdminPage<Report>> {
    const page = Math.max(1, options.page ?? 1);

    const [items, total] = await this.reports.findAndCount({
      where: options.status ? { status: options.status } : {},
      relations: { listing: { seller: true }, reporter: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });

    return { items, total };
  }

  async resolveReport(
    id: string,
    adminId: string,
    outcome: 'resolved' | 'rejected',
    note?: string,
  ): Promise<Report> {
    const report = await this.reports.findOne({ where: { id } });
    if (!report) {
      throw new NotFoundException('Shikoyat topilmadi');
    }

    await this.reports.update(id, {
      status: outcome === 'resolved' ? ReportStatus.RESOLVED : ReportStatus.REJECTED,
      resolvedById: adminId,
      resolutionNote: note?.trim() || null,
    });

    const updated = await this.reports.findOne({
      where: { id },
      relations: { listing: true, reporter: true },
    });
    return updated!;
  }

  // ----------------------------------------------------------------- helpers

  private async requireListing(id: string): Promise<Listing> {
    const listing = await this.listings.findOne({
      where: { id },
      relations: { seller: true },
    });
    if (!listing) {
      throw new NotFoundException("E'lon topilmadi");
    }
    return listing;
  }

  private async requireUser(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }
    return user;
  }

  /** Status and promotion changes alter the public feed — drop its cache. */
  private async invalidateFeed(): Promise<void> {
    await this.redis.delByPattern('feed:v1:*');
  }
}
