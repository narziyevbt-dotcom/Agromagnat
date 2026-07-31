import 'package:agromagnat/core/localization/app_strings.dart';
import 'package:agromagnat/core/network/api_client.dart';
import 'package:agromagnat/core/pagination/paginated.dart';
import 'package:agromagnat/features/listings/domain/entities/draft_photo.dart';
import 'package:agromagnat/features/listings/domain/repositories/listing_repository.dart';
import 'package:agromagnat/features/add_listing/presentation/add_listing_screen.dart';
import 'package:agromagnat/features/add_listing/presentation/providers/draft_controller.dart';
import 'package:agromagnat/features/auth/data/mock_auth_repository.dart';
import 'package:agromagnat/features/listings/data/fixtures/catalog_fixtures.dart';
import 'package:agromagnat/features/listings/data/repositories/mock_listing_repository.dart';
import 'package:agromagnat/features/listings/domain/entities/listing.dart';
import 'package:agromagnat/features/listings/domain/entities/listing_draft.dart';
import 'package:agromagnat/features/listings/domain/entities/units.dart';
import 'package:agromagnat/features/listings/presentation/providers/listing_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/test_harness.dart';
import '../add_listing/photos_test.dart' show FakePhotoPicker, photo;

void main() {
  late MockListingRepository repository;

  setUp(() {
    repository = MockListingRepository(now: testNow, latency: Duration.zero);
  });

  Future<Listing> anOwnListing() async =>
      (await repository.mine()).items.firstWhere(
            (listing) => listing.status == ListingStatus.active,
          );

  DraftController editing(Listing listing, {FakePhotoPicker? picker}) {
    final controller =
        DraftController(repository, picker ?? FakePhotoPicker());
    controller.beginEdit(
      listing,
      CatalogFixtures.categoryById(listing.category.id),
    );
    return controller;
  }

  group('opening the form on a listing', () {
    test('every answer is already in it', () async {
      final listing = await anOwnListing();
      final draft = editing(listing).state.draft;

      expect(draft.title, listing.title);
      expect(draft.quantity, listing.quantity);
      expect(draft.quantityUnit, listing.quantityUnit);
      expect(draft.price, listing.price);
      expect(draft.priceUnit, listing.priceUnit);
      expect(draft.region!.id, listing.region.id);
      expect(draft.district!.id, listing.district.id);
      expect(draft.delivery, listing.delivery);
    });

    test('it is valid from the first frame', () async {
      // A form that opens with red under half its fields reads as broken, and
      // the seller came here to change one number.
      expect(editing(await anOwnListing()).state.draft.validate(), isEmpty);
    });

    test("the category's own answers come back too", () async {
      final category = CatalogFixtures.categoryById('cat-texnika');
      final listing = Listing(
        id: 'lst-x',
        title: 'MTZ-82 traktor',
        status: ListingStatus.active,
        quantity: 1,
        quantityUnit: QuantityUnit.dona,
        price: 90000000,
        priceUnit: PriceUnit.dona,
        category: category,
        region: CatalogFixtures.regions.first,
        district: CatalogFixtures.districts.first,
        seller: (await anOwnListing()).seller,
        createdAt: testNow,
        attributes: const {'condition': 'ishlatilgan', 'year': 2016},
      );

      final draft = editing(listing).state.draft;

      expect(draft.attributes['condition'], 'ishlatilgan');
      expect(draft.attributes['year'], 2016);
    });

    test('an answer the category no longer asks is dropped', () async {
      final listing = await anOwnListing();
      final stale = Listing(
        id: listing.id,
        title: listing.title,
        status: listing.status,
        quantity: listing.quantity,
        quantityUnit: listing.quantityUnit,
        price: listing.price,
        priceUnit: listing.priceUnit,
        category: listing.category,
        region: listing.region,
        district: listing.district,
        seller: listing.seller,
        createdAt: listing.createdAt,
        attributes: const {'kimdir_oylab_topgan_savol': 'ha'},
      );

      // Sending back an answer to a question that no longer exists would have
      // the server reject an edit the seller cannot see anything wrong with.
      expect(
        editing(stale).state.draft.attributes,
        isNot(contains('kimdir_oylab_topgan_savol')),
      );
    });

    test('photos already on it are not re-uploaded, but hold their slots',
        () async {
      final listing = (await anOwnListing()).withPhotos(const [
        ListingPhoto(id: 'p1', url: 'https://x/1.jpg'),
        ListingPhoto(id: 'p2', url: 'https://x/2.jpg'),
      ]);
      final controller = editing(listing);

      expect(controller.state.draft.photos, isEmpty);
      expect(
        controller.remainingPhotoSlots,
        DraftController.maxPhotos - listing.photos.length,
      );
    });
  });

  group('saving', () {
    test('changes the listing rather than posting a second one', () async {
      final listing = await anOwnListing();
      final before = (await repository.mine()).items.length;

      final controller = editing(listing)..setPrice(12345);
      expect(await controller.submit(), isTrue);

      final after = await repository.mine();
      expect(after.items.length, before);
      expect(
        after.items.firstWhere((l) => l.id == listing.id).price,
        12345,
      );
    });

    test('keeps the status it had', () async {
      final listing = await repository.markSold((await anOwnListing()).id);

      final controller = editing(listing)..setTitle('Yangi sarlavha');
      await controller.submit();

      // Correcting a sold listing does not put it back on the market.
      expect(
        (await repository.mine())
            .items
            .firstWhere((l) => l.id == listing.id)
            .status,
        ListingStatus.sold,
      );
    });

    test('a listing edited into an invalid state is rejected here', () async {
      final controller = editing(await anOwnListing())..setPrice(null);

      expect(await controller.submit(), isFalse);
      expect(controller.state.errors['price'], isNotNull);
    });

    test('new photos are added to the ones already there', () async {
      final listing = await anOwnListing();
      final picker = FakePhotoPicker(galleryResults: [photo('new')]);
      final controller = editing(listing, picker: picker);

      await controller.addFromGallery();
      expect(await controller.submit(), isTrue);

      expect(controller.state.published!.photos, isNotEmpty);
    });

    test('an edit is never queued when the signal dies', () async {
      final listing = await anOwnListing();
      var queued = false;

      final controller = DraftController(
        _OfflineRepository(repository),
        FakePhotoPicker(),
        onQueue: (_, __) async => queued = true,
      );
      controller.beginEdit(
        listing,
        CatalogFixtures.categoryById(listing.category.id),
      );
      controller.setPrice(1000);

      // The outbox replays creates. A queued edit would sit behind them with
      // no ordering, and "saqlandi" would be a lie until it went out.
      expect(await controller.submit(), isFalse);
      expect(queued, isFalse);
      expect(controller.state.failure, isNotNull);
    });
  });

  group('the screen', () {
    testWidgets('opens filled in, and says it is an edit', (tester) async {
      tester.view.physicalSize = const Size(1000, 4000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final auth = MockAuthRepository(latency: Duration.zero);
      final listing = await tester.runAsync(anOwnListing);

      await pumpApp(
        tester,
        AddListingScreen(
          editing: EditTarget(
            listing!,
            CatalogFixtures.categoryById(listing.category.id),
          ),
        ),
        auth: auth,
        tokenStore: await signedIn(tester, auth),
        overrides: [
          listingRepositoryProvider.overrideWithValue(repository),
          photoPickerProvider.overrideWithValue(FakePhotoPicker()),
        ],
      );

      expect(find.text(AppStrings.editTitle), findsOneWidget);
      expect(find.text(AppStrings.saveChanges), findsOneWidget);
      expect(find.text(AppStrings.publish), findsNothing);

      // The listing's own title is in the field, not a placeholder.
      expect(find.widgetWithText(TextFormField, listing.title), findsOneWidget);
    });
  });
}

/// Every write times out the way a phone with no bars does — an ApiException
/// with status 0, which is exactly what the outbox watches for.
class _OfflineRepository implements ListingRepository {
  _OfflineRepository(this._inner);

  final ListingRepository _inner;

  static const _dead = ApiException(0, 'Internet yo\'q');

  @override
  Future<Listing> update(String id, ListingDraft draft) => Future.error(_dead);

  @override
  Future<Listing> create(ListingDraft draft) => Future.error(_dead);

  @override
  Future<Paginated<Listing>> mine({String? cursor, int limit = 20}) =>
      _inner.mine(cursor: cursor, limit: limit);

  @override
  Future<Listing> markSold(String id) => _inner.markSold(id);

  @override
  Future<void> remove(String id) => _inner.remove(id);

  @override
  Future<Paginated<Listing>> search(ListingQuery query) => _inner.search(query);

  @override
  Future<Listing> byId(String id) => _inner.byId(id);

  @override
  Future<void> setFavorite(String id, {required bool saved}) =>
      _inner.setFavorite(id, saved: saved);

  @override
  Future<Listing> addPhotos(String listingId, List<DraftPhoto> photos) =>
      _inner.addPhotos(listingId, photos);
}
