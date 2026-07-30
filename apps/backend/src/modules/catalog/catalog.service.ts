import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../redis/redis.service';
import { District } from '../geo/entities/district.entity';
import { Region } from '../geo/entities/region.entity';
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
      return cached;
    }
    const rows = await this.categories.find({
      order: { sortOrder: 'ASC', nameUz: 'ASC' },
    });
    await this.redis.set(cacheKey, rows, CACHE_TTL_SECONDS);
    return rows;
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
