import 'package:agromagnat/core/pagination/paginated.dart';
import 'package:agromagnat/features/add_listing/presentation/providers/draft_controller.dart';
import 'package:agromagnat/features/listings/data/fixtures/catalog_fixtures.dart';
import 'package:agromagnat/features/listings/data/photo_picker.dart';
import 'package:agromagnat/features/listings/data/repositories/mock_listing_repository.dart';
import 'package:agromagnat/features/listings/domain/entities/draft_photo.dart';
import 'package:agromagnat/features/listings/domain/entities/listing.dart';
import 'package:agromagnat/features/listings/domain/entities/listing_draft.dart';
import 'package:agromagnat/features/listings/domain/repositories/listing_repository.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/test_harness.dart';

/// Stands in for the camera and the gallery, neither of which exists under
/// `flutter test` — `image_picker` talks to a platform channel.
class FakePhotoPicker implements PhotoPicker {
  FakePhotoPicker({this.cameraResult, this.galleryResults = const []});

  DraftPhoto? cameraResult;
  List<DraftPhoto> galleryResults;

  int lastGalleryLimit = -1;

  @override
  Future<DraftPhoto?> takePhoto() async => cameraResult;

  @override
  Future<List<DraftPhoto>> pickFromGallery({required int limit}) async {
    lastGalleryLimit = limit;
    return galleryResults.take(limit).toList();
  }
}

DraftPhoto photo(String name) =>
    DraftPhoto(path: '/tmp/$name.jpg', sizeBytes: 180 * 1024);

void main() {
  late FakePhotoPicker picker;
  late MockListingRepository repository;
  late DraftController controller;

  setUp(() {
    picker = FakePhotoPicker();
    repository = MockListingRepository(now: testNow, latency: Duration.zero);
    controller = DraftController(repository, picker);
  });

  /// Fills [target] with a draft that would pass validation.
  void fillValidDraft(DraftController target) {
    target.setCategory(CatalogFixtures.categoryById('cat-sabzavot'));
    target.setTitle('Urgut pomidori');
    target.setQuantity(12);
    target.setPrice(9500);
    target.setRegion(CatalogFixtures.regions.first);
    target.setDistrict(CatalogFixtures.districts.first);
  }

  group('choosing photos', () {
    test('a camera shot lands on the draft', () async {
      picker.cameraResult = photo('a');
      await controller.addFromCamera();

      expect(controller.state.draft.photos, [photo('a')]);
    });

    test('backing out of the camera changes nothing', () async {
      picker.cameraResult = null;
      await controller.addFromCamera();

      expect(controller.state.draft.photos, isEmpty);
    });

    test('the gallery is asked only for the slots that are left', () async {
      picker.galleryResults = [photo('a'), photo('b')];
      await controller.addFromGallery();
      expect(picker.lastGalleryLimit, 5);

      picker.galleryResults = [photo('c')];
      await controller.addFromGallery();
      // Asking for five again would let the picker hand back more than the
      // API accepts, and the extras would be dropped after the seller chose
      // them — which reads as the app losing their photos.
      expect(picker.lastGalleryLimit, 3);
    });

    test('never exceeds the API ceiling', () async {
      picker.galleryResults = [
        for (var i = 0; i < 9; i++) photo('p$i'),
      ];
      await controller.addFromGallery();

      expect(controller.state.draft.photos.length, DraftController.maxPhotos);
    });

    test('the same file picked twice is added once', () async {
      picker.galleryResults = [photo('a'), photo('b')];
      await controller.addFromGallery();

      picker.galleryResults = [photo('b'), photo('c')];
      await controller.addFromGallery();

      // Two identical photos on a listing look like a mistake because they
      // are one, and a gallery grid makes double-tapping easy.
      expect(
        controller.state.draft.photos.map((p) => p.path),
        ['/tmp/a.jpg', '/tmp/b.jpg', '/tmp/c.jpg'],
      );
    });

    test('stops asking once full', () async {
      picker.galleryResults = [for (var i = 0; i < 5; i++) photo('p$i')];
      await controller.addFromGallery();

      picker.lastGalleryLimit = -1;
      await controller.addFromGallery();

      expect(picker.lastGalleryLimit, -1, reason: 'picker should not open');
      expect(controller.remainingPhotoSlots, 0);
    });
  });

  group('ordering and removal', () {
    setUp(() async {
      picker.galleryResults = [photo('a'), photo('b'), photo('c')];
      await controller.addFromGallery();
    });

    test('the first photo is the cover', () {
      expect(controller.state.draft.photos.first, photo('a'));
    });

    test('promoting a photo moves it to the front, keeping the rest in order',
        () {
      controller.makeCover(photo('c'));

      expect(
        controller.state.draft.photos.map((p) => p.path),
        ['/tmp/c.jpg', '/tmp/a.jpg', '/tmp/b.jpg'],
      );
    });

    test('removing frees a slot', () {
      controller.removePhoto(photo('b'));

      expect(
        controller.state.draft.photos.map((p) => p.path),
        ['/tmp/a.jpg', '/tmp/c.jpg'],
      );
      expect(controller.remainingPhotoSlots, 3);
    });

    test('removing the cover promotes the next one', () {
      controller.removePhoto(photo('a'));
      expect(controller.state.draft.photos.first, photo('b'));
    });
  });

  group('publishing', () {
    test('a listing without photos publishes in one step', () async {
      fillValidDraft(controller);

      expect(await controller.submit(), isTrue);
      expect(controller.state.published, isNotNull);
      expect(controller.state.published!.photos, isEmpty);
      expect(controller.state.photoFailure, isNull);
    });

    test('photos are attached after the listing exists', () async {
      fillValidDraft(controller);
      picker.galleryResults = [photo('a'), photo('b')];
      await controller.addFromGallery();

      expect(await controller.submit(), isTrue);

      expect(controller.state.published!.photos.length, 2);
      expect(controller.state.uploaded, 2);
    });

    test('a failed upload still counts as published', () async {
      final target = DraftController(
        _UploadFailsRepository(repository),
        picker,
      );
      fillValidDraft(target);

      picker.galleryResults = [photo('a')];
      await target.addFromGallery();

      expect(await target.submit(), isTrue);

      // The listing is live. Reporting a failure would send the seller round
      // to post the whole thing a second time.
      expect(target.state.published, isNotNull);
      expect(target.state.failure, isNull);
      expect(target.state.photoFailure, isNotNull);
    });
  });
}

/// Publishes fine, then loses the photos — the EDGE failure that matters.
class _UploadFailsRepository implements ListingRepository {
  _UploadFailsRepository(this._inner);

  final ListingRepository _inner;

  @override
  Future<Listing> create(ListingDraft draft) => _inner.create(draft);

  @override
  Future<Listing> addPhotos(String listingId, List<DraftPhoto> photos) =>
      Future.error(Exception('upload timed out'));

  @override
  Future<Listing> byId(String id) => _inner.byId(id);

  @override
  Future<Paginated<Listing>> search(ListingQuery query) => _inner.search(query);

  @override
  Future<void> setFavorite(String id, {required bool saved}) =>
      _inner.setFavorite(id, saved: saved);

  @override
  Future<Paginated<Listing>> mine({String? cursor, int limit = 20}) =>
      _inner.mine(cursor: cursor, limit: limit);

  @override
  Future<Listing> update(String id, ListingDraft draft) =>
      _inner.update(id, draft);

  @override
  Future<Listing> markSold(String id) => _inner.markSold(id);

  @override
  Future<void> remove(String id) => _inner.remove(id);
}
