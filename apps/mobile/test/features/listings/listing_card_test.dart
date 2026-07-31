import 'package:agromagnat/core/theme/app_colors.dart';
import 'package:agromagnat/features/listings/data/repositories/mock_listing_repository.dart';
import 'package:agromagnat/features/listings/domain/entities/listing.dart';
import 'package:agromagnat/features/listings/domain/repositories/listing_repository.dart';
import 'package:agromagnat/features/listings/presentation/widgets/listing_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/test_harness.dart';

void main() {
  late Listing promoted;
  late Listing plain;

  setUpAll(() async {
    final repository = MockListingRepository(now: testNow, latency: Duration.zero);
    final page = await repository.search(const ListingQuery(limit: 100));
    promoted = page.items.firstWhere((listing) => listing.isPromoted);
    plain = page.items.firstWhere((listing) => !listing.isPromoted);
  });

  testWidgets('shows the volume chip as prominently as the price',
      (tester) async {
    await pumpApp(tester, Scaffold(body: ListingCard(listing: promoted)));

    // The product rule: a wholesale buyer decides on volume first. Both
    // numbers have to be on the card, and both in the money colour.
    expect(find.textContaining("so'm/"), findsOneWidget);
    expect(find.byType(VolumeChip), findsOneWidget);

    final chipText = tester.widget<Text>(
      find.descendant(of: find.byType(VolumeChip), matching: find.byType(Text)),
    );
    expect(chipText.style?.color, AppColors.harvest);
  });

  testWidgets('renders location and posting time', (tester) async {
    await pumpApp(tester, Scaffold(body: ListingCard(listing: promoted)));

    expect(find.text(promoted.locationLabel), findsOneWidget);
    expect(find.textContaining('oldin'), findsOneWidget);
  });

  testWidgets('shows the TOP badge only on a promoted listing', (tester) async {
    await pumpApp(tester, Scaffold(body: ListingCard(listing: promoted)));
    expect(find.text('TOP'), findsOneWidget);

    await pumpApp(tester, Scaffold(body: ListingCard(listing: plain)));
    expect(find.text('TOP'), findsNothing);
  });

  testWidgets('the favourite control clears the 44px tap target',
      (tester) async {
    await pumpApp(
      tester,
      Scaffold(
        body: ListingCard(listing: plain, onFavoriteToggle: () {}),
      ),
    );

    // The audience skews older and often taps with a work-worn thumb — 44 is a
    // hard floor, not a guideline.
    final size = tester.getSize(find.byIcon(Icons.favorite_border_rounded).hitTestable());
    expect(size.width, greaterThanOrEqualTo(44));
    expect(size.height, greaterThanOrEqualTo(44));
  });

  testWidgets('reports the whole card as one sentence to a screen reader',
      (tester) async {
    final handle = tester.ensureSemantics();
    await pumpApp(tester, Scaffold(body: ListingCard(listing: promoted)));

    expect(
      find.bySemanticsLabel(RegExp(RegExp.escape(promoted.title))),
      findsOneWidget,
    );

    handle.dispose();
  });

  testWidgets('a card without photos falls back to the category emoji',
      (tester) async {
    await pumpApp(tester, Scaffold(body: ListingCard(listing: plain)));

    // Most listings arrive without a photo, so this is the common path — a
    // broken-image icon here would be what most of the feed looked like.
    expect(plain.coverPhoto, isNull);
    expect(find.text(plain.category.emoji!), findsOneWidget);
  });

  testWidgets('tapping the card fires its callback', (tester) async {
    var taps = 0;
    await pumpApp(
      tester,
      Scaffold(body: ListingCard(listing: plain, onTap: () => taps++)),
    );

    await tester.tap(find.byType(ListingCard));
    await tester.pumpAndSettle();

    expect(taps, 1);
  });
}
