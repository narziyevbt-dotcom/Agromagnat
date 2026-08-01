import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/app_strings.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../listings/domain/entities/listing.dart';
import '../../../listings/domain/entities/units.dart';
import '../providers/review_providers.dart';
import 'rate_seller_sheet.dart';
import 'rating_stars.dart';

/// "Rate the seller" on a listing that has been sold — or the stars already
/// given, if this buyer has rated it.
///
/// Renders nothing at all otherwise. Three cases where it must stay silent:
///
/// - **The listing is still active.** The API refuses a review on one, and it
///   is right to: otherwise a competitor could rate a rival on a listing
///   nobody ever bought.
/// - **It is the viewer's own listing.** Rating yourself is not a thing.
/// - **Nobody is signed in.** The prompt would be an invitation to a login
///   for something they may have no part in.
class RateSellerPanel extends ConsumerWidget {
  const RateSellerPanel({required this.listing, super.key});

  final Listing listing;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);

    if (listing.status != ListingStatus.sold ||
        user == null ||
        user.id == listing.seller.id) {
      return const SizedBox.shrink();
    }

    final mine = ref.watch(myReviewProvider(listing.id));

    return mine.when(
      // Silent while it loads and silent if it fails: this panel is an offer,
      // not information, and a spinner or an error where a buyer expects the
      // seller's details is worse than nothing.
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (review) => Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.lg),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: AppColors.mint,
            borderRadius: BorderRadius.circular(AppSpacing.radiusCard),
          ),
          child: review == null
              ? Row(
                  children: [
                    Expanded(
                      child: Text(
                        AppStrings.rateSeller,
                        style: AppTypography.body(
                          size: 14,
                          weight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    FilledButton(
                      onPressed: () => rateSeller(context, ref, listing.id),
                      child: const Text(AppStrings.pickRating),
                    ),
                  ],
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      AppStrings.yourReview,
                      style: AppTypography.body(
                        size: 13,
                        weight: FontWeight.w600,
                        color: AppColors.inkMuted,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    RatingStars(rating: review.rating, size: 20),
                    if (review.comment != null) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        review.comment!,
                        style: AppTypography.body(size: 14),
                      ),
                    ],
                  ],
                ),
        ),
      ),
    );
  }
}
