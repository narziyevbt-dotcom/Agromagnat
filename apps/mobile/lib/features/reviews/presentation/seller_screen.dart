import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/uz_format.dart';
import '../../../core/localization/app_strings.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../shared/widgets/state_views.dart';
import '../../listings/domain/entities/seller.dart';
import '../../listings/domain/repositories/listing_repository.dart';
import '../../listings/presentation/listing_detail_screen.dart';
import '../../listings/presentation/providers/listing_providers.dart';
import '../../listings/presentation/widgets/listing_card.dart';
import '../domain/entities/review.dart';
import 'providers/review_providers.dart';
import 'widgets/rating_stars.dart';

/// Who you are about to call.
///
/// A marketplace puts strangers in a car together with cash; the seller page
/// is where a buyer decides whether to make that trip. It leads with the
/// histogram rather than the average, because "4.6" reads the same whether it
/// is twenty fives or a row of fives cancelling out a row of ones.
class SellerScreen extends ConsumerWidget {
  const SellerScreen({required this.seller, super.key});

  final Seller seller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reviews = ref.watch(sellerReviewsProvider(seller.id));
    final listings = ref.watch(
      searchResultsProvider(ListingQuery(sellerId: seller.id)),
    );

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.sellerTitleScreen)),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          _Header(seller: seller),
          const SizedBox(height: AppSpacing.lg),
          reviews.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (_, __) => ErrorView(
              onRetry: () => ref.invalidate(sellerReviewsProvider(seller.id)),
            ),
            data: (data) => _Reviews(reviews: data),
          ),
          const SizedBox(height: AppSpacing.xl),
          Text(
            AppStrings.sellerListings,
            style: AppTypography.heading(size: 17),
          ),
          const SizedBox(height: AppSpacing.md),
          listings.when(
            loading: () => const ListingCardSkeleton(),
            error: (_, __) => const SizedBox.shrink(),
            data: (page) => Column(
              children: [
                for (final listing in page.items) ...[
                  ListingCard(
                    listing: listing,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => ListingDetailScreen(id: listing.id),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                ],
                if (page.items.isEmpty)
                  Text(
                    AppStrings.nothingFound,
                    style: AppTypography.body(
                      size: 13,
                      color: AppColors.inkMuted,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.seller});

  final Seller seller;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusCard),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 26,
            backgroundColor: AppColors.mint,
            child: Text(
              seller.displayName.substring(0, 1).toUpperCase(),
              style: AppTypography.heading(size: 20, color: AppColors.harvest),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        seller.displayName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.heading(size: 17),
                      ),
                    ),
                    if (seller.isVerified) ...[
                      const SizedBox(width: AppSpacing.xs),
                      const Icon(
                        Icons.verified_rounded,
                        size: 16,
                        color: AppColors.turquoise,
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${UzFormat.money(seller.salesCount)} ${AppStrings.salesCount}',
                  style: AppTypography.number(
                    size: 13,
                    color: AppColors.inkMuted,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Reviews extends StatelessWidget {
  const _Reviews({required this.reviews});

  final SellerReviews reviews;

  @override
  Widget build(BuildContext context) {
    if (reviews.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppSpacing.radiusCard),
        ),
        child: Column(
          children: [
            Text(AppStrings.noReviews, style: AppTypography.heading(size: 15)),
            const SizedBox(height: AppSpacing.xs),
            Text(
              AppStrings.noReviewsHint,
              textAlign: TextAlign.center,
              style: AppTypography.body(size: 13, color: AppColors.inkMuted),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppSpacing.radiusCard),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Column(
                children: [
                  Text(
                    reviews.average.toStringAsFixed(1),
                    style: AppTypography.number(
                      size: 34,
                      weight: FontWeight.w700,
                    ),
                  ),
                  RatingStars(rating: reviews.average),
                  const SizedBox(height: 2),
                  Text(
                    AppStrings.reviewCount(reviews.total),
                    style: AppTypography.body(
                      size: 12,
                      color: AppColors.inkMuted,
                    ),
                  ),
                ],
              ),
              const SizedBox(width: AppSpacing.lg),
              // The histogram, which is the part that actually informs: five
              // fives and one one is a different seller from six fours.
              Expanded(
                child: Column(
                  children: [
                    for (var star = 5; star >= 1; star--)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 1),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 12,
                              child: Text(
                                '$star',
                                style: AppTypography.number(
                                  size: 11,
                                  color: AppColors.inkMuted,
                                ),
                              ),
                            ),
                            Expanded(
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(4),
                                child: LinearProgressIndicator(
                                  value: reviews.share(star),
                                  minHeight: 6,
                                  backgroundColor: AppColors.surfaceSoft,
                                  valueColor: const AlwaysStoppedAnimation(
                                    AppColors.saffron,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        for (final review in reviews.items) ...[
          _ReviewCard(review: review),
          const SizedBox(height: AppSpacing.sm),
        ],
      ],
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.review});

  final Review review;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              RatingStars(rating: review.rating, size: 14),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  review.authorName ?? '',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.body(size: 13, weight: FontWeight.w600),
                ),
              ),
              Text(
                UzFormat.timeAgo(review.createdAt),
                style: AppTypography.body(size: 11, color: AppColors.inkFaint),
              ),
            ],
          ),
          if (review.comment != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              review.comment!,
              style: AppTypography.body(size: 14, color: AppColors.ink),
            ),
          ],
        ],
      ),
    );
  }
}
