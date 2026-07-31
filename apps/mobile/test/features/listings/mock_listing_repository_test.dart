import 'package:agromagnat/features/listings/data/repositories/mock_listing_repository.dart';
import 'package:agromagnat/features/listings/domain/entities/units.dart';
import 'package:agromagnat/features/listings/domain/repositories/listing_repository.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/test_harness.dart';

/// The mock is the contract the screens are written against, so its filtering,
/// sorting and paging are tested as real behaviour. A mock that quietly
/// ignored its query would let a broken filter ship and only surface when the
/// API was wired in.
void main() {
  late MockListingRepository repository;

  setUp(() {
    repository = MockListingRepository(now: testNow, latency: Duration.zero);
  });

  group('search', () {
    test('returns only active listings', () async {
      final page = await repository.search(const ListingQuery(limit: 100));

      expect(page.items, isNotEmpty);
      expect(page.items.every((listing) => listing.status.isPublic), isTrue);
    });

    test('matches text against title, place and category', () async {
      final byCrop = await repository.search(const ListingQuery(text: 'pomidor'));
      expect(byCrop.items, isNotEmpty);

      // A buyer searches "urgut" as readily as they search a crop name.
      final byPlace = await repository.search(const ListingQuery(text: 'urgut'));
      expect(byPlace.items, isNotEmpty);
      expect(byPlace.items.first.district.nameUz, 'Urgut');
    });

    test('text matching ignores case', () async {
      final lower = await repository.search(const ListingQuery(text: 'anor'));
      final upper = await repository.search(const ListingQuery(text: 'ANOR'));

      expect(upper.items.map((listing) => listing.id),
          lower.items.map((listing) => listing.id));
    });

    test('filters by category and region', () async {
      final page = await repository.search(
        const ListingQuery(categoryId: 'cat-meva', limit: 100),
      );

      expect(page.items, isNotEmpty);
      expect(
        page.items.every((listing) => listing.category.id == 'cat-meva'),
        isTrue,
      );

      final regional = await repository.search(
        const ListingQuery(regionId: 'reg-sam', limit: 100),
      );
      expect(
        regional.items.every((listing) => listing.region.id == 'reg-sam'),
        isTrue,
      );
    });

    test('filters by price range', () async {
      final page = await repository.search(
        const ListingQuery(minPrice: 10000, maxPrice: 25000, limit: 100),
      );

      expect(page.items, isNotEmpty);
      expect(
        page.items.every((listing) => listing.price >= 10000 && listing.price <= 25000),
        isTrue,
      );
    });

    test('only compares volume within a matching unit', () async {
      // 5 kg is not less than 5 t, so a volume filter that ignored the unit
      // would return nonsense.
      final page = await repository.search(
        const ListingQuery(
          minQuantity: 20,
          quantityUnit: QuantityUnit.t,
          limit: 100,
        ),
      );

      expect(page.items, isNotEmpty);
      expect(
        page.items.every(
          (listing) => listing.quantityUnit == QuantityUnit.t && listing.quantity >= 20,
        ),
        isTrue,
      );
    });

    test('returns an empty page rather than throwing when nothing matches',
        () async {
      final page = await repository.search(
        const ListingQuery(text: 'kakao dukkagi'),
      );

      expect(page.items, isEmpty);
      expect(page.hasMore, isFalse);
    });
  });

  group('sorting', () {
    test('promoted listings lead every ordering', () async {
      for (final sort in ListingSort.values) {
        final page = await repository.search(
          ListingQuery(sort: sort, limit: 100),
        );
        final promoted = page.items.takeWhile((listing) => listing.isPromoted);

        expect(promoted, isNotEmpty, reason: 'no promoted listing led $sort');
        expect(
          page.items.skip(promoted.length).any((listing) => listing.isPromoted),
          isFalse,
          reason: 'a promoted listing appeared after an unpromoted one in $sort',
        );
      }
    });

    test('orders by price within the unpromoted band', () async {
      final page = await repository.search(
        const ListingQuery(sort: ListingSort.priceAsc, limit: 100),
      );
      final rest = page.items.where((listing) => !listing.isPromoted).toList();

      for (var i = 1; i < rest.length; i++) {
        expect(rest[i].price >= rest[i - 1].price, isTrue);
      }
    });

    test('orders by volume descending', () async {
      final page = await repository.search(
        const ListingQuery(sort: ListingSort.volumeDesc, limit: 100),
      );
      final rest = page.items.where((listing) => !listing.isPromoted).toList();

      for (var i = 1; i < rest.length; i++) {
        expect(rest[i].quantity <= rest[i - 1].quantity, isTrue);
      }
    });
  });

  group('paging', () {
    test('walks the whole result set without gaps or repeats', () async {
      final all = await repository.search(const ListingQuery(limit: 100));

      final collected = <String>[];
      String? cursor;
      var guard = 0;

      do {
        final page = await repository.search(
          ListingQuery(limit: 4, cursor: cursor),
        );
        collected.addAll(page.items.map((listing) => listing.id));
        cursor = page.nextCursor;
        guard++;
      } while (cursor != null && guard < 20);

      expect(collected.toSet().length, collected.length, reason: 'a page repeated');
      expect(collected.length, all.items.length);
    });

    test('reports no next cursor on the final page', () async {
      final page = await repository.search(const ListingQuery(limit: 100));
      expect(page.hasMore, isFalse);
      expect(page.nextCursor, isNull);
    });
  });

  group('favorites', () {
    test('toggles on and off, and survives a refetch', () async {
      final page = await repository.search(const ListingQuery(limit: 1));
      final id = page.items.first.id;

      expect(page.items.first.isFavorite, isFalse);

      final saved = await repository.toggleFavorite(id);
      expect(saved.isFavorite, isTrue);

      // The state lives in the repository, not on the entity, so a fresh read
      // has to still report it — same as the API does with a token.
      final refetched = await repository.byId(id);
      expect(refetched.isFavorite, isTrue);

      final unsaved = await repository.toggleFavorite(id);
      expect(unsaved.isFavorite, isFalse);
    });
  });

  group('byId', () {
    test('throws for an id that does not resolve', () async {
      expect(
        () => repository.byId('lst-yoq'),
        throwsA(isA<ListingNotFoundException>()),
      );
    });
  });
}
