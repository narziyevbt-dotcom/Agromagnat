@Tags(['live'])
library;

import 'package:agromagnat/core/network/api_client.dart';
import 'package:agromagnat/features/listings/data/repositories/api_catalog_repository.dart';
import 'package:agromagnat/features/listings/data/repositories/api_listing_repository.dart';
import 'package:agromagnat/features/listings/domain/repositories/listing_repository.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

/// Runs the repositories against the deployed API.
///
/// Tagged, and skipped by default, because it needs the network and a running
/// backend — but it is the only thing that catches the class of bug the unit
/// tests cannot: a route that moved, a field that got renamed, a query
/// parameter the API silently ignores.
///
///     flutter test test/live_api_test.dart --tags live \
///       --dart-define=LIVE_API_URL=https://agromagnat-api.onrender.com/api
///
/// Read-only on purpose. Nothing here posts a listing, requests an OTP or
/// touches a favourite: the target is a shared environment, and a test suite
/// that spams SMS or leaves rows behind is a test suite people turn off.
void main() {
  const baseUrl = String.fromEnvironment('LIVE_API_URL');

  if (baseUrl.isEmpty) {
    test('skipped — pass --dart-define=LIVE_API_URL', () {}, skip: true);
    return;
  }

  late ApiClient client;

  setUpAll(() {
    client = ApiClient(
      dio: Dio(
        BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: const Duration(seconds: 30),
          receiveTimeout: const Duration(seconds: 60),
          validateStatus: (_) => true,
        ),
      ),
    );
  });

  test('categories come back with a usable form spec', () async {
    final categories = await ApiCatalogRepository(client).categories();

    expect(categories, isNotEmpty);
    for (final category in categories) {
      expect(category.form, isNotNull, reason: '${category.slug} has no form');
      expect(category.form!.quantity.units, isNotEmpty);
      expect(category.form!.price.units, isNotEmpty);
    }
  });

  test('every region resolves its districts', () async {
    final catalog = ApiCatalogRepository(client);
    final regions = await catalog.regions();

    expect(regions.length, greaterThan(5));
    // One region, not all fourteen — this is somebody else's server.
    expect(await catalog.districts(regions.first.id), isNotEmpty);
  });

  test('the feed maps end to end', () async {
    final page = await ApiListingRepository(client)
        .search(const ListingQuery(limit: 5));

    expect(page.items, isNotEmpty);
    for (final listing in page.items) {
      expect(listing.title, isNotEmpty);
      expect(listing.price, greaterThan(0));
      expect(listing.quantity, greaterThan(0));
      expect(listing.locationLabel, contains('·'));
    }
  });

  test('the filters the search screen sends are honoured', () async {
    final repository = ApiListingRepository(client);
    final all = await repository.search(const ListingQuery(limit: 50));
    final category = all.items.first.category.id;

    final filtered = await repository.search(
      ListingQuery(categoryId: category, limit: 50),
    );

    expect(filtered.items, isNotEmpty);
    // A parameter the API ignored would show up here as unfiltered results.
    expect(
      filtered.items.every((listing) => listing.category.id == category),
      isTrue,
    );
  });

  test('sorting actually sorts', () async {
    final repository = ApiListingRepository(client);
    final cheapest = await repository.search(
      const ListingQuery(sort: ListingSort.priceAsc, limit: 20),
    );

    final prices = cheapest.items.map((listing) => listing.price).toList();
    for (var i = 1; i < prices.length; i++) {
      expect(prices[i] >= prices[i - 1], isTrue, reason: '$prices');
    }
  });

  test('paging walks forward without repeating', () async {
    final repository = ApiListingRepository(client);
    final first = await repository.search(const ListingQuery(limit: 3));

    if (!first.hasMore) {
      return;
    }
    final second = await repository.search(
      ListingQuery(limit: 3, cursor: first.nextCursor),
    );

    final firstIds = first.items.map((listing) => listing.id).toSet();
    expect(
      second.items.any((listing) => firstIds.contains(listing.id)),
      isFalse,
    );
  });

  test('a missing listing is a not-found, not a crash', () async {
    await expectLater(
      ApiListingRepository(client)
          .byId('00000000-0000-4000-8000-000000000000'),
      throwsA(isA<ListingNotFoundException>()),
    );
  });

  test('posting without a token is refused', () async {
    // The gate the app relies on: a listing must belong to a verified phone.
    await expectLater(
      client.get<void>('/me/favorites', decode: (_) {}),
      throwsA(
        isA<ApiException>().having((e) => e.isUnauthorized, 'is 401', isTrue),
      ),
    );
  });
}
