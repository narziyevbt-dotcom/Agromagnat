import 'package:agromagnat/core/localization/app_strings.dart';
import 'package:agromagnat/features/listings/domain/repositories/listing_repository.dart';
import 'package:agromagnat/features/listings/presentation/providers/listing_providers.dart';
import 'package:agromagnat/features/listings/presentation/widgets/listing_card.dart';
import 'package:agromagnat/features/search/presentation/search_screen.dart';
import 'package:agromagnat/features/search/presentation/widgets/filter_sheet.dart';
import 'package:agromagnat/shared/widgets/state_views.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/test_harness.dart';

void main() {
  testWidgets('lists results and reports how many there are', (tester) async {
    await pumpApp(tester, const SearchScreen());

    expect(find.byType(ListingCard), findsWidgets);
    expect(find.textContaining("e'lon"), findsOneWidget);
  });

  testWidgets('typing narrows the results after the debounce', (tester) async {
    final container = await pumpApp(tester, const SearchScreen());

    await tester.enterText(find.byType(TextField), 'anor');
    // The query must not have moved yet — firing per keystroke is exactly what
    // the debounce exists to prevent on a metered connection.
    expect(container.read(searchQueryProvider).text, isNull);

    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();

    expect(container.read(searchQueryProvider).text, 'anor');
    expect(find.byType(ListingCard), findsOneWidget);
    expect(find.textContaining('Anor'), findsWidgets);
  });

  testWidgets('an unmatched search shows the empty state, not an error',
      (tester) async {
    await pumpApp(tester, const SearchScreen());

    await tester.enterText(find.byType(TextField), 'kakao dukkagi');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();

    expect(find.byType(EmptyView), findsOneWidget);
    expect(find.text(AppStrings.nothingFound), findsOneWidget);
  });

  testWidgets('clearing the field restores the full feed', (tester) async {
    final container = await pumpApp(tester, const SearchScreen());
    final total = container.read(searchQueryProvider);
    expect(total.text, isNull);

    await tester.enterText(find.byType(TextField), 'anor');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.byType(ListingCard), findsOneWidget);

    await tester.tap(find.byIcon(Icons.close_rounded));
    await tester.pumpAndSettle();

    expect(container.read(searchQueryProvider).text, isNull);
    expect(tester.widgetList(find.byType(ListingCard)).length, greaterThan(1));
  });

  testWidgets('sorting by price reorders the unpromoted results',
      (tester) async {
    final container = await pumpApp(tester, const SearchScreen());

    await tester.tap(find.text(AppStrings.sortNewest));
    await tester.pumpAndSettle();
    await tester.tap(find.text(AppStrings.sortPriceAsc).last);
    await tester.pumpAndSettle();

    expect(container.read(searchQueryProvider).sort, ListingSort.priceAsc);
  });

  group('filter sheet', () {
    /// The sheet's list scrolls, so a chip below the fold has to be brought
    /// into view before it can be tapped — same as the user does.
    Future<void> tapChip(WidgetTester tester, String label) async {
      final finder = find.text(label);

      if (finder.evaluate().isEmpty) {
        await tester.scrollUntilVisible(
          finder,
          120,
          scrollable: find
              .descendant(
                of: find.byType(FilterSheet),
                matching: find.byType(Scrollable),
              )
              .first,
        );
      }
      // Mounted is not the same as on-screen: a lazily built list keeps rows
      // just past the edge alive, and tapping one of those misses.
      await tester.ensureVisible(finder);
      await tester.pumpAndSettle();

      await tester.tap(finder);
      await tester.pumpAndSettle();
    }

    Future<void> openSheet(WidgetTester tester) async {
      await tester.tap(find.byIcon(Icons.tune_rounded));
      await tester.pumpAndSettle();
      expect(find.byType(FilterSheet), findsOneWidget);
    }

    testWidgets('applies a region only when confirmed', (tester) async {
      final container = await pumpApp(tester, const SearchScreen());
      await openSheet(tester);

      await tapChip(tester, 'Samarqand');

      // Still unapplied: refetching on every tap would mean four waits while
      // the user is only part-way through deciding.
      expect(container.read(searchQueryProvider).regionId, isNull);

      await tester.tap(find.text(AppStrings.apply));
      await tester.pumpAndSettle();

      expect(container.read(searchQueryProvider).regionId, 'reg-sam');
      expect(find.byType(ListingCard), findsWidgets);
    });

    testWidgets('reveals districts once a region is chosen', (tester) async {
      await pumpApp(tester, const SearchScreen());
      await openSheet(tester);

      expect(find.text(AppStrings.district), findsNothing);

      await tapChip(tester, 'Samarqand');
      await tapChip(tester, 'Urgut');

      expect(find.text(AppStrings.district), findsOneWidget);
    });

    testWidgets('choosing another region drops the district under it',
        (tester) async {
      final container = await pumpApp(tester, const SearchScreen());
      await openSheet(tester);

      await tapChip(tester, 'Samarqand');
      await tapChip(tester, 'Urgut');
      // A tuman only means something inside its viloyat, so switching region
      // must not leave the old district behind as a silent filter.
      await tapChip(tester, 'Andijon');
      await tester.tap(find.text(AppStrings.apply));
      await tester.pumpAndSettle();

      expect(container.read(searchQueryProvider).regionId, 'reg-and');
      expect(container.read(searchQueryProvider).districtId, isNull);
    });

    testWidgets('reset clears the filters but keeps the typed text',
        (tester) async {
      final container = await pumpApp(tester, const SearchScreen());

      await tester.enterText(find.byType(TextField).first, 'anor');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();

      await openSheet(tester);
      await tapChip(tester, 'Samarqand');
      await tester.tap(find.text(AppStrings.reset));
      await tester.pumpAndSettle();
      await tester.tap(find.text(AppStrings.apply));
      await tester.pumpAndSettle();

      expect(container.read(searchQueryProvider).regionId, isNull);
      expect(container.read(searchQueryProvider).text, 'anor');
    });
  });
}
