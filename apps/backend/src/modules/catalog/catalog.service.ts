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

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Region) private readonly regions: Repository<Region>,
    @InjectRepository(District) private readonly districts: Repository<District>,
    private readonly redis: RedisService,
  ) {}

  async findCategories(): Promise<Category[]> {
    const cacheKey = 'catalog:categories';
    const cached = await this.redis.get<Category[]>(cacheKey);
    if (cached) {
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
    const cacheKey = 'catalog:regions';
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
    await this.redis.del('catalog:categories', 'catalog:regions');
  }
}
