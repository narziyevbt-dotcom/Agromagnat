import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../redis/redis.service';
import { District } from '../geo/entities/district.entity';
import { Region } from '../geo/entities/region.entity';
import { CategoryKind } from './category-forms';
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
      const rows = [
        { slug: 'mevalar', unitDefault: QuantityUnit.KG, kind: CategoryKind.PRODUCE },
      ] as Category[];
      redis.get.mockResolvedValue(null);
      categories.find!.mockResolvedValue(rows);

      await expect(service.findCategories()).resolves.toEqual([
        { ...rows[0], form: expect.objectContaining({ kind: CategoryKind.PRODUCE }) },
      ]);
      expect(categories.find).toHaveBeenCalledTimes(1);
      // The raw rows are cached; the derived form spec is not.
      expect(redis.set).toHaveBeenCalledWith('catalog:categories:v2', rows, 3600);
    });

    it('serves a cache hit without touching Postgres', async () => {
      const cached = [{ slug: 'texnika', kind: CategoryKind.MACHINERY }] as Category[];
      redis.get.mockResolvedValue(cached);

      const result = await service.findCategories();
      expect(result[0].slug).toBe('texnika');
      expect(categories.find).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('re-reads Postgres when a cached row predates a field, rather than serving the old shape', async () => {
      // This is the bug the version key exists for: rows cached before `kind`
      // was added made every category fall through to the produce spec, and
      // machinery was asked for kilos on a live site.
      redis.get.mockResolvedValue([{ slug: 'texnika' }]);
      categories.find!.mockResolvedValue([
        { slug: 'texnika', kind: CategoryKind.MACHINERY },
      ] as Category[]);

      const [category] = await service.findCategories();
      expect(categories.find).toHaveBeenCalledTimes(1);
      expect(category.form!.kind).toBe(CategoryKind.MACHINERY);
    });

    it('expands the form spec even on a cache hit, so a stale year bound cannot be served', async () => {
      redis.get.mockResolvedValue([{ slug: 'texnika', kind: CategoryKind.MACHINERY }]);

      const [category] = await service.findCategories();
      const year = category.form!.attributes.find((a) => a.key === 'year');
      expect(year!.max).toBe(new Date().getFullYear() + 1);
    });
  });

  describe('findCategoryForm', () => {
    it('asks a machinery category for a count, never for kilos', async () => {
      redis.get.mockResolvedValue([
        { id: 'c1', slug: 'texnika', kind: CategoryKind.MACHINERY },
      ]);

      const spec = await service.findCategoryForm('texnika');
      expect(spec.kind).toBe(CategoryKind.MACHINERY);
      expect(spec.quantity.units).toEqual(['dona']);
      expect(spec.quantity.labelUz).toBe('Nechta');
      expect(spec.optional.harvestDate).toBe(false);
      expect(spec.attributes.map((a) => a.key)).toContain('condition');
    });

    it('resolves by id as well as by slug', async () => {
      redis.get.mockResolvedValue([{ id: 'c1', slug: 'yer', kind: CategoryKind.LAND }]);

      await expect(service.findCategoryForm('c1')).resolves.toMatchObject({
        kind: CategoryKind.LAND,
      });
    });

    it('rejects an unknown category with an Uzbek message', async () => {
      redis.get.mockResolvedValue(null);
      categories.find!.mockResolvedValue([]);

      await expect(service.findCategoryForm('nope')).rejects.toThrow('Kategoriya topilmadi');
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
    expect(redis.del).toHaveBeenCalledWith('catalog:categories:v2', 'catalog:regions:v2');
  });
});
