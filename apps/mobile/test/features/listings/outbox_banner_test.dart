import 'package:agromagnat/core/cache/json_cache.dart';
import 'package:agromagnat/core/localization/app_strings.dart';
import 'package:agromagnat/features/listings/data/listing_outbox.dart';
import 'package:agromagnat/features/listings/presentation/providers/outbox_providers.dart';
import 'package:agromagnat/shared/widgets/outbox_banner.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/test_harness.dart';

void main() {
  late ListingOutbox outbox;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    outbox = ListingOutbox(JsonCache(await SharedPreferences.getInstance()));
  });

  Future<void> queue(String title, {int attempts = 0}) async {
    final entry = await outbox.add(
      body: {'title': title},
      photoPaths: const [],
      now: testNow,
    );
    for (var i = 0; i < attempts; i++) {
      await outbox.markAttempted(entry.id);
    }
  }

  Future<ProviderContainer> pumpBanner(WidgetTester tester) => pumpApp(
        tester,
        const Scaffold(body: OutboxBanner()),
        overrides: [listingOutboxProvider.overrideWithValue(outbox)],
      );

  testWidgets('shows nothing when the queue is empty', (tester) async {
    await pumpBanner(tester);

    expect(find.byType(TextButton), findsNothing);
  });

  testWidgets('says how many are waiting', (tester) async {
    await tester.runAsync(() async {
      await queue('Urgut pomidori');
      await queue('Bug\'doy');
    });

    await pumpBanner(tester);

    expect(find.text(AppStrings.queuedCount(2)), findsOneWidget);
    expect(find.text(AppStrings.sendNow), findsOneWidget);
  });

  testWidgets('offers to delete once the server has given up on it',
      (tester) async {
    await tester.runAsync(
      () => queue('Urgut pomidori', attempts: ListingOutbox.maxAttempts),
    );

    await pumpBanner(tester);

    // Retrying is what already failed five times; the hint tells the seller to
    // delete and repost, so the button has to be the delete.
    expect(find.text(AppStrings.queuedStuckHint), findsOneWidget);
    expect(find.text(AppStrings.sendNow), findsNothing);
    expect(find.text(AppStrings.discardQueued), findsOneWidget);
  });

  testWidgets('deleting asks first, and names the listing', (tester) async {
    await tester.runAsync(
      () => queue('Urgut pomidori', attempts: ListingOutbox.maxAttempts),
    );

    final container = await pumpBanner(tester);
    await tester.tap(find.text(AppStrings.discardQueued));
    await tester.pumpAndSettle();

    expect(find.textContaining('Urgut pomidori'), findsOneWidget);

    await tester.tap(find.text(AppStrings.cancel));
    await tester.pumpAndSettle();

    // Backing out of the dialog is not a way to lose the listing.
    expect(container.read(outboxControllerProvider).pending, 1);
  });

  testWidgets('confirming removes it', (tester) async {
    await tester.runAsync(
      () => queue('Urgut pomidori', attempts: ListingOutbox.maxAttempts),
    );

    final container = await pumpBanner(tester);
    await tester.tap(find.text(AppStrings.discardQueued));
    await tester.pumpAndSettle();

    await tester.tap(
      find.descendant(
        of: find.byType(AlertDialog),
        matching: find.text(AppStrings.discardQueued),
      ),
    );
    await tester.pumpAndSettle();

    expect(container.read(outboxControllerProvider).pending, 0);
    expect(find.byType(TextButton), findsNothing);
  });
}
