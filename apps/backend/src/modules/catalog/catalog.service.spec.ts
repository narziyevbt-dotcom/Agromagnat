import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../redis/redis.service';
import { District } from '../geo/entities/district.entity';
import { Region } from '../geo/entities/region.entity';
import { CatalogService } from './catalog.service';
import { Category, QuantityUnit } from './entities/category.entity';

type MockRepo<T extends object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const createRepo = <T extends object>(): MockRepo<T> => ({
  find: jest.fn(),
  findOne: jest.fn(),
});

describe('CatalogService', () => {
  let service: CatalogService;
  let categories: MockRepo<Category>;
  let regions: MockRepo<Region>;
  let districts: MockRepo<District>;
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    categories = createRepo<Category>();
    regions = createRepo<Region>();
    districts = createRepo<District>();
    redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: getRepositoryToken(Category), useValue: categories },
        { provide: getRepositoryToken(Region), useValue: regions },
        { provide: getRepositoryToken(District), useValue: districts },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = moduleRef.get(CatalogService);
  });

  describe('findCategories', () => {
    it('reads through to Postgres on a cache miss and populates the cache', async () => {
      const rows = [{ slug: 'mevalar', unitDefault: QuantityUnit.KG }] as Category[];
      redis.get.mockResolvedValue(null);
      categories.find!.mockResolvedValue(rows);

      await expect(service.findCategories()).resolves.toBe(rows);
      expect(categories.find).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledWith('catalog:categories', rows, 3600);
    });

    it('serves a cache hit without touching Postgres', async () => {
      const cached = [{ slug: 'poliz' }] as Category[];
      redis.get.mockResolvedValue(cached);

      await expect(service.findCategories()).resolves.toBe(cached);
      expect(categories.find).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe('findDistricts', () => {
    it('returns the districts of an existing region', async () => {
      const region = { id: 'r1' } as Region;
      const rows = [{ slug: 'urgut' }] as District[];
      regions.findOne!.mockResolvedValue(region);
      districts.find!.mockResolvedValue(rows);

      await expect(service.findDistricts('r1')).resolves.toBe(rows);
      expect(districts.find).toHaveBeenCalledWith({
        where: { regionId: 'r1' },
        order: { nameUz: 'ASC' },
      });
    });

    it('rejects an unknown region with an Uzbek message', async () => {
      regions.findOne!.mockResolvedValue(null);

      await expect(service.findDistricts('nope')).rejects.toThrow(NotFoundException);
      await expect(service.findDistricts('nope')).rejects.toThrow('Viloyat topilmadi');
      expect(districts.find).not.toHaveBeenCalled();
    });
  });

  it('invalidateCache drops both reference-data keys', async () => {
    await service.invalidateCache();
    expect(redis.del).toHaveBeenCalledWith('catalog:categories', 'catalog:regions');
  });
});
