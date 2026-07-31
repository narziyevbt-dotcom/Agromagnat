import 'package:agromagnat/core/localization/app_strings.dart';
import 'package:agromagnat/core/pagination/paginated.dart';
import 'package:agromagnat/features/home/presentation/home_screen.dart';
import 'package:agromagnat/features/listings/domain/entities/draft_photo.dart';
import 'package:agromagnat/features/listings/domain/entities/listing.dart';
import 'package:agromagnat/features/listings/domain/entities/listing_draft.dart';
import 'package:agromagnat/features/listings/domain/repositories/listing_repository.dart';
import 'package:agromagnat/features/listings/presentation/providers/listing_providers.dart';
import 'package:agromagnat/features/listings/presentation/widgets/listing_card.dart';
import 'package:agromagnat/features/shell/presentation/main_shell.dart';
import 'package:agromagnat/shared/widgets/state_views.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/test_harness.dart';

void main() {
  testWidgets('renders the brand, categories and the newest listings',
      (tester) async {
    await pumpApp(tester, const HomeScreen());

    expect(find.text(AppStrings.appName), findsOneWidget);
    expect(find.text(AppStrings.categories), findsOneWidget);
    expect(find.text(AppStrings.latestListings), findsOneWidget);
    expect(find.byType(ListingCard), findsWidgets);
  });

  testWidgets('shows skeletons while the feed is in flight', (tester) async {
    // Latency restored deliberately: the loading state is the common case for
    // this audience, so it has to be exercised rather than skipped past.
    await tester.pumpWidget(
      ProviderScope(
        overrides: repositoryOverrides(),
        child: const MaterialApp(home: HomeScreen()),
      ),
    );
    await tester.pump();

    expect(find.byType(ListingCardSkeleton), findsWidgets);

    await tester.pumpAndSettle();
    expect(find.byType(ListingCardSkeleton), findsNothing);
  });

  testWidgets('tapping a category filters search and switches to that tab',
      (tester) async {
    final container = await pumpApp(tester, const HomeScreen());

    expect(container.read(shellIndexProvider), 0);
    expect(container.read(searchQueryProvider).categoryId, isNull);

    await tester.tap(find.text('Mevalar'));
    await tester.pumpAndSettle();

    // Selecting a category is a search with one filter set — home hands off
    // rather than growing a second result list.
    expect(container.read(searchQueryProvider).categoryId, 'cat-meva');
    expect(container.read(shellIndexProvider), 1);
  });

  testWidgets('the search bar is a button that moves to the search tab',
      (tester) async {
    final container = await pumpApp(tester, const HomeScreen());

    await tester.tap(find.text(AppStrings.searchHint));
    await tester.pumpAndSettle();

    expect(container.read(shellIndexProvider), 1);
  });

  testWidgets('offers a retry when the feed fails', (tester) async {
    await pumpApp(
      tester,
      const HomeScreen(),
      overrides: [
        listingRepositoryProvider.overrideWithValue(_FailingListingRepository()),
      ],
    );

    expect(find.byType(ErrorView), findsOneWidget);
    expect(find.text(AppStrings.retry), findsOneWidget);
  });
}

/// Stands in for a dead connection — the state this audience hits most.
class _FailingListingRepository implements ListingRepository {
  @override
  Future<Paginated<Listing>> search(ListingQuery query) =>
      Future.error(const _Offline());

  @override
  Future<Listing> byId(String id) => Future.error(const _Offline());

  @override
  Future<void> setFavorite(String id, {required bool saved}) =>
      Future.error(const _Offline());

  @override
  Future<Listing> create(ListingDraft draft) => Future.error(const _Offline());

  @override
  Future<Listing> addPhotos(String listingId, List<DraftPhoto> photos) =>
      Future.error(const _Offline());
}

class _Offline implements Exception {
  const _Offline();
}
