import 'package:flutter/foundation.dart';

import '../../../../core/pagination/paginated.dart';
import '../entities/listing.dart';
import '../entities/units.dart';

/// How the feed is ordered. The default is newest-first; a wholesale buyer
/// hunting for a bargain switches to price, and a trader needing a full truck
/// switches to volume.
enum ListingSort {
  newest,
  priceAsc,
  priceDesc,
  volumeDesc;
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

  /// Toggles the saved state and returns the listing as it now stands.
  Future<Listing> toggleFavorite(String id);
}
