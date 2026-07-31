import 'package:agromagnat/core/localization/app_strings.dart';
import 'package:agromagnat/features/auth/data/mock_auth_repository.dart';
import 'package:agromagnat/features/listings/data/fixtures/listing_fixtures.dart';
import 'package:agromagnat/features/listings/data/repositories/mock_listing_repository.dart';
import 'package:agromagnat/features/listings/domain/entities/listing.dart';
import 'package:agromagnat/features/listings/domain/entities/listing_draft.dart';
import 'package:agromagnat/features/listings/domain/entities/units.dart';
import 'package:agromagnat/features/listings/domain/repositories/listing_repository.dart';
import 'package:agromagnat/features/listings/presentation/providers/listing_providers.dart';
import 'package:agromagnat/features/my_listings/presentation/my_listings_screen.dart';
import 'package:agromagnat/features/my_listings/presentation/providers/my_listings_providers.dart';
import 'package:agromagnat/features/my_listings/presentation/widgets/my_listing_tile.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/delegating_listing_repository.dart';
import '../../support/test_harness.dart';

/// Fails whichever of the two edits it is told to.
class _StubbornRepository extends DelegatingListingRepository {
  _StubbornRepository(super.inner, {this.failSold = false, this.failRemove = false});

  final bool failSold;
  final bool failRemove;

  @override
  Future<Listing> markSold(String id) =>
      failSold ? Future.error(Exception('offline')) : super.markSold(id);

  @override
  Future<void> remove(String id) =>
      failRemove ? Future.error(Exception('offline')) : super.remove(id);
}

MockListingRepository repository() =>
    MockListingRepository(now: testNow, latency: Duration.zero);

Future<MyListingsNotifier> loaded(ListingRepository repo) async {
  final notifier = MyListingsNotifier(repo);
  await notifier.refresh();
  return notifier;
}

void main() {
  group('the list', () {
    test('shows the seller their own listings, whatever the status', () async {
      final repo = repository();
      final notifier = await loaded(repo);

      final mine = notifier.state.value!.items;
      expect(mine, isNotEmpty);
      expect(
        mine.every((l) => l.seller.id == MockListingRepository.mockSellerId),
        isTrue,
      );
    });

    test('includes what the feed hides', () async {
      final repo = repository();

      // A listing that expired or sold is gone from search — this is the only
      // screen that can tell the seller it still exists.
      final feed = (await repo.search(const ListingQuery(limit: 100))).items;
      expect(feed.every((l) => l.status == ListingStatus.active), isTrue);

      final sold = await repo.markSold(feed.first.id);
      final mine = (await loaded(repo)).state.value!.items;

      expect(mine.map((l) => l.id), contains(sold.id));
      expect(
        (await repo.search(const ListingQuery(limit: 100)))
            .items
            .map((l) => l.id),
        isNot(contains(sold.id)),
      );
    });

    test('a listing just published is in it', () async {
      final repo = repository();
      final draft = ListingDraft()
          .withCategory(ListingFixtures.build(testNow).first.category)
          .copyWith(
            title: 'Yangi pomidor',
            quantity: 10,
            price: 9000,
            region: ListingFixtures.build(testNow).first.region,
            district: ListingFixtures.build(testNow).first.district,
          );
      final created = await repo.create(draft);

      final mine = (await loaded(repo)).state.value!.items;
      expect(mine.first.id, created.id);
    });
  });

  group('marking sold', () {
    test('changes the row without waiting for the server', () async {
      final repo = repository();
      final notifier = await loaded(repo);
      final target = notifier.state.value!.items
          .firstWhere((l) => l.status == ListingStatus.active);

      final pending = notifier.markSold(target);

      // Already sold on screen. A row that does nothing for two seconds on
      // EDGE reads as a dead button and gets tapped again.
      expect(
        notifier.state.value!.items
            .firstWhere((l) => l.id == target.id)
            .status,
        ListingStatus.sold,
      );
      expect(await pending, isTrue);
    });

    test('goes back if the server never hears it', () async {
      final repo = _StubbornRepository(repository(), failSold: true);
      final notifier = await loaded(repo);
      final target = notifier.state.value!.items
          .firstWhere((l) => l.status == ListingStatus.active);

      expect(await notifier.markSold(target), isFalse);
      expect(
        notifier.state.value!.items
            .firstWhere((l) => l.id == target.id)
            .status,
        ListingStatus.active,
      );
    });
  });

  group('deleting', () {
    test('removes the row', () async {
      final repo = repository();
      final notifier = await loaded(repo);
      final target = notifier.state.value!.items.first;

      expect(await notifier.remove(target), isTrue);
      expect(
        notifier.state.value!.items.map((l) => l.id),
        isNot(contains(target.id)),
      );

      // And it is gone from the server's answer too, not just the screen.
      expect(
        (await repo.mine()).items.map((l) => l.id),
        isNot(contains(target.id)),
      );
    });

    test('puts it back where it was if the delete failed', () async {
      final repo = _StubbornRepository(repository(), failRemove: true);
      final notifier = await loaded(repo);
      final before = [...notifier.state.value!.items];
      final target = before[1];

      expect(await notifier.remove(target), isFalse);

      // Position matters: a listing that reappears at the bottom of the list
      // looks like a different one.
      expect(
        notifier.state.value!.items.map((l) => l.id),
        before.map((l) => l.id),
      );
    });
  });

  group('expiry', () {
    test('warns only in the last three days', () {
      final listing = ListingFixtures.build(testNow)
          .firstWhere((l) => l.expiresAt != null);
      final expires = listing.expiresAt!;

      expect(expiryNote(listing, now: expires.subtract(const Duration(days: 9))),
          isNull);
      expect(expiryNote(listing, now: expires.subtract(const Duration(days: 2))),
          AppStrings.expiresInDays(2));
      expect(expiryNote(listing, now: expires.subtract(const Duration(hours: 4))),
          AppStrings.expiresInDays(0));
    });

    test('says nothing about a listing that is not active', () async {
      final repo = repository();
      final active = (await repo.mine()).items
          .firstWhere((l) => l.status == ListingStatus.active);
      final sold = await repo.markSold(active.id);

      // "Expires in 2 days" on a sold listing is a countdown to nothing.
      expect(expiryNote(sold, now: testNow), isNull);
    });
  });

  group('the screen', () {
    Future<void> pump(
      WidgetTester tester, {
      ListingRepository? repo,
    }) async {
      final auth = MockAuthRepository(latency: Duration.zero);
      await pumpApp(
        tester,
        const MyListingsScreen(),
        auth: auth,
        tokenStore: await signedIn(tester, auth),
        overrides: [
          if (repo != null) listingRepositoryProvider.overrideWithValue(repo),
        ],
      );
    }

    testWidgets('asks for a sign-in before showing anything', (tester) async {
      await pumpApp(tester, const MyListingsScreen());

      expect(find.text(AppStrings.signInRequiredProfile), findsOneWidget);
      expect(find.byType(MyListingTile), findsNothing);
    });

    testWidgets('lists the seller\'s listings with their status',
        (tester) async {
      await pump(tester);

      expect(find.byType(MyListingTile), findsWidgets);
      expect(find.text(AppStrings.statusActive), findsWidgets);
    });

    testWidgets('marking sold asks first and names the listing',
        (tester) async {
      await pump(tester);

      final title = tester
          .widget<MyListingTile>(find.byType(MyListingTile).first)
          .listing
          .title;

      await tester.tap(find.text(AppStrings.markSold).first);
      await tester.pumpAndSettle();

      expect(find.byType(AlertDialog), findsOneWidget);
      expect(find.text(title), findsWidgets);

      await tester.tap(find.text(AppStrings.cancel));
      await tester.pumpAndSettle();

      // Backing out changes nothing.
      expect(find.text(AppStrings.markSoldDone), findsNothing);
      expect(find.text(AppStrings.statusSold), findsNothing);
    });

    testWidgets('confirming marks it sold and says so', (tester) async {
      await pump(tester);

      await tester.tap(find.text(AppStrings.markSold).first);
      await tester.pumpAndSettle();
      await tester.tap(
        find.descendant(
          of: find.byType(AlertDialog),
          matching: find.text(AppStrings.markSold),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text(AppStrings.statusSold), findsOneWidget);
      expect(find.text(AppStrings.markSoldDone), findsOneWidget);
    });

    testWidgets('a sold listing is not offered for sale again',
        (tester) async {
      await pump(tester);

      await tester.tap(find.text(AppStrings.markSold).first);
      await tester.pumpAndSettle();
      await tester.tap(
        find.descendant(
          of: find.byType(AlertDialog),
          matching: find.text(AppStrings.markSold),
        ),
      );
      await tester.pumpAndSettle();

      final sold = tester
          .widgetList<MyListingTile>(find.byType(MyListingTile))
          .where((tile) => tile.listing.status == ListingStatus.sold);
      expect(sold, hasLength(1));

      // The button that can only return an error is not on the tile at all.
      expect(
        find.descendant(
          of: find.byWidget(
            tester.widgetList<MyListingTile>(find.byType(MyListingTile)).first,
          ),
          matching: find.text(AppStrings.markSold),
        ),
        findsNothing,
      );
    });

    testWidgets('a failed delete leaves the listing on screen', (tester) async {
      await pump(tester, repo: _StubbornRepository(repository(), failRemove: true));

      final before = tester.widgetList<MyListingTile>(
        find.byType(MyListingTile),
      ).length;

      await tester.tap(find.byIcon(Icons.delete_outline_rounded).first);
      await tester.pumpAndSettle();
      await tester.tap(
        find.descendant(
          of: find.byType(AlertDialog),
          matching: find.text(AppStrings.deleteListing),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(MyListingTile), findsNWidgets(before));
      expect(find.text(AppStrings.actionFailed), findsOneWidget);
    });
  });
}
