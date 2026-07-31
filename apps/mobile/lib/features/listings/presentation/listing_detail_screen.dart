import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/uz_format.dart';
import '../../../core/localization/app_strings.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../shared/widgets/state_views.dart';
import '../domain/entities/listing.dart';
import '../../messages/presentation/open_chat_action.dart';
import 'favorite_action.dart';
import 'providers/listing_providers.dart';
import 'widgets/listing_card.dart';
import 'widgets/photo_gallery.dart';

/// One listing, in full.
///
/// Everything on this screen serves one decision: is this lot worth a phone
/// call? So the price, the volume and the total value sit above the fold, the
/// seller's standing is next, and the call button is pinned to the bottom
/// where a thumb already rests.
class ListingDetailScreen extends ConsumerWidget {
  const ListingDetailScreen({required this.id, super.key});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final listing = ref.watch(listingDetailProvider(id));

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.appName)),
      body: listing.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => EmptyView(
          title: AppStrings.listingNotFound,
          hint: AppStrings.listingNotFoundHint,
          action: OutlinedButton(
            onPressed: () => Navigator.of(context).maybePop(),
            child: const Text(AppStrings.navHome),
          ),
        ),
        data: (data) => _Content(listing: data),
      ),
      bottomNavigationBar: listing.maybeWhen(
        data: (data) => _CallBar(listing: data),
        orElse: () => null,
      ),
    );
  }
}

class _Content extends StatelessWidget {
  const _Content({required this.listing});

  final Listing listing;

  @override
  Widget build(BuildContext context) {
    final daysLeft = UzFormat.daysUntil(listing.expiresAt);

    return ListView(
      padding: const EdgeInsets.only(bottom: AppSpacing.xl),
      children: [
        // Full-bleed, and absent entirely when there are no photos.
        if (listing.photos.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.lg),
            child: PhotoGallery(photos: listing.photos),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  if (listing.isPromoted) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.saffron,
                        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                      ),
                      child: Text(
                        AppStrings.topBadge,
                        style: AppTypography.body(
                          size: 11,
                          weight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                  ],
                  Expanded(
                    child: Text(
                      listing.category.nameUz,
                      style: AppTypography.body(size: 13, color: AppColors.inkMuted),
                    ),
                  ),
                  Text(
                    UzFormat.timeAgo(listing.createdAt),
                    style: AppTypography.body(size: 12, color: AppColors.inkFaint),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),

              Text(listing.title, style: AppTypography.heading(size: 24)),
              const SizedBox(height: AppSpacing.lg),

              _PricePanel(listing: listing),
              const SizedBox(height: AppSpacing.lg),

              _FactRow(icon: Icons.place_outlined, label: listing.locationLabel),
              if (listing.minOrder != null)
                _FactRow(
                  icon: Icons.inventory_2_outlined,
                  label: AppStrings.minOrder,
                  value: UzFormat.quantity(listing.minOrder, listing.quantityUnit),
                  isNumber: true,
                ),
              if (listing.harvestDate != null)
                _FactRow(
                  icon: Icons.agriculture_outlined,
                  label: AppStrings.harvestDate,
                  value: UzFormat.date(listing.harvestDate),
                  isNumber: true,
                ),
              _FactRow(
                icon: Icons.local_shipping_outlined,
                label: AppStrings.delivery,
                value: listing.delivery.label,
              ),
              if (daysLeft != null)
                _FactRow(
                  icon: Icons.schedule_rounded,
                  label: AppStrings.expiresIn,
                  value: '$daysLeft ${AppStrings.daysShort}',
                  isNumber: true,
                ),

              if (listing.description?.trim().isNotEmpty == true) ...[
                const SizedBox(height: AppSpacing.xl),
                Text(AppStrings.descriptionTitle, style: AppTypography.heading(size: 17)),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  listing.description!,
                  style: AppTypography.body(size: 15, height: 1.55),
                ),
              ],

              const SizedBox(height: AppSpacing.xl),
              Text(AppStrings.sellerTitle, style: AppTypography.heading(size: 17)),
              const SizedBox(height: AppSpacing.sm),
              _SellerPanel(listing: listing),

              const SizedBox(height: AppSpacing.lg),
              Text(
                '${UzFormat.money(listing.viewCount)} ${AppStrings.views}',
                style: AppTypography.body(size: 12, color: AppColors.inkFaint),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Price, volume and what the two multiply out to.
///
/// The total is shown because it is the number a buyer actually works in —
/// "12 t at 9 500" is an abstraction until you see 114 million so'm.
class _PricePanel extends StatelessWidget {
  const _PricePanel({required this.listing});

  final Listing listing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Text(
                  UzFormat.price(listing.price, listing.priceUnit),
                  style: AppTypography.number(size: 24),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              VolumeChip(
                quantity: listing.quantity,
                unit: listing.quantityUnit,
                large: true,
              ),
            ],
          ),
          const Divider(height: AppSpacing.xl),
          Row(
            children: [
              Text(
                AppStrings.totalValue,
                style: AppTypography.body(size: 13, color: AppColors.inkMuted),
              ),
              const Spacer(),
              Text(
                UzFormat.total(listing.totalValue),
                style: AppTypography.number(size: 16, color: AppColors.ink),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SellerPanel extends StatelessWidget {
  const _SellerPanel({required this.listing});

  final Listing listing;

  @override
  Widget build(BuildContext context) {
    final seller = listing.seller;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusCard),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: AppColors.mint,
            child: Text(
              seller.displayName.substring(0, 1).toUpperCase(),
              style: AppTypography.heading(size: 18, color: AppColors.harvest),
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
                        style: AppTypography.heading(size: 15),
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
                const SizedBox(height: 2),
                Row(
                  children: [
                    if (seller.hasRating) ...[
                      const Icon(Icons.star_rounded, size: 14, color: AppColors.saffron),
                      const SizedBox(width: 2),
                      Text(
                        seller.ratingAvg.toStringAsFixed(1),
                        style: AppTypography.number(size: 12, color: AppColors.inkMuted),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                    ],
                    Text(
                      '${seller.salesCount} ${AppStrings.salesCount}',
                      style: AppTypography.body(size: 12, color: AppColors.inkMuted),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Label on the left, value on the right.
///
/// [isNumber] picks the tabular-figure style, which is what keeps the values
/// in this stack aligned with each other down the right edge.
class _FactRow extends StatelessWidget {
  const _FactRow({
    required this.icon,
    required this.label,
    this.value,
    this.isNumber = false,
  });

  final IconData icon;
  final String label;
  final String? value;
  final bool isNumber;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.inkFaint),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              label,
              style: AppTypography.body(size: 14, color: AppColors.inkMuted),
            ),
          ),
          if (value != null)
            Text(
              value!,
              style: isNumber
                  ? AppTypography.number(size: 14, color: AppColors.ink)
                  : AppTypography.body(size: 14, weight: FontWeight.w600),
            ),
        ],
      ),
    );
  }
}

/// Pinned call and message bar.
class _CallBar extends ConsumerWidget {
  const _CallBar({required this.listing});

  final Listing listing;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final saved = ref.watch(isSavedProvider(listing));

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.hairline)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  // Placing the actual call needs url_launcher and the call
                  // counter needs the API; both land with the auth slice. The
                  // number is shown meanwhile so the screen is still useful.
                  onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(UzFormat.phone(listing.seller.phone))),
                  ),
                  icon: const Icon(Icons.phone_rounded, size: 20),
                  label: const Text(AppStrings.callSeller),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              // Second, not first: a call closes a deal in this market and a
              // message starts one. It is the same width as the heart so the
              // call button keeps the room it needs.
              SizedBox(
                width: AppSpacing.primaryButtonHeight,
                height: AppSpacing.primaryButtonHeight,
                child: OutlinedButton(
                  onPressed: () =>
                      openChatForListing(context, ref, listing.id),
                  style: OutlinedButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: const Size.square(AppSpacing.primaryButtonHeight),
                  ),
                  child: const Icon(
                    Icons.chat_bubble_outline_rounded,
                    color: AppColors.ink,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              SizedBox(
                width: AppSpacing.primaryButtonHeight,
                height: AppSpacing.primaryButtonHeight,
                child: OutlinedButton(
                  onPressed: () => toggleFavoriteOrSignIn(context, ref, listing),
                  style: OutlinedButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: const Size.square(AppSpacing.primaryButtonHeight),
                  ),
                  child: Icon(
                    saved ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                    color: saved ? AppColors.danger : AppColors.ink,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
