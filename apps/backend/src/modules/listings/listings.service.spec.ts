import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Category } from '../catalog/entities/category.entity';
import { RedisService } from '../../redis/redis.service';
import { StorageService } from '../storage/storage.service';
import { Favorite } from './entities/favorite.entity';
import { ListingPhoto } from './entities/listing-photo.entity';
import { Listing, ListingStatus } from './entities/listing.entity';
import { LISTING_TTL_DAYS, ListingsService } from './listings.service';

type MockRepo<T extends object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const createRepo = <T extends object>(): MockRepo<T> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn((value) => value as T),
  update: jest.fn(),
  delete: jest.fn(),
  softDelete: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const SELLER = '11111111-1111-1111-1111-111111111111';
const STRANGER = '22222222-2222-2222-2222-222222222222';
const LISTING = '33333333-3333-3333-3333-333333333333';

const aListing = (over: Partial<Listing> = {}): Listing =>
  ({
    id: LISTING,
    sellerId: SELLER,
    status: ListingStatus.EXPIRED,
    title: 'Urgut pomidori',
    ...over,
  }) as Listing;

describe('ListingsService.renew', () => {
  let service: ListingsService;
  let listings: MockRepo<Listing>;
  let redis: { delByPattern: jest.Mock };

  beforeEach(async () => {
    listings = createRepo<Listing>();
    redis = { delByPattern: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ListingsService,
        { provide: getRepositoryToken(Listing), useValue: listings },
        { provide: getRepositoryToken(ListingPhoto), useValue: createRepo<ListingPhoto>() },
        { provide: getRepositoryToken(Favorite), useValue: createRepo<Favorite>() },
        { provide: getRepositoryToken(Category), useValue: createRepo<Category>() },
        { provide: RedisService, useValue: redis },
        { provide: StorageService, useValue: {} },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(ListingsService);
  });

  it('puts an expired listing back for another TTL, keeping its id', async () => {
    listings.findOne!.mockResolvedValue(aListing());

    await service.renew(LISTING, SELLER);

    // The same row, not a copy: links already shared in Telegram still
    // resolve, and the view count, favourites and chats stay attached.
    const [id, patch] = listings.update!.mock.calls[0];
    expect(id).toBe(LISTING);
    expect(patch.status).toBe(ListingStatus.ACTIVE);

    const days = Math.round(
      (patch.expiresAt.getTime() - Date.now()) / 86_400_000,
    );
    expect(days).toBe(LISTING_TTL_DAYS);
  });

  it('drops the feed cache, or the listing stays invisible', async () => {
    listings.findOne!.mockResolvedValue(aListing());

    await service.renew(LISTING, SELLER);

    expect(redis.delByPattern).toHaveBeenCalled();
  });

  it('refuses an active listing', async () => {
    listings.findOne!.mockResolvedValue(aListing({ status: ListingStatus.ACTIVE }));

    // Otherwise renewing is a way to buy a fresh 14 days at the top of the
    // feed whenever you like, without anybody noticing.
    await expect(service.renew(LISTING, SELLER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(listings.update).not.toHaveBeenCalled();
  });

  it('refuses a sold listing', async () => {
    listings.findOne!.mockResolvedValue(aListing({ status: ListingStatus.SOLD }));

    await expect(service.renew(LISTING, SELLER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses somebody else’s listing', async () => {
    listings.findOne!.mockResolvedValue(aListing());

    await expect(service.renew(LISTING, STRANGER)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('is a not-found for a listing that does not exist', async () => {
    listings.findOne!.mockResolvedValue(null);

    await expect(service.renew(LISTING, SELLER)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
