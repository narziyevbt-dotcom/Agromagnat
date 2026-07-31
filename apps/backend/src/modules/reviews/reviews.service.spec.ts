import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Listing, ListingStatus } from '../listings/entities/listing.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Review } from './entities/review.entity';
import { ReviewsService } from './reviews.service';

type MockRepo<T extends object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const SELLER = '11111111-1111-1111-1111-111111111111';
const BUYER = '22222222-2222-2222-2222-222222222222';
const LISTING = '44444444-4444-4444-4444-444444444444';

const uniqueViolation = () => Object.assign(new Error('duplicate key'), { code: '23505' });

describe('ReviewsService', () => {
  let service: ReviewsService;
  let reviews: MockRepo<Review>;
  let listings: MockRepo<Listing>;
  let notifications: { notifyNewReview: jest.Mock };
  let manager: {
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    query: jest.Mock;
    findOneOrFail: jest.Mock;
  };

  beforeEach(async () => {
    reviews = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(async () => ({ id: 'review-1' })),
      findAndCount: jest.fn(),
      save: jest.fn(),
      create: jest.fn((value) => value as Review),
      createQueryBuilder: jest.fn(),
    };
    listings = { findOne: jest.fn() };
    notifications = { notifyNewReview: jest.fn().mockResolvedValue(undefined) };

    manager = {
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (value) => ({ id: 'review-1', ...value })),
      update: jest.fn(),
      query: jest.fn(),
      findOneOrFail: jest.fn(async () => ({ id: 'review-1', isHidden: true })),
    };

    const dataSource = {
      transaction: jest.fn(async (callback: (m: typeof manager) => unknown) =>
        callback(manager),
      ),
      getRepository: jest.fn(() => ({ findOne: jest.fn().mockResolvedValue({ name: 'Anvar' }) })),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: getRepositoryToken(Review), useValue: reviews },
        { provide: getRepositoryToken(Listing), useValue: listings },
        { provide: NotificationsService, useValue: notifications },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = moduleRef.get(ReviewsService);
  });

  describe('create', () => {
    it('rates the seller of a sold listing and rebuilds their average', async () => {
      listings.findOne!.mockResolvedValue({
        id: LISTING,
        sellerId: SELLER,
        status: ListingStatus.SOLD,
      });

      await service.create(LISTING, BUYER, { rating: 5, comment: '  Zo\'r  ' });

      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ sellerId: SELLER, rating: 5, comment: "Zo'r" }),
      );
      // The denormalised rating must move inside the same transaction.
      expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE users'), [
        SELLER,
      ]);
    });

    it('refuses a review on a listing that was never sold', async () => {
      listings.findOne!.mockResolvedValue({
        id: LISTING,
        sellerId: SELLER,
        status: ListingStatus.ACTIVE,
      });

      await expect(service.create(LISTING, BUYER, { rating: 5 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses a seller rating themselves', async () => {
      listings.findOne!.mockResolvedValue({
        id: LISTING,
        sellerId: SELLER,
        status: ListingStatus.SOLD,
      });

      await expect(service.create(LISTING, SELLER, { rating: 5 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('turns a second review into a 409, not a 500', async () => {
      listings.findOne!.mockResolvedValue({
        id: LISTING,
        sellerId: SELLER,
        status: ListingStatus.SOLD,
      });
      manager.save.mockRejectedValue(uniqueViolation());

      await expect(service.create(LISTING, BUYER, { rating: 4 })).rejects.toThrow(
        ConflictException,
      );
    });

    it('404s on a listing that does not exist', async () => {
      listings.findOne!.mockResolvedValue(null);

      await expect(service.create(LISTING, BUYER, { rating: 4 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findForSeller', () => {
    it('builds the histogram and the average from the visible reviews', async () => {
      reviews.findAndCount!.mockResolvedValue([[], 3]);
      reviews.createQueryBuilder!.mockReturnValue(
        breakdownQueryBuilder([
          { rating: 5, count: '2' },
          { rating: 4, count: '1' },
        ]),
      );

      const result = await service.findForSeller(SELLER);

      expect(result.average).toBe('4.67');
      expect(result.breakdown).toEqual({ '1': 0, '2': 0, '3': 0, '4': 1, '5': 2 });
    });

    it('reads 0.00 rather than NaN for a seller with no reviews', async () => {
      reviews.findAndCount!.mockResolvedValue([[], 0]);
      reviews.createQueryBuilder!.mockReturnValue(breakdownQueryBuilder([]));

      const result = await service.findForSeller(SELLER);

      expect(result.average).toBe('0.00');
      expect(result.total).toBe(0);
    });

    it('never asks Postgres for a negative offset', async () => {
      reviews.findAndCount!.mockResolvedValue([[], 0]);
      reviews.createQueryBuilder!.mockReturnValue(breakdownQueryBuilder([]));

      await service.findForSeller(SELLER, 0);

      expect(reviews.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 }),
      );
    });
  });

  describe('setHidden', () => {
    it('hides the review and recomputes the seller rating', async () => {
      reviews.findOne!.mockResolvedValue({ id: 'review-1', sellerId: SELLER });

      await service.setHidden('review-1', true);

      expect(manager.update).toHaveBeenCalledWith(Review, 'review-1', { isHidden: true });
      expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE users'), [
        SELLER,
      ]);
    });

    it('404s on a review that does not exist', async () => {
      reviews.findOne!.mockResolvedValue(null);

      await expect(service.setHidden('review-1', true)).rejects.toThrow(NotFoundException);
    });
  });
});

/** Minimal chainable stub for the GROUP BY rating query. */
const breakdownQueryBuilder = (rows: Array<{ rating: number; count: string }>) => ({
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue(rows),
});
