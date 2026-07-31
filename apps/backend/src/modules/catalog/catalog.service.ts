import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../redis/redis.service';
import { District } from '../geo/entities/district.entity';
import { Region } from '../geo/entities/region.entity';
import { CategoryFormSpec, formSpecFor } from './category-forms';
import { Category } from './entities/category.entity';

/** Reference data changes rarely — cache it for an hour. */
const CACHE_TTL_SECONDS = 3600;

/**
 * Bumped whenever the cached row shape changes.
 *
 * Without it, a deploy that adds a column keeps serving the old shape for up to
 * an hour: `kind` landed with a migration and the cache went on handing back
 * rows that predated it, so every category fell through to the `produce` field
 * spec and machinery was asked for kilos on a live site. The feed cache already
 * carries a version for the same reason (`feed:v1:`); this one did not.
 *
 * Adding a field to `Category` without bumping this is a silent, hour-long,
 * production-only bug.
 */
const CACHE_VERSION = 'v2';

const CATEGORIES_KEY = `catalog:categories:${CACHE_VERSION}`;
const REGIONS_KEY = `catalog:regions:${CACHE_VERSION}`;

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Region) private readonly regions: Repository<Region>,
    @InjectRepository(District) private readonly districts: Repository<District>,
    private readonly redis: RedisService,
  ) {}

  async findCategories(): Promise<Category[]> {
    const cacheKey = CATEGORIES_KEY;
    const cached = await this.redis.get<Category[]>(cacheKey);

    // Belt to the version key's braces: an entry that predates a field is
    // treated as a miss rather than served. The version bump is the fix; this
    // is what makes forgetting one self-heal on the next request instead of
    // quietly mis-rendering every posting form for an hour.
    if (cached?.length && cached.every((category) => category.kind)) {
      // The spec is derived, and one of its bounds moves with the calendar, so
      // it is re-expanded on the way out rather than served from the cache.
      return cached.map((category) => this.withForm(category));
    }
    const rows = await this.categories.find({
      order: { sortOrder: 'ASC', nameUz: 'ASC' },
    });
    await this.redis.set(cacheKey, rows, CACHE_TTL_SECONDS);
    return rows.map((category) => this.withForm(category));
  }

  /** The posting-form spec for one category, by id or by slug. */
  async findCategoryForm(idOrSlug: string): Promise<CategoryFormSpec> {
    const category = (await this.findCategories()).find(
      (row) => row.id === idOrSlug || row.slug === idOrSlug,
    );
    if (!category) {
      throw new NotFoundException('Kategoriya topilmadi');
    }
    return formSpecFor(category.kind);
  }

  private withForm(category: Category): Category {
    return { ...category, form: formSpecFor(category.kind) } as Category;
  }

  async findRegions(): Promise<Region[]> {
    const cacheKey = REGIONS_KEY;
    const cached = await this.redis.get<Region[]>(cacheKey);
    if (cached) {
      return cached;
    }
    const rows = await this.regions.find({
      order: { sortOrder: 'ASC', nameUz: 'ASC' },
    });
    await this.redis.set(cacheKey, rows, CACHE_TTL_SECONDS);
    return rows;
  }

  async findDistricts(regionId: string): Promise<District[]> {
    const region = await this.regions.findOne({ where: { id: regionId } });
    if (!region) {
      throw new NotFoundException('Viloyat topilmadi');
    }
    return this.districts.find({
      where: { regionId },
      order: { nameUz: 'ASC' },
    });
  }

  /** Called by seeds and admin writes so stale reference data never lingers. */
  async invalidateCache(): Promise<void> {
    await this.redis.del(CATEGORIES_KEY, REGIONS_KEY);
  }
}
