import '../../../../core/pagination/paginated.dart';
import '../../domain/entities/listing.dart';
import '../../domain/entities/listing_draft.dart';
import '../../domain/entities/units.dart';
import '../../domain/repositories/listing_repository.dart';
import '../fixtures/listing_fixtures.dart';

/// In-memory [ListingRepository] over the seed set.
///
/// Filtering, sorting and cursor paging are implemented for real rather than
/// stubbed, because they are exactly what the screens are being built against.
/// A mock that ignores its query lets a screen ship with a filter that never
/// worked, and the bug only surfaces when the API is wired in.
class MockListingRepository implements ListingRepository {
  MockListingRepository({
    DateTime? now,
    this.latency = const Duration(milliseconds: 350),
  })  : _now = now ?? DateTime.now(),
        _listings = ListingFixtures.build(now ?? DateTime.now());

  final Duration latency;
  final DateTime _now;
  final List<Listing> _listings;

  /// Saved state lives here rather than on the entity so a toggle survives a
  /// refetch — the same thing the real API does with the user's token.
  final Set<String> _favorites = <String>{};

  @override
  Future<Paginated<Listing>> search(ListingQuery query) async {
    await Future<void>.delayed(latency);

    final matches = _listings.where((listing) => _matches(listing, query)).toList();
    _sort(matches, query.sort);

    // The cursor is the index of the first item of the next page. Opaque to
    // callers, which is what keeps it swappable for the API's real cursor.
    final start = int.tryParse(query.cursor ?? '') ?? 0;
    final end = (start + query.limit).clamp(0, matches.length);
    final page = matches.sublist(start.clamp(0, matches.length), end);

    return Paginated<Listing>(
      items: [for (final listing in page) _withFavorite(listing)],
      nextCursor: end < matches.length ? '$end' : null,
    );
  }

  @override
  Future<Listing> byId(String id) async {
    await Future<void>.delayed(latency);

    for (final listing in _listings) {
      if (listing.id == id) {
        return _withFavorite(listing);
      }
    }
    throw ListingNotFoundException(id);
  }

  @override
  Future<Listing> toggleFavorite(String id) async {
    // No latency here on purpose: the heart has to respond to the tap, and the
    // screen reconciles with the server afterwards.
    final listing = _listings.firstWhere(
      (candidate) => candidate.id == id,
      orElse: () => throw ListingNotFoundException(id),
    );

    if (!_favorites.remove(id)) {
      _favorites.add(id);
    }
    return _withFavorite(listing);
  }

  @override
  Future<Listing> create(ListingDraft draft) async {
    await Future<void>.delayed(latency);

    // The server validates too, and its answer is the one that counts — but it
    // returns the same shape, so the form has one error path rather than two.
    final errors = draft.validate();
    if (errors.isNotEmpty) {
      throw ListingValidationException(errors);
    }

    final listing = Listing(
      id: 'lst-${_listings.length + 1}'.padLeft(7, '0'),
      title: draft.title.trim(),
      description: draft.description.trim().isEmpty ? null : draft.description.trim(),
      status: ListingStatus.active,
      quantity: draft.quantity!,
      quantityUnit: draft.quantityUnit!,
      price: draft.price!,
      priceUnit: draft.priceUnit!,
      minOrder: draft.minOrder,
      category: draft.category!,
      region: draft.region!,
      district: draft.district!,
      seller: ListingFixtures.sellers.first,
      harvestDate: draft.harvestDate,
      delivery: draft.delivery,
      createdAt: _now,
      // Listings auto-expire 14 days after posting.
      expiresAt: _now.add(const Duration(days: 14)),
    );

    // Newest first, which is where the feed will look for it.
    _listings.insert(0, listing);
    return listing;
  }

  Listing _withFavorite(Listing listing) =>
      listing.copyWith(isFavorite: _favorites.contains(listing.id));

  bool _matches(Listing listing, ListingQuery query) {
    if (!listing.status.isPublic) {
      return false;
    }

    final text = query.text?.trim().toLowerCase();
    if (text != null && text.isNotEmpty) {
      // Title, description, category and place all count as the haystack —
      // people search "urgut pomidor" as often as they search a crop name.
      final haystack = [
        listing.title,
        listing.description ?? '',
        listing.category.nameUz,
        listing.region.nameUz,
        listing.district.nameUz,
      ].join(' ').toLowerCase();

      if (!haystack.contains(text)) {
        return false;
      }
    }

    if (query.categoryId != null && listing.category.id != query.categoryId) {
      return false;
    }
    if (query.regionId != null && listing.region.id != query.regionId) {
      return false;
    }
    if (query.districtId != null && listing.district.id != query.districtId) {
      return false;
    }
    if (query.minPrice != null && listing.price < query.minPrice!) {
      return false;
    }
    if (query.maxPrice != null && listing.price > query.maxPrice!) {
      return false;
    }
    if (query.minQuantity != null) {
      // Comparing a volume across units would be meaningless — 5 kg is not
      // less than 5 t — so the filter only applies within a matching unit.
      if (query.quantityUnit != null && listing.quantityUnit != query.quantityUnit) {
        return false;
      }
      if (listing.quantity < query.minQuantity!) {
        return false;
      }
    }

    return true;
  }

  void _sort(List<Listing> listings, ListingSort sort) {
    // Promoted listings sit at the top of every ordering — that is what the
    // seller paid for — and the chosen sort applies within each band.
    int byPromotion(Listing a, Listing b) {
      if (a.isPromoted == b.isPromoted) return 0;
      return a.isPromoted ? -1 : 1;
    }

    listings.sort((a, b) {
      final promotion = byPromotion(a, b);
      if (promotion != 0) return promotion;

      return switch (sort) {
        ListingSort.newest => b.createdAt.compareTo(a.createdAt),
        ListingSort.priceAsc => a.price.compareTo(b.price),
        ListingSort.priceDesc => b.price.compareTo(a.price),
        ListingSort.volumeDesc => b.quantity.compareTo(a.quantity),
      };
    });
  }
}
