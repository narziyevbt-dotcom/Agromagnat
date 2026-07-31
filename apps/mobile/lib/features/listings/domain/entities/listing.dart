import 'package:flutter/foundation.dart';

import 'category.dart';
import 'location.dart';
import 'seller.dart';
import 'units.dart';

@immutable
class ListingPhoto {
  const ListingPhoto({
    required this.id,
    required this.url,
    this.thumbUrl,
  });

  final String id;
  final String url;

  /// The feed asks for the thumbnail; the detail gallery asks for the full
  /// image. On a 2G connection the difference is the whole experience.
  final String? thumbUrl;

  String get feedUrl => thumbUrl ?? url;
}

/// A listing — the only object in the product that matters.
///
/// Money and volume are held as [num] rather than the API's strings: every
/// screen that shows them formats them, and parsing once at the repository
/// boundary beats parsing at each call site. The repository is where a
/// malformed value gets rejected.
@immutable
class Listing {
  const Listing({
    required this.id,
    required this.title,
    required this.status,
    required this.quantity,
    required this.quantityUnit,
    required this.price,
    required this.priceUnit,
    required this.category,
    required this.region,
    required this.district,
    required this.seller,
    required this.createdAt,
    this.description,
    this.minOrder,
    this.harvestDate,
    this.delivery = DeliveryOption.none,
    this.isPromoted = false,
    this.viewCount = 0,
    this.callCount = 0,
    this.favoriteCount = 0,
    this.isFavorite = false,
    this.expiresAt,
    this.photos = const [],
  });

  final String id;
  final String title;
  final String? description;
  final ListingStatus status;

  /// The number in the green chip. As prominent as the price, by design — a
  /// wholesale buyer filters on volume first and price second.
  final num quantity;
  final QuantityUnit quantityUnit;

  final num price;
  final PriceUnit priceUnit;

  /// Smallest lot the seller will break. Null means they will sell any amount.
  final num? minOrder;

  final ListingCategory category;
  final Region region;
  final District district;
  final Seller seller;

  final DateTime? harvestDate;
  final DeliveryOption delivery;

  /// Paid placement. Draws the saffron TOP badge and sorts to the front.
  final bool isPromoted;

  final int viewCount;
  final int callCount;
  final int favoriteCount;
  final bool isFavorite;

  final DateTime createdAt;

  /// Listings auto-expire 14 days after posting so the feed cannot fill with
  /// produce that was sold weeks ago.
  final DateTime? expiresAt;

  final List<ListingPhoto> photos;

  ListingPhoto? get coverPhoto => photos.isEmpty ? null : photos.first;

  /// "Samarqand · Urgut", the one location format the product uses.
  String get locationLabel => '${region.nameUz} · ${district.nameUz}';

  /// Total value of the lot. A buyer comparing "12 t at 9 000" against
  /// "8 t at 11 000" is really comparing these two numbers.
  num get totalValue => quantity * price;

  /// Returns the listing with its photo set replaced.
  ///
  /// Photos arrive after create, so this is the one field that changes on an
  /// otherwise immutable listing during a single posting flow.
  Listing withPhotos(List<ListingPhoto> next) => _copy(photos: next);

  Listing copyWith({bool? isFavorite}) => _copy(isFavorite: isFavorite);

  Listing _copy({bool? isFavorite, List<ListingPhoto>? photos}) {
    return Listing(
      id: id,
      title: title,
      description: description,
      status: status,
      quantity: quantity,
      quantityUnit: quantityUnit,
      price: price,
      priceUnit: priceUnit,
      minOrder: minOrder,
      category: category,
      region: region,
      district: district,
      seller: seller,
      harvestDate: harvestDate,
      delivery: delivery,
      isPromoted: isPromoted,
      viewCount: viewCount,
      callCount: callCount,
      favoriteCount: favoriteCount,
      isFavorite: isFavorite ?? this.isFavorite,
      createdAt: createdAt,
      expiresAt: expiresAt,
      photos: photos ?? this.photos,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is Listing && other.id == id && other.isFavorite == isFavorite;

  @override
  int get hashCode => Object.hash(id, isFavorite);
}
