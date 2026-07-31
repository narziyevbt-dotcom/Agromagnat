import 'package:flutter/foundation.dart';

import '../../../../core/pagination/paginated.dart';
import '../entities/draft_photo.dart';
import '../entities/listing.dart';
import '../entities/listing_draft.dart';
import '../entities/units.dart';

/// How the feed is ordered.
///
/// Exactly the three the API supports. A volume ordering would suit a trader
/// filling a truck, but `GET /listings` has no such sort, and doing it on the
/// client would sort one page of the newest listings and call the result "the
/// biggest volumes" — a wrong answer presented confidently. Until the backend
/// grows the option, that need is served by the minimum-volume filter.
enum ListingSort {
  newest,
  priceAsc,
  priceDesc;
}

/// Everything the feed and search screens can ask for.
///
/// One object rather than a long parameter list, so adding a filter does not
/// ripple through every call site — and so a filter set can be held in a
/// provider and compared for equality.
@immutable
class ListingQuery {
  const ListingQuery({
    this.text,
    this.categoryId,
    this.regionId,
    this.districtId,
    this.minPrice,
    this.maxPrice,
    this.minQuantity,
    this.quantityUnit,
    this.sort = ListingSort.newest,
    this.cursor,
    this.limit = 20,
  });

  final String? text;
  final String? categoryId;
  final String? regionId;
  final String? districtId;
  final num? minPrice;
  final num? maxPrice;
  final num? minQuantity;
  final QuantityUnit? quantityUnit;
  final ListingSort sort;
  final String? cursor;
  final int limit;

  /// True when nothing has been narrowed — the screen shows the plain feed.
  bool get isUnfiltered =>
      (text == null || text!.trim().isEmpty) &&
      categoryId == null &&
      regionId == null &&
      districtId == null &&
      minPrice == null &&
      maxPrice == null &&
      minQuantity == null;

  /// How many filters are active, for the badge on the filter button.
  int get activeFilterCount => [
        categoryId,
        regionId,
        districtId,
        minPrice,
        maxPrice,
        minQuantity,
      ].where((value) => value != null).length;

  ListingQuery copyWith({
    Object? text = _unset,
    Object? categoryId = _unset,
    Object? regionId = _unset,
    Object? districtId = _unset,
    Object? minPrice = _unset,
    Object? maxPrice = _unset,
    Object? minQuantity = _unset,
    Object? quantityUnit = _unset,
    ListingSort? sort,
    Object? cursor = _unset,
    int? limit,
  }) {
    // A sentinel rather than null-means-keep: clearing a filter is the most
    // common edit these screens make, and `copyWith(regionId: null)` has to be
    // able to express it.
    return ListingQuery(
      text: text == _unset ? this.text : text as String?,
      categoryId: categoryId == _unset ? this.categoryId : categoryId as String?,
      regionId: regionId == _unset ? this.regionId : regionId as String?,
      districtId: districtId == _unset ? this.districtId : districtId as String?,
      minPrice: minPrice == _unset ? this.minPrice : minPrice as num?,
      maxPrice: maxPrice == _unset ? this.maxPrice : maxPrice as num?,
      minQuantity: minQuantity == _unset ? this.minQuantity : minQuantity as num?,
      quantityUnit:
          quantityUnit == _unset ? this.quantityUnit : quantityUnit as QuantityUnit?,
      sort: sort ?? this.sort,
      cursor: cursor == _unset ? this.cursor : cursor as String?,
      limit: limit ?? this.limit,
    );
  }

  static const Object _unset = Object();

  @override
  bool operator ==(Object other) =>
      other is ListingQuery &&
      other.text == text &&
      other.categoryId == categoryId &&
      other.regionId == regionId &&
      other.districtId == districtId &&
      other.minPrice == minPrice &&
      other.maxPrice == maxPrice &&
      other.minQuantity == minQuantity &&
      other.quantityUnit == quantityUnit &&
      other.sort == sort &&
      other.cursor == cursor &&
      other.limit == limit;

  @override
  int get hashCode => Object.hash(
        text,
        categoryId,
        regionId,
        districtId,
        minPrice,
        maxPrice,
        minQuantity,
        quantityUnit,
        sort,
        cursor,
        limit,
      );
}

/// Field key → Uzbek message, as the API returns on a rejected create.
///
/// Keyed rather than a flat list so the form can put each message under the
/// field it belongs to. A farmer told only "something is wrong" has to hunt.
class ListingValidationException implements Exception {
  const ListingValidationException(this.errors);

  final Map<String, String> errors;

  @override
  String toString() => 'ListingValidationException($errors)';
}

/// Thrown when a listing id does not resolve — deleted, blocked, or a stale
/// link pasted from Telegram.
class ListingNotFoundException implements Exception {
  const ListingNotFoundException(this.id);

  final String id;

  @override
  String toString() => 'ListingNotFoundException($id)';
}

abstract interface class ListingRepository {
  /// The feed and search share one entry point — search is just a feed with a
  /// [ListingQuery.text] set.
  Future<Paginated<Listing>> search(ListingQuery query);

  Future<Listing> byId(String id);

  /// Saves or unsaves a listing.
  ///
  /// Told which way rather than asked to toggle, because the API has two
  /// endpoints — POST to save, DELETE to unsave — and the caller already knows
  /// the current state. A toggle would have to read it back first, which is a
  /// round trip spent on something the UI is holding.
  Future<void> setFavorite(String id, {required bool saved});

  /// Publishes a draft and returns the listing it became.
  ///
  /// Throws [ListingValidationException] when the server rejects it. The
  /// client checks the same rules first, but it is the server's answer that
  /// decides — the spec can move between app releases.
  Future<Listing> create(ListingDraft draft);

  /// Attaches photos to a listing that already exists.
  ///
  /// Separate from [create] because the API keys them on a listing id, and
  /// because the two fail differently: a listing without its photos is still a
  /// listing, and losing the whole post because the third upload timed out on
  /// EDGE would be the worse outcome by far.
  Future<Listing> addPhotos(String listingId, List<DraftPhoto> photos);

  /// The caller's own listings, **any status**.
  ///
  /// Not [search] with a seller filter: this is the one view that has to show
  /// what the feed hides. A listing that expired or was blocked disappears from
  /// everywhere else, and a seller who cannot see it concludes the app lost it.
  Future<Paginated<Listing>> mine({String? cursor, int limit});

  /// Saves changes to a listing the caller owns.
  ///
  /// Sends the whole draft rather than a diff. `PATCH` accepts a partial, but
  /// the server re-validates the *merged* row anyway — and a diff computed on
  /// the client is one more place for the two to disagree about what changed.
  ///
  /// Throws [ListingValidationException] the same way [create] does.
  Future<Listing> update(String id, ListingDraft draft);

  /// Marks a listing sold. Returns it in its new state.
  Future<Listing> markSold(String id);

  /// Deletes a listing the caller owns.
  Future<void> remove(String id);
}
