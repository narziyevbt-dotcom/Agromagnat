import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/pagination/paginated.dart';
import '../../../listings/domain/entities/listing.dart';
import '../../../listings/domain/entities/units.dart';
import '../../../listings/domain/repositories/listing_repository.dart';
import '../../../listings/presentation/providers/listing_providers.dart';

/// The seller's own listings, with the two edits they can make from the list.
///
/// Both edits are applied to what is on screen before the request finishes.
/// The alternative is a row that does nothing for the second or two a request
/// takes on EDGE, which reads as a dead button — and this is the screen where
/// a mis-tap costs a listing, so the state has to be unambiguous.
class MyListingsNotifier extends StateNotifier<AsyncValue<Paginated<Listing>>> {
  MyListingsNotifier(this._repository) : super(const AsyncValue.loading()) {
    refresh();
  }

  final ListingRepository _repository;

  bool _loadingMore = false;

  Future<void> refresh() async {
    try {
      state = AsyncValue.data(await _repository.mine());
    } on Object catch (error, stack) {
      state = AsyncValue.error(error, stack);
    }
  }

  Future<void> loadMore() async {
    final current = state.valueOrNull;
    if (current == null || !current.hasMore || _loadingMore) {
      return;
    }

    _loadingMore = true;
    try {
      final next = await _repository.mine(cursor: current.nextCursor);
      state = AsyncValue.data((state.valueOrNull ?? current).append(next));
    } on Object {
      // Keep the pages already on screen. A failed fifth page is not a reason
      // to throw away four the seller has scrolled through.
    } finally {
      _loadingMore = false;
    }
  }

  /// Marks it sold, and puts it back if the server disagrees.
  Future<bool> markSold(Listing listing) async {
    final before = state.valueOrNull;
    if (before == null) {
      return false;
    }

    _replace(before, listing.copyWith(status: ListingStatus.sold));
    try {
      final updated = await _repository.markSold(listing.id);
      _replace(state.valueOrNull ?? before, updated);
      return true;
    } on Object {
      _replace(state.valueOrNull ?? before, listing);
      return false;
    }
  }

  /// Puts an expired listing back on the market.
  ///
  /// Not optimistic, unlike the other two: the server decides the new expiry
  /// date, and guessing it on the client would put a wrong "14 kun qoldi" on
  /// screen for as long as the request takes.
  Future<bool> renew(Listing listing) async {
    final before = state.valueOrNull;
    if (before == null) {
      return false;
    }

    try {
      _replace(before, await _repository.renew(listing.id));
      return true;
    } on Object {
      return false;
    }
  }

  /// Deletes it. Returns false — and puts the row back — if it did not delete.
  Future<bool> remove(Listing listing) async {
    final before = state.valueOrNull;
    if (before == null) {
      return false;
    }

    state = AsyncValue.data(
      Paginated<Listing>(
        items: [
          for (final item in before.items)
            if (item.id != listing.id) item,
        ],
        nextCursor: before.nextCursor,
      ),
    );

    try {
      await _repository.remove(listing.id);
      return true;
    } on Object {
      // Restored in its original position rather than appended: a listing that
      // reappears at the bottom of the list looks like a different one.
      state = AsyncValue.data(before);
      return false;
    }
  }

  void _replace(Paginated<Listing> page, Listing updated) {
    state = AsyncValue.data(
      Paginated<Listing>(
        items: [
          for (final item in page.items)
            if (item.id == updated.id) updated else item,
        ],
        nextCursor: page.nextCursor,
      ),
    );
  }
}

/// Disposed when the screen closes, so opening it again refetches.
///
/// Kept alive it would show a list that predates the listing the seller
/// published two minutes ago — on the one screen whose whole job is to
/// account for their listings.
final myListingsProvider = StateNotifierProvider.autoDispose<MyListingsNotifier,
    AsyncValue<Paginated<Listing>>>((ref) {
  return MyListingsNotifier(ref.watch(listingRepositoryProvider));
});
