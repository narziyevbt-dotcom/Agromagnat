import 'package:flutter/foundation.dart';

/// One buyer's rating of a seller, tied to the deal it came from.
@immutable
class Review {
  const Review({
    required this.id,
    required this.listingId,
    required this.rating,
    required this.createdAt,
    this.comment,
    this.authorName,
    this.listingTitle,
  });

  final String id;
  final String listingId;

  /// 1..5. The API rejects anything else, and so does the sheet.
  final int rating;

  final String? comment;
  final DateTime createdAt;

  /// Who wrote it. Null when the API did not expand the author — the star
  /// still means something without a name.
  final String? authorName;

  /// Which deal it came from, when the API says.
  final String? listingTitle;
}

/// A seller's reviews, with the histogram the API computes.
@immutable
class SellerReviews {
  const SellerReviews({
    this.items = const [],
    this.total = 0,
    this.average = 0,
    this.breakdown = const {},
  });

  final List<Review> items;
  final int total;
  final num average;

  /// Stars 1..5 → how many. A single average hides the difference between a
  /// seller with twenty fives and one whose fives cancel out a row of ones,
  /// and that difference is exactly what a buyer is looking for.
  final Map<int, int> breakdown;

  bool get isEmpty => total == 0;

  /// How much of the bar to fill for [star], 0..1.
  double share(int star) {
    if (total == 0) {
      return 0;
    }
    return (breakdown[star] ?? 0) / total;
  }
}

/// Raised when the API refuses a review for a reason the buyer can act on.
///
/// Kept apart from a network failure: "you already rated this deal" and
/// "the connection dropped" ask for completely different things.
class ReviewRefusedException implements Exception {
  const ReviewRefusedException(this.messageUz);

  final String messageUz;

  @override
  String toString() => 'ReviewRefusedException($messageUz)';
}
