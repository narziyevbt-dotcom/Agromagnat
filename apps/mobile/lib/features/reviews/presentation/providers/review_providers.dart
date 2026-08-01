import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_config.dart';
import '../../../../core/network/api_providers.dart';
import '../../data/api_review_repository.dart';
import '../../data/mock_review_repository.dart';
import '../../domain/entities/review.dart';
import '../../domain/repositories/review_repository.dart';

final reviewRepositoryProvider = Provider<ReviewRepository>((ref) {
  if (!ApiConfig.isConfigured) {
    return MockReviewRepository();
  }
  return ApiReviewRepository(ref.watch(apiClientProvider));
});

final sellerReviewsProvider =
    FutureProvider.autoDispose.family<SellerReviews, String>((ref, sellerId) {
  return ref.watch(reviewRepositoryProvider).forSeller(sellerId);
});

/// The caller's own review of a listing, or null.
///
/// Decides between "rate this seller" and showing the stars they already
/// gave. Not cached across screens: leaving one has to change it immediately.
final myReviewProvider =
    FutureProvider.autoDispose.family<Review?, String>((ref, listingId) {
  return ref.watch(reviewRepositoryProvider).mine(listingId);
});
