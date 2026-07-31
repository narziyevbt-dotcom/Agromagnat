import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:agromagnat/core/cache/json_cache.dart';
import 'package:agromagnat/core/network/api_client.dart';
import 'package:agromagnat/features/add_listing/presentation/providers/draft_controller.dart';
import 'package:agromagnat/features/listings/data/fixtures/catalog_fixtures.dart';
import 'package:agromagnat/features/listings/data/listing_outbox.dart';
import 'package:agromagnat/features/listings/data/repositories/api_listing_repository.dart';
import 'package:agromagnat/features/listings/presentation/providers/outbox_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../add_listing/photos_test.dart' show FakePhotoPicker, photo;

/// Offline unless told otherwise, and countable.
class _Adapter implements HttpClientAdapter {
  _Adapter(this.handler);

  final ResponseBody Function(RequestOptions options) handler;
  bool offline = true;
  int posts = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (options.method == 'POST') {
      posts++;
    }
    if (offline) {
      throw DioException.connectionError(
        requestOptions: options,
        reason: 'no signal',
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

void main() {
  late JsonCache cache;
  late ListingOutbox outbox;
  late PhotoOutbox photoOutbox;
  late Map<String, dynamic> createdRow;
  late Directory tempDir;

  /// A real file on disk: the upload path opens it, so a made-up path fails
  /// before the request is even built and would test the wrong branch.
  String realPhoto(String name) {
    final file = File('${tempDir.path}/$name')
      ..writeAsBytesSync(List<int>.filled(64, 0));
    return file.path;
  }

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    cache = JsonCache(await SharedPreferences.getInstance());
    outbox = ListingOutbox(cache);
    photoOutbox = PhotoOutbox(cache);
    tempDir = Directory.systemTemp.createTempSync('outbox_test');
    addTearDown(() => tempDir.deleteSync(recursive: true));
    createdRow = ((jsonDecode(
      File('test/fixtures/listings_page.json').readAsStringSync(),
    ) as Map)['items'] as List)
        .first as Map<String, dynamic>;
  });

  ApiListingRepository repository(_Adapter adapter) {
    final dio = Dio(
      BaseOptions(baseUrl: 'https://x/api', validateStatus: (_) => true),
    )..httpClientAdapter = adapter;
    return ApiListingRepository(ApiClient(dio: dio), cache: cache);
  }

  OutboxController outboxController(ApiListingRepository repo) =>
      OutboxController(outbox, repo, photos: photoOutbox);

  DraftController draftController(
    ApiListingRepository repo,
    OutboxController controller,
  ) {
    final draft = DraftController(
      repo,
      FakePhotoPicker(),
      onQueue: (body, photos) =>
          controller.enqueue(body: body, photoPaths: photos),
    );
    draft.setCategory(CatalogFixtures.categoryById('cat-sabzavot'));
    draft.setTitle('Urgut pomidori');
    draft.setQuantity(12);
    draft.setPrice(9500);
    draft.setRegion(CatalogFixtures.regions.first);
    draft.setDistrict(CatalogFixtures.districts.first);
    return draft;
  }

  group('publishing with no signal', () {
    test('queues instead of losing the listing', () async {
      final adapter = _Adapter((_) => _json(createdRow));
      final repo = repository(adapter);
      final controller = outboxController(repo);
      final draft = draftController(repo, controller);

      // Reported as success. The seller typed this once, in the sun, on a
      // phone keyboard — telling them it failed is how it gets typed twice.
      expect(await draft.submit(), isTrue);
      expect(draft.state.queued, isTrue);
      expect(draft.state.published, isNull);
      expect(controller.state.pending, 1);
    });

    test('survives the app being killed', () async {
      final adapter = _Adapter((_) => _json(createdRow));
      final repo = repository(adapter);
      final controller = outboxController(repo);
      await draftController(repo, controller).submit();

      // A fresh controller reading the same disk — what a cold start does.
      final reopened =
          OutboxController(ListingOutbox(cache), repo, photos: photoOutbox);

      expect(reopened.state.pending, 1);
      expect(reopened.state.entries.single.title, 'Urgut pomidori');
    });

    test('keeps the photos with it', () async {
      final adapter = _Adapter((_) => _json(createdRow));
      final repo = repository(adapter);
      final controller = outboxController(repo);

      final picker = FakePhotoPicker(galleryResults: [photo('a'), photo('b')]);
      final draft = DraftController(
        repo,
        picker,
        onQueue: (body, photos) =>
            controller.enqueue(body: body, photoPaths: photos),
      );
      draft.setCategory(CatalogFixtures.categoryById('cat-sabzavot'));
      draft.setTitle('Urgut pomidori');
      draft.setQuantity(12);
      draft.setPrice(9500);
      draft.setRegion(CatalogFixtures.regions.first);
      draft.setDistrict(CatalogFixtures.districts.first);
      await draft.addFromGallery();

      await draft.submit();

      expect(controller.state.entries.single.photoPaths.length, 2);
    });

    test('an invalid listing is still rejected, not queued', () async {
      final adapter = _Adapter((_) => _json(createdRow));
      final repo = repository(adapter);
      final controller = outboxController(repo);

      final draft = DraftController(
        repo,
        FakePhotoPicker(),
        onQueue: (body, photos) =>
            controller.enqueue(body: body, photoPaths: photos),
      );
      draft.setCategory(CatalogFixtures.categoryById('cat-sabzavot'));

      // Queueing something the server will never accept just moves the
      // failure later, where it is harder to explain.
      expect(await draft.submit(), isFalse);
      expect(controller.state.pending, 0);
      expect(draft.state.errors, isNotEmpty);
    });
  });

  group('flushing', () {
    test('sends the queue once the signal comes back', () async {
      final adapter = _Adapter((_) => _json(createdRow));
      final repo = repository(adapter);
      final controller = outboxController(repo);
      await draftController(repo, controller).submit();

      adapter.offline = false;
      expect(await controller.flush(), 1);
      expect(controller.state.pending, 0);
    });

    test('still offline leaves everything queued', () async {
      final adapter = _Adapter((_) => _json(createdRow));
      final repo = repository(adapter);
      final controller = outboxController(repo);
      await draftController(repo, controller).submit();

      expect(await controller.flush(), 0);
      expect(controller.state.pending, 1);
    });

    test('stops at the first dead request rather than working the queue',
        () async {
      final adapter = _Adapter((_) => _json(createdRow));
      final repo = repository(adapter);
      final controller = outboxController(repo);

      for (var i = 0; i < 3; i++) {
        await draftController(repo, controller).submit();
      }
      expect(controller.state.pending, 3);

      final postsBefore = adapter.posts;
      await controller.flush();

      // Three failures cost the same battery as one and tell you nothing more.
      expect(adapter.posts - postsBefore, 1);
    });

    test('a body the server refuses is counted, then given up on', () async {
      final adapter = _Adapter(
        (_) => _json({'message': ['title kamida 3 ta belgi']}, status: 400),
      );
      final repo = repository(adapter);
      final controller = outboxController(repo);
      await draftController(repo, controller).submit();

      adapter.offline = false;
      for (var i = 0; i < ListingOutbox.maxAttempts; i++) {
        await controller.flush();
      }

      // It stays — the seller typed it — but it stops being retried on every
      // launch, and the banner says a person needs to look at it.
      expect(controller.state.pending, 1);
      expect(controller.state.stuck, hasLength(1));

      final postsBefore = adapter.posts;
      await controller.flush();
      expect(adapter.posts, postsBefore);
    });

    test('a listing whose photos fail is still done, and they queue', () async {
      final adapter = _Adapter((options) {
        if (options.path.contains('/photos')) {
          return _json({'message': 'nope'}, status: 500);
        }
        return _json(createdRow);
      });
      final repo = repository(adapter);
      final controller = outboxController(repo);

      final picker = FakePhotoPicker(galleryResults: [photo('a')]);
      final draft = DraftController(
        repo,
        picker,
        onQueue: (body, photos) =>
            controller.enqueue(body: body, photoPaths: photos),
      );
      draft.setCategory(CatalogFixtures.categoryById('cat-sabzavot'));
      draft.setTitle('Urgut pomidori');
      draft.setQuantity(12);
      draft.setPrice(9500);
      draft.setRegion(CatalogFixtures.regions.first);
      draft.setDistrict(CatalogFixtures.districts.first);
      await draft.addFromGallery();
      await draft.submit();

      adapter.offline = false;
      await controller.flush();

      // The listing is live — sending it again is the one thing that must not
      // happen — and the photos are not dropped on the floor either.
      expect(controller.state.pending, 0);
      expect(controller.state.pendingPhotos, 1);
    });

    test('nothing queued is a no-op', () async {
      final adapter = _Adapter((_) => _json(createdRow))..offline = false;
      final controller = outboxController(repository(adapter));

      expect(await controller.flush(), 0);
      expect(adapter.posts, 0);
    });
  });

  group('photos for a listing that is already live', () {
    test('go up when the signal comes back', () async {
      final adapter = _Adapter((_) => _json(createdRow))..offline = false;
      final repo = repository(adapter);
      final controller = outboxController(repo);

      await controller.enqueuePhotos(
        listingId: 'lst-1',
        paths: [realPhoto('a.jpg')],
        now: DateTime(2026, 7, 31, 12),
      );
      expect(controller.state.pendingPhotos, 1);

      await controller.flush();
      expect(controller.state.pendingPhotos, 0);
    });

    test('survive the app being killed', () async {
      final controller = outboxController(repository(_Adapter((_) => _json(createdRow))));
      await controller.enqueuePhotos(
        listingId: 'lst-1',
        paths: ['/tmp/a.jpg', '/tmp/b.jpg'],
        title: 'Urgut pomidori',
        now: DateTime(2026, 7, 31, 12),
      );

      final reopened = PhotoOutbox(cache).read();
      expect(reopened.single.paths, hasLength(2));
      expect(reopened.single.title, 'Urgut pomidori');
    });

    test('a second attempt at the same listing replaces the first', () async {
      final controller = outboxController(repository(_Adapter((_) => _json(createdRow))));

      for (var i = 0; i < 3; i++) {
        await controller.enqueuePhotos(
          listingId: 'lst-1',
          paths: ['/tmp/a.jpg'],
          now: DateTime(2026, 7, 31, 12, i),
        );
      }

      // Otherwise a seller who retries three times uploads the same photo
      // three times.
      expect(PhotoOutbox(cache).read(), hasLength(1));
    });

    test('a deleted listing drops its photos instead of retrying forever',
        () async {
      final adapter = _Adapter(
        (_) => _json({'message': 'topilmadi'}, status: 404),
      )..offline = false;
      final controller = outboxController(repository(adapter));

      await controller.enqueuePhotos(
        listingId: 'lst-gone',
        paths: [realPhoto('a.jpg')],
        now: DateTime(2026, 7, 31, 12),
      );
      await controller.flush();

      expect(controller.state.pendingPhotos, 0);
    });

    test('a file the OS cleared is given up on after three tries', () async {
      final adapter = _Adapter(
        (_) => _json({'message': 'nope'}, status: 500),
      )..offline = false;
      final controller = outboxController(repository(adapter));

      await controller.enqueuePhotos(
        listingId: 'lst-1',
        paths: ['/tmp/a.jpg'],
        now: DateTime(2026, 7, 31, 12),
      );

      for (var i = 0; i < PhotoOutbox.maxAttempts; i++) {
        await controller.flush();
      }
      final before = adapter.posts;
      await controller.flush();

      expect(adapter.posts, before);
    });

    test('nothing queued at all is still a no-op', () async {
      final adapter = _Adapter((_) => _json(createdRow))..offline = false;
      final controller = outboxController(repository(adapter));

      expect(await controller.flush(), 0);
      expect(adapter.posts, 0);
    });
  });

  group('the queue itself', () {
    test('an entry a newer build cannot read is skipped, not fatal', () async {
      await cache.write('outbox', [
        {'id': 'ok', 'body': {'title': 'A'}, 'queuedAt': '2026-07-31T12:00:00Z'},
        {'nonsense': true},
      ]);

      // One unreadable row must not cost the seller the listing beside it.
      expect(outbox.read(), hasLength(1));
      expect(outbox.read().single.title, 'A');
    });

    test('discarding removes just that one', () async {
      final now = DateTime(2026, 7, 31, 12);
      final first = await outbox.add(body: {'title': 'A'}, photoPaths: [], now: now);
      await outbox.add(
        body: {'title': 'B'},
        photoPaths: [],
        now: now.add(const Duration(seconds: 1)),
      );

      await outbox.remove(first.id);

      expect(outbox.read().single.title, 'B');
    });
  });
}
