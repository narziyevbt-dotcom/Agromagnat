import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/pagination/paginated.dart';
import '../../../../core/network/api_config.dart';
import '../../../../core/network/api_providers.dart';
import '../../data/repositories/api_catalog_repository.dart';
import '../../data/repositories/api_listing_repository.dart';
import '../../data/repositories/mock_catalog_repository.dart';
import '../../data/repositories/mock_listing_repository.dart';
import '../../domain/entities/category.dart';
import '../../domain/entities/listing.dart';
import '../../domain/entities/location.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../../domain/repositories/listing_repository.dart';

/// The two seams where the mock becomes the real API.
///
/// Nothing above these lines knows which implementation it is talking to, so
/// wiring the backend is an override here plus a Dio-backed class — no screen
/// changes. Tests override them the same way.
final catalogRepositoryProvider = Provider<CatalogRepository>((ref) {
  if (!ApiConfig.isConfigured) {
    return MockCatalogRepository();
  }
  return ApiCatalogRepository(ref.watch(apiClientProvider));
});

final listingRepositoryProvider = Provider<ListingRepository>((ref) {
  if (!ApiConfig.isConfigured) {
    return MockListingRepository();
  }
  return ApiListingRepository(ref.watch(apiClientProvider));
});

// --- Reference data ---------------------------------------------------------

/// Categories change a few times a year, so this is kept alive for the whole
/// session rather than refetched every time the home screen rebuilds.
final categoriesProvider = FutureProvider<List<ListingCategory>>((ref) {
  return ref.watch(catalogRepositoryProvider).categories();
});

final regionsProvider = FutureProvider<List<Region>>((ref) {
  return ref.watch(catalogRepositoryProvider).regions();
});

final districtsProvider =
    FutureProvider.family<List<District>, String>((ref, regionId) {
  return ref.watch(catalogRepositoryProvider).districts(regionId);
});

// --- The feed ---------------------------------------------------------------

/// The query the search screen is currently showing.
///
/// Home has its own fixed query, so it does not go through here — this is
/// state the user edits, and it is what the filter sheet writes to.
final searchQueryProvider = StateProvider<ListingQuery>((ref) {
  return const ListingQuery();
});

/// A page of listings for an arbitrary query, used by home's feed.
final listingFeedProvider =
    FutureProvider.family<Paginated<Listing>, ListingQuery>((ref, query) {
  return ref.watch(listingRepositoryProvider).search(query);
});

final listingDetailProvider =
    FutureProvider.family<Listing, String>((ref, id) {
  return ref.watch(listingRepositoryProvider).byId(id);
});

/// Search results with cursor paging held across rebuilds.
///
/// A plain FutureProvider cannot express "keep what is on screen and append" —
/// it replaces its value wholesale — and a buyer who has scrolled through four
/// pages must not lose them because a fifth is loading.
class SearchResultsNotifier extends StateNotifier<AsyncValue<Paginated<Listing>>> {
  SearchResultsNotifier(this._repository, this._query)
      : super(const AsyncValue.loading()) {
    refresh();
  }

  final ListingRepository _repository;
  final ListingQuery _query;

  bool _loadingMore = false;

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    try {
      state = AsyncValue.data(await _repository.search(_query));
    } on Object catch (error, stack) {
      state = AsyncValue.error(error, stack);
    }
  }

  Future<void> loadMore() async {
    final current = state.valueOrNull;
    // Guarded rather than queued: a fast scroll fires this on every frame, and
    // the duplicate pages would be appended twice.
    if (current == null || !current.hasMore || _loadingMore) {
      return;
    }

    _loadingMore = true;
    try {
      final next = await _repository.search(
        _query.copyWith(cursor: current.nextCursor),
      );
      // Re-read: a favourite toggle may have replaced the state while the page
      // was in flight, and appending to the stale copy would undo it.
      final latest = state.valueOrNull ?? current;
      state = AsyncValue.data(latest.append(next));
    } on Object catch (error, stack) {
      state = AsyncValue.error(error, stack);
    } finally {
      _loadingMore = false;
    }
  }

}

final searchResultsProvider = StateNotifierProvider.autoDispose
    .family<SearchResultsNotifier, AsyncValue<Paginated<Listing>>, ListingQuery>(
  (ref, query) {
    return SearchResultsNotifier(ref.watch(listingRepositoryProvider), query);
  },
);

// --- Saved listings ---------------------------------------------------------

/// Saved state, held apart from the listings themselves.
///
/// The same listing is on screen in more than one place at once — a card in
/// the feed, a card in search results, the detail screen it was opened from —
/// and each of those holds its own [Listing] instance from a different fetch.
/// Storing the flag on the entity meant tapping the heart in one place left
/// the others showing the old state until they happened to refetch.
///
/// The map holds only ids the user has actually touched this session; anything
/// absent falls back to what the server said on the listing itself.
class FavoritesNotifier extends StateNotifier<Map<String, bool>> {
  FavoritesNotifier(this._repository) : super(const {});

  final ListingRepository _repository;

  bool isSaved(Listing listing) => state[listing.id] ?? listing.isFavorite;

  /// Flips immediately, then reconciles.
  ///
  /// Optimistic because the alternative is a heart that does nothing for the
  /// second or two the request takes on EDGE, which reads as a dead button and
  /// gets tapped again.
  Future<void> toggle(Listing listing) async {
    final before = isSaved(listing);
    state = {...state, listing.id: !before};

    try {
      await _repository.setFavorite(listing.id, saved: !before);
    } on Object {
      // Put it back rather than leaving a lie on screen — the listing is not
      // saved, and the next app launch would show that.
      state = {...state, listing.id: before};
    }
  }
}

final favoritesProvider =
    StateNotifierProvider<FavoritesNotifier, Map<String, bool>>((ref) {
  return FavoritesNotifier(ref.watch(listingRepositoryProvider));
});

/// Whether this listing shows a filled heart right now.
final isSavedProvider = Provider.family<bool, Listing>((ref, listing) {
  return ref.watch(favoritesProvider)[listing.id] ?? listing.isFavorite;
});
