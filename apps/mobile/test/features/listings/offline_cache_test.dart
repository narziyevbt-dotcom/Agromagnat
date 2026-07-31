import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:agromagnat/core/cache/json_cache.dart';
import 'package:agromagnat/core/network/api_client.dart';
import 'package:agromagnat/features/listings/data/repositories/api_catalog_repository.dart';
import 'package:agromagnat/features/listings/data/repositories/api_listing_repository.dart';
import 'package:agromagnat/features/listings/domain/repositories/listing_repository.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Answers from a script and can be switched offline mid-test.
class _Adapter implements HttpClientAdapter {
  _Adapter(this.handler);

  final ResponseBody Function(RequestOptions options) handler;
  bool offline = false;
  int calls = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    calls++;
    if (offline) {
      throw DioException.connectionError(
        requestOptions: options,
        reason: 'no route to host',
      );
    }
    return handler(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(Object body, {int status = 200}) => ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );

dynamic _fixture(String name) =>
    jsonDecode(File('test/fixtures/$name').readAsStringSync());

void main() {
  late JsonCache cache;
  late Map<String, dynamic> feedPage;
  late List<dynamic> categories;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    cache = JsonCache(await SharedPreferences.getInstance());
    feedPage = _fixture('listings_page.json') as Map<String, dynamic>;
    categories = _fixture('categories.json') as List<dynamic>;
  });

  ApiClient client(_Adapter adapter) {
    final dio = Dio(
      BaseOptions(baseUrl: 'https://x/api', validateStatus: (_) => true),
    )..httpClientAdapter = adapter;
    return ApiClient(dio: dio);
  }

  group('the feed', () {
    test('a page fetched once opens again with no signal', () async {
      final adapter = _Adapter((_) => _json(feedPage));
      final repository = ApiListingRepository(client(adapter), cache: cache);

      final fresh = await repository.search(const ListingQuery());
      expect(fresh.items, isNotEmpty);
      expect(fresh.isStale, isFalse);

      adapter.offline = true;
      final offline = await repository.search(const ListingQuery());

      // The screen a farmer opens the app to. Empty here means the app looks
      // broken in exactly the place it is used most.
      expect(offline.items.map((l) => l.id), fresh.items.map((l) => l.id));
      expect(offline.isStale, isTrue);
      expect(offline.cachedAt, isNotNull);
    });

    test('a cached page carries no cursor', () async {
      final adapter = _Adapter((_) => _json(feedPage));
      final repository = ApiListingRepository(client(adapter), cache: cache);
      await repository.search(const ListingQuery());

      adapter.offline = true;
      final offline = await repository.search(const ListingQuery());

      // Paging on from disk would ask the server to continue something it
      // never sent.
      expect(offline.hasMore, isFalse);
    });

    test('a filtered search is not served from the feed cache', () async {
      final adapter = _Adapter((_) => _json(feedPage));
      final repository = ApiListingRepository(client(adapter), cache: cache);
      await repository.search(const ListingQuery());

      adapter.offline = true;

      // A buyer who filtered to one region expects an answer to that
      // question, not the unfiltered feed wearing its label.
      await expectLater(
        repository.search(const ListingQuery(regionId: 'reg-1')),
        throwsA(isA<ApiException>()),
      );
    });

    test('a server error is not papered over with yesterday', () async {
      final adapter = _Adapter((_) => _json(feedPage));
      final repository = ApiListingRepository(client(adapter), cache: cache);
      await repository.search(const ListingQuery());

      final broken = _Adapter((_) => _json({'message': 'boom'}, status: 500));
      final second = ApiListingRepository(client(broken), cache: cache);

      // The server answered. Showing an old feed as though nothing happened
      // hides a real fault.
      await expectLater(
        second.search(const ListingQuery()),
        throwsA(isA<ApiException>()),
      );
    });

    test('paints from disk before a request is even sent', () async {
      final adapter = _Adapter((_) => _json(feedPage));
      final repository = ApiListingRepository(client(adapter), cache: cache);
      await repository.search(const ListingQuery());

      final callsSoFar = adapter.calls;
      final painted = repository.cachedFeed(const ListingQuery());

      // Waiting out a fifteen-second connect timeout and then showing what
      // was on disk all along is the worst of both.
      expect(painted, isNotNull);
      expect(painted!.items, isNotEmpty);
      expect(adapter.calls, callsSoFar);
    });

    test('with nothing stored there is nothing to paint', () {
      final adapter = _Adapter((_) => _json(feedPage));
      final repository = ApiListingRepository(client(adapter), cache: cache);

      expect(repository.cachedFeed(const ListingQuery()), isNull);
    });
  });

  group('a listing', () {
    test('opened once opens again in a dead spot', () async {
      final row = (feedPage['items'] as List).first as Map<String, dynamic>;
      final adapter = _Adapter((_) => _json(row));
      final repository = ApiListingRepository(client(adapter), cache: cache);

      final fresh = await repository.byId(row['id'] as String);

      adapter.offline = true;
      final offline = await repository.byId(row['id'] as String);

      // Where the buyer is standing when they decide to call.
      expect(offline.id, fresh.id);
      expect(offline.seller.phone, fresh.seller.phone);
    });

    test('deleted upstream is dropped rather than kept forever', () async {
      final row = (feedPage['items'] as List).first as Map<String, dynamic>;
      final id = row['id'] as String;

      final adapter = _Adapter((_) => _json(row));
      final repository = ApiListingRepository(client(adapter), cache: cache);
      await repository.byId(id);

      final gone = _Adapter((_) => _json({'message': 'not found'}, status: 404));
      final second = ApiListingRepository(client(gone), cache: cache);

      await expectLater(
        second.byId(id),
        throwsA(isA<ListingNotFoundException>()),
      );

      // And it stays gone — serving a deleted listing offline would send a
      // buyer to call about something that no longer exists.
      final offline = _Adapter((_) => _json(row))..offline = true;
      await expectLater(
        ApiListingRepository(client(offline), cache: cache).byId(id),
        throwsA(isA<ApiException>()),
      );
    });
  });

  group('the catalogue', () {
    test('survives having no signal, so the form still opens', () async {
      final adapter = _Adapter((_) => _json(categories));
      final repository = ApiCatalogRepository(client(adapter), cache: cache);

      final fresh = await repository.categories();
      expect(fresh, isNotEmpty);

      adapter.offline = true;
      final offline = await repository.categories();

      // Without this the posting form has no categories, and a farmer with a
      // truck of tomatoes and one bar of signal cannot post at all.
      expect(offline.map((c) => c.slug), fresh.map((c) => c.slug));
      expect(offline.first.form, isNotNull);
    });

    test('districts are cached per region', () async {
      final districts = [
        {'id': 'd1', 'regionId': 'r1', 'nameUz': 'Urgut', 'slug': 'urgut'},
      ];
      final adapter = _Adapter((_) => _json(districts));
      final repository = ApiCatalogRepository(client(adapter), cache: cache);

      await repository.districts('r1');
      adapter.offline = true;

      expect((await repository.districts('r1')).single.nameUz, 'Urgut');
      // A region never opened has nothing stored, and says so.
      await expectLater(
        repository.districts('r2'),
        throwsA(isA<ApiException>()),
      );
    });
  });

  test('with no cache at all, nothing breaks — it just does not cache',
      () async {
    final adapter = _Adapter((_) => _json(feedPage));
    final repository = ApiListingRepository(client(adapter));

    expect((await repository.search(const ListingQuery())).items, isNotEmpty);
    expect(repository.cachedFeed(const ListingQuery()), isNull);

    adapter.offline = true;
    await expectLater(
      repository.search(const ListingQuery()),
      throwsA(isA<ApiException>()),
    );
  });
}
