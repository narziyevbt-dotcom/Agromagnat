import '../entities/review.dart';

abstract interface class ReviewRepository {
  /// A seller's visible reviews with the star histogram.
  Future<SellerReviews> forSeller(String sellerId, {int page});

  /// Rates the seller of a **sold** listing.
  ///
  /// Throws [ReviewRefusedException] when the API says no for a reason the
  /// buyer can understand: the listing is not sold, it is their own, or they
  /// have already rated this deal.
  Future<Review> rate(String listingId, {required int rating, String? comment});

  /// The caller's own review of a listing, or null.
  ///
  /// What decides between "rate this seller" and "you rated them 4" on the
  /// listing screen.
  Future<Review?> mine(String listingId);
}
