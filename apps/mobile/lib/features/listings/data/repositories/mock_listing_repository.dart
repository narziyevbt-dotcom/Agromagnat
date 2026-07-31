import '../../../../core/pagination/paginated.dart';
import '../../domain/entities/draft_photo.dart';
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
  Future<void> setFavorite(String id, {required bool saved}) async {
    // No latency here on purpose: the heart has to respond to the tap, and the
    // screen reconciles with the server afterwards.
    if (!_listings.any((candidate) => candidate.id == id)) {
      throw ListingNotFoundException(id);
    }
    if (saved) {
      _favorites.add(id);
    } else {
      _favorites.remove(id);
    }
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

  @override
  Future<Listing> addPhotos(String listingId, List<DraftPhoto> photos) async {
    // One request per photo in the real client too: a farmer watching a
    // progress bar move after each one is a better failure mode than a single
    // upload that dies at 90% and takes all five with it.
    for (var i = 0; i < photos.length; i++) {
      await Future<void>.delayed(latency);
    }

    final index = _listings.indexWhere((listing) => listing.id == listingId);
    if (index == -1) {
      throw ListingNotFoundException(listingId);
    }

    final listing = _listings[index];
    final updated = listing.withPhotos([
      for (var i = 0; i < photos.length; i++)
        ListingPhoto(
          id: '$listingId-photo-$i',
          // The mock keeps the on-device path; the API would return an S3 URL.
          url: photos[i].path,
        ),
    ]);

    _listings[index] = updated;
    return _withFavorite(updated);
  }

  /// Who "me" is in mock mode — the same seller [create] posts as, so a
  /// listing published in the app appears at the top of this list.
  static const String mockSellerId = 'sel-1';

  @override
  Future<Paginated<Listing>> mine({String? cursor, int limit = 20}) async {
    await Future<void>.delayed(latency);

    // Any status, deliberately: this is the one view that shows what the feed
    // hides, and an expired listing the seller cannot see reads as a lost one.
    final own = [
      for (final listing in _listings)
        if (listing.seller.id == mockSellerId) listing,
    ];

    final start = int.tryParse(cursor ?? '') ?? 0;
    final end = (start + limit).clamp(0, own.length);

    return Paginated<Listing>(
      items: own.sublist(start.clamp(0, own.length), end),
      nextCursor: end < own.length ? '$end' : null,
    );
  }

  @override
  Future<Listing> markSold(String id) async {
    await Future<void>.delayed(latency);

    final index = _listings.indexWhere((listing) => listing.id == id);
    if (index == -1) {
      throw ListingNotFoundException(id);
    }

    final sold = _listings[index].copyWith(status: ListingStatus.sold);
    _listings[index] = sold;
    return _withFavorite(sold);
  }

  @override
  Future<void> remove(String id) async {
    await Future<void>.delayed(latency);

    final index = _listings.indexWhere((listing) => listing.id == id);
    if (index == -1) {
      throw ListingNotFoundException(id);
    }
    _listings.removeAt(index);
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
      };
    });
  }
}
