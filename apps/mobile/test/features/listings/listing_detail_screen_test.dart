import 'package:agromagnat/core/format/uz_format.dart';
import 'package:agromagnat/core/localization/app_strings.dart';
import 'package:agromagnat/features/auth/data/mock_auth_repository.dart';
import 'package:agromagnat/features/auth/data/token_store.dart';
import 'package:agromagnat/features/listings/data/repositories/mock_listing_repository.dart';
import 'package:agromagnat/features/listings/domain/entities/listing.dart';
import 'package:agromagnat/features/listings/presentation/listing_detail_screen.dart';
import 'package:agromagnat/features/listings/presentation/widgets/listing_card.dart';
import 'package:agromagnat/shared/widgets/state_views.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/test_harness.dart';

void main() {
  late Listing sample;

  setUpAll(() async {
    final repository = MockListingRepository(now: testNow, latency: Duration.zero);
    sample = await repository.byId('lst-01');
  });

  testWidgets('leads with price, volume and the total the two multiply out to',
      (tester) async {
    await pumpApp(tester, const ListingDetailScreen(id: 'lst-01'));

    expect(find.text(sample.title), findsOneWidget);
    expect(find.text(UzFormat.price(sample.price, sample.priceUnit)), findsOneWidget);
    expect(find.byType(VolumeChip), findsOneWidget);

    // "12 t at 9 500" stays abstract until the buyer sees what it comes to.
    expect(find.text(AppStrings.totalValue), findsOneWidget);
    expect(find.text(UzFormat.total(sample.totalValue)), findsOneWidget);
  });

  testWidgets('shows the facts a buyer decides on', (tester) async {
    await pumpApp(tester, const ListingDetailScreen(id: 'lst-01'));

    expect(find.text(sample.locationLabel), findsOneWidget);
    expect(find.text(AppStrings.minOrder), findsOneWidget);
    expect(find.text(AppStrings.delivery), findsOneWidget);
    expect(find.text(sample.delivery.label), findsOneWidget);
  });

  testWidgets('pins the call button to the bottom', (tester) async {
    await pumpApp(tester, const ListingDetailScreen(id: 'lst-01'));

    expect(find.text(AppStrings.callSeller), findsOneWidget);

    final button = tester.getRect(find.text(AppStrings.callSeller));
    final screen = tester.getRect(find.byType(ListingDetailScreen));
    // It belongs where a thumb already rests, not at the end of the scroll.
    expect(button.center.dy, greaterThan(screen.height * 0.7));
  });

  testWidgets('marks a verified seller', (tester) async {
    await pumpApp(tester, const ListingDetailScreen(id: 'lst-01'));

    // The seller panel sits below the description, so it has to be scrolled
    // to — price and volume own the space above the fold.
    await tester.scrollUntilVisible(find.text(AppStrings.sellerTitle), 200);
    await tester.pumpAndSettle();

    expect(sample.seller.isVerified, isTrue);
    expect(find.byIcon(Icons.verified_rounded), findsOneWidget);
    expect(find.text(sample.seller.displayName), findsOneWidget);
  });

  testWidgets('an unknown id shows the not-found state, not a crash',
      (tester) async {
    // Links get pasted into Telegram and outlive the listing they point at.
    await pumpApp(tester, const ListingDetailScreen(id: 'lst-yoq'));

    expect(find.byType(EmptyView), findsOneWidget);
    expect(find.text(AppStrings.listingNotFound), findsOneWidget);
    expect(find.text(AppStrings.callSeller), findsNothing);
  });

  testWidgets('saving asks a signed-out user to sign in first', (tester) async {
    await pumpApp(tester, const ListingDetailScreen(id: 'lst-01'));

    expect(find.byIcon(Icons.favorite_border_rounded), findsOneWidget);

    await tester.tap(find.byIcon(Icons.favorite_border_rounded));
    await tester.pumpAndSettle();

    // Saved listings belong to an account — they have to survive a reinstall
    // and follow the user to the website.
    expect(find.text(AppStrings.signInHeadline), findsOneWidget);
  });

  testWidgets('the save button reflects the toggled state once signed in',
      (tester) async {
    final repository = MockAuthRepository(latency: Duration.zero);
    final store = InMemoryTokenStore();
    await tester.runAsync(() async {
      await repository.requestOtp('901234567');
      await store.write(
        await repository.verifyOtp(
          phone: '+998901234567',
          code: MockAuthRepository.devCode,
        ),
      );
    });

    await pumpApp(
      tester,
      const ListingDetailScreen(id: 'lst-01'),
      auth: repository,
      tokenStore: store,
    );

    expect(find.byIcon(Icons.favorite_border_rounded), findsOneWidget);

    await tester.tap(find.byIcon(Icons.favorite_border_rounded));
    await tester.pumpAndSettle();

    expect(find.byIcon(Icons.favorite_rounded), findsOneWidget);
  });
}
