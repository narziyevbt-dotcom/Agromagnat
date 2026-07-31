import 'package:flutter/foundation.dart';

/// The farmer behind a listing, as shown on a card and the detail screen.
///
/// [phone] is the whole point of the product — the buyer calls it directly —
/// so it is non-nullable, unlike the display name.
@immutable
class Seller {
  const Seller({
    required this.id,
    required this.phone,
    this.name,
    this.isVerified = false,
    this.ratingAvg = 0,
    this.ratingCount = 0,
    this.salesCount = 0,
  });

  final String id;
  final String phone;
  final String? name;

  /// Phone confirmed by OTP and documents checked by a moderator.
  final bool isVerified;

  final double ratingAvg;
  final int ratingCount;
  final int salesCount;

  /// A single review is not a rating — the stars stay hidden until there are
  /// enough of them to mean something.
  bool get hasRating => ratingCount >= 3;

  String get displayName => name?.trim().isNotEmpty == true ? name!.trim() : 'Fermer';

  @override
  bool operator ==(Object other) => other is Seller && other.id == id;

  @override
  int get hashCode => id.hashCode;
}
