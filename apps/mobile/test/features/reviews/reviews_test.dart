import 'package:agromagnat/core/localization/app_strings.dart';
import 'package:agromagnat/features/auth/data/mock_auth_repository.dart';
import 'package:agromagnat/features/auth/presentation/providers/auth_providers.dart';
import 'package:agromagnat/features/listings/data/repositories/mock_listing_repository.dart';
import 'package:agromagnat/features/listings/domain/entities/listing.dart';
import 'package:agromagnat/features/listings/domain/repositories/listing_repository.dart';
import 'package:agromagnat/features/listings/presentation/listing_detail_screen.dart';
import 'package:agromagnat/features/listings/presentation/providers/listing_providers.dart';
import 'package:agromagnat/features/reviews/data/api_review_repository.dart';
import 'package:agromagnat/features/reviews/data/mock_review_repository.dart';
import 'package:agromagnat/features/reviews/domain/entities/review.dart';
import 'package:agromagnat/features/reviews/presentation/providers/review_providers.dart';
import 'package:agromagnat/features/reviews/presentation/seller_screen.dart';
import 'package:agromagnat/features/reviews/presentation/widgets/rate_seller_review_panel.dart';
import 'package:agromagnat/features/reviews/presentation/widgets/rating_stars.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/test_harness.dart';

void main() {
  late MockReviewRepository reviews;
  late MockListingRepository listings;

  setUp(() {
    reviews = MockReviewRepository(now: testNow, latency: Duration.zero);
    listings = MockListingRepository(now: testNow, latency: Duration.zero);
  });

  group('the histogram', () {
    test('counts every star, not just the average', () async {
      final page = await reviews.forSeller('sel-2');

      // A seller with twenty fives and one whose fives cancel out a row of
      // ones have the same average and are not the same seller.
      expect(page.total, 3);
      expect(page.breakdown[5], 2);
      expect(page.breakdown[4], 1);
      expect(page.breakdown[1], 0);
      expect(page.average, closeTo(4.67, 0.01));
    });

    test('a bar is a share of the total', () async {
      final page = await reviews.forSeller('sel-2');

      expect(page.share(5), closeTo(2 / 3, 0.001));
      expect(page.share(2), 0);
    });

    test('a seller nobody has rated is empty, not zero stars', () async {
      final page = await reviews.forSeller('sel-9');

      expect(page.isEmpty, isTrue);
      // Dividing by nothing is how a bar chart ends up NaN wide.
      expect(page.share(5), 0);
    });
  });

  group('leaving one', () {
    test('is refused on a listing that is not sold', () async {
      expect(
        () => reviews.rate('lst-01', rating: 5),
        throwsA(isA<ReviewRefusedException>()),
      );
    });

    test('is refused twice for the same deal', () async {
      await reviews.rate('lst-02', rating: 5, comment: 'Yaxshi');

      expect(
        () => reviews.rate('lst-02', rating: 4),
        throwsA(isA<ReviewRefusedException>()),
      );
    });

    test('comes back as the caller own review afterwards', () async {
      expect(await reviews.mine('lst-02'), isNull);

      await reviews.rate('lst-02', rating: 4, comment: '  Yaxshi o‘tdi  ');
      final mine = await reviews.mine('lst-02');

      expect(mine!.rating, 4);
      expect(mine.comment, 'Yaxshi o‘tdi', reason: 'trimmed');
    });

    test('an empty comment is stored as nothing, not as spaces', () async {
      await reviews.rate('lst-02', rating: 5, comment: '   ');
      expect((await reviews.mine('lst-02'))!.comment, isNull);
    });
  });

  group('the mapper', () {
    test('reads the average the API sends as a string', () {
      final page = ReviewMapper.sellerReviews({
        'items': const [],
        'total': 17,
        'average': '4.70',
        'breakdown': {'1': 0, '2': 1, '3': 0, '4': 4, '5': 12},
      });

      expect(page.average, 4.7);
      expect(page.breakdown[5], 12);
      expect(page.total, 17);
    });

    test('a row it cannot read costs that row, not the page', () {
      final page = ReviewMapper.sellerReviews({
        'items': [
          {'id': 'r1', 'rating': 5, 'createdAt': '2026-07-30T10:00:00Z'},
          {'nonsense': true},
        ],
        'total': 2,
        'average': '5.00',
      });

      expect(page.items, hasLength(1));
    });

    test('a rating outside 1..5 is clamped rather than drawn as six stars', () {
      final review = ReviewMapper.review({
        'id': 'r1',
        'rating': 9,
        'createdAt': '2026-07-30T10:00:00Z',
      });

      expect(review!.rating, 5);
    });
  });

  group('the seller screen', () {
    testWidgets('leads with the rating and lists what they have on sale',
        (tester) async {
      final seller = (await tester.runAsync(
        () => listings.search(const ListingQuery(limit: 50)),
      ))!
          .items
          .firstWhere((listing) => listing.seller.id == 'sel-2')
          .seller;

      await pumpApp(
        tester,
        SellerScreen(seller: seller),
        overrides: [reviewRepositoryProvider.overrideWithValue(reviews)],
      );

      // Twice over, in fact: the header and a review this person wrote on
      // somebody else's listing.
      expect(find.text(seller.displayName), findsWidgets);
      expect(find.text(AppStrings.reviewCount(3)), findsOneWidget);
      expect(find.byType(RatingStars), findsWidgets);
      expect(find.text(AppStrings.sellerListings), findsOneWidget);
    });

    testWidgets('a seller with no reviews says so instead of showing zero',
        (tester) async {
      final seller = (await tester.runAsync(
        () => listings.search(const ListingQuery(limit: 50)),
      ))!
          .items
          .firstWhere((listing) => listing.seller.id != 'sel-2')
          .seller;

      await pumpApp(
        tester,
        SellerScreen(seller: seller),
        overrides: [reviewRepositoryProvider.overrideWithValue(reviews)],
      );

      expect(find.text(AppStrings.noReviews), findsOneWidget);
    });
  });

  group('the panel on a listing', () {
    Future<void> pumpPanel(
      WidgetTester tester,
      Listing listing, {
      bool withSession = true,
    }) async {
      final auth = MockAuthRepository(latency: Duration.zero);
      final container = await pumpApp(
        tester,
        Scaffold(body: RateSellerPanel(listing: listing)),
        auth: auth,
        tokenStore: withSession ? await signedIn(tester, auth) : null,
        overrides: [
          reviewRepositoryProvider.overrideWithValue(reviews),
          listingRepositoryProvider.overrideWithValue(listings),
        ],
      );

      // The session restore is an async read of the token store, and the panel
      // renders nothing while it is in flight. Awaited explicitly rather than
      // pumped at and hoped for.
      await container.read(authControllerProvider.notifier).ready;
      await tester.pumpAndSettle();
    }

    testWidgets('is absent on an active listing', (tester) async {
      final listing = (await tester.runAsync(() => listings.byId('lst-01')))!;

      // The API refuses a review on one, and rightly: otherwise a competitor
      // could rate a rival on a listing nobody ever bought.
      await pumpPanel(tester, listing);
      expect(find.text(AppStrings.rateSeller), findsNothing);
    });

    testWidgets('is absent when nobody is signed in', (tester) async {
      final sold = (await tester.runAsync(() => listings.markSold('lst-02')))!;

      await pumpPanel(tester, sold, withSession: false);
      expect(find.text(AppStrings.rateSeller), findsNothing);
    });

    testWidgets('offers the rating on a sold listing', (tester) async {
      final sold = (await tester.runAsync(() => listings.markSold('lst-02')))!;

      await pumpPanel(tester, sold);
      expect(find.text(AppStrings.rateSeller), findsOneWidget);
    });

    testWidgets('shows the stars already given instead of asking again',
        (tester) async {
      final sold = (await tester.runAsync(() => listings.markSold('lst-02')))!;
      await tester.runAsync(() => reviews.rate('lst-02', rating: 4));

      await pumpPanel(tester, sold);

      expect(find.text(AppStrings.yourReview), findsOneWidget);
      expect(find.text(AppStrings.rateSeller), findsNothing);
    });
  });

  group('the detail screen', () {
    testWidgets('opens the seller page when the seller panel is tapped',
        (tester) async {
      await pumpApp(
        tester,
        const ListingDetailScreen(id: 'lst-03'),
        overrides: [
          reviewRepositoryProvider.overrideWithValue(reviews),
          listingRepositoryProvider.overrideWithValue(listings),
        ],
      );
      await tester.pumpAndSettle();

      final listing = (await tester.runAsync(() => listings.byId('lst-03')))!;

      // Scrolled to first: the panel sits below the fold on the default test
      // surface, and a tap at coordinates outside the viewport hits nothing.
      final panel = find.text(listing.seller.displayName);
      await tester.ensureVisible(panel);
      await tester.pumpAndSettle();

      // The panel, not the heading above it: a buyer's next question after
      // the price is who they are dealing with.
      await tester.tap(panel);
      await tester.pumpAndSettle();

      expect(find.byType(SellerScreen), findsOneWidget);
      expect(find.text(AppStrings.sellerListings), findsOneWidget);
    });
  });
}
