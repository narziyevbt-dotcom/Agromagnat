import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/format/uz_format.dart';
import '../../../../core/localization/app_strings.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/listing.dart';
import '../../domain/entities/units.dart';
import '../providers/listing_providers.dart';

/// The one card the whole feed is made of.
///
/// The volume chip is as prominent as the price, which is the rule the product
/// is built on: a wholesale buyer decides on volume first ("can this fill my
/// truck?") and price second. Every other classifieds app buries the quantity
/// in the description — here it is a green chip you cannot miss.
class ListingCard extends ConsumerWidget {
  const ListingCard({
    required this.listing,
    this.onTap,
    this.onFavoriteToggle,
    super.key,
  });

  final Listing listing;
  final VoidCallback? onTap;
  final VoidCallback? onFavoriteToggle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Semantics(
      button: true,
      // Read out as one sentence rather than five fragments, so TalkBack gives
      // the same "what, how much, where" summary a sighted user gets at a
      // glance.
      label: '${listing.title}. '
          '${UzFormat.quantity(listing.quantity, listing.quantityUnit)}. '
          '${UzFormat.price(listing.price, listing.priceUnit)}. '
          '${listing.locationLabel}.',
      child: ExcludeSemantics(
        child: Material(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppSpacing.radiusCard),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(AppSpacing.radiusCard),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _Thumbnail(listing: listing),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(child: _Details(listing: listing)),
                  if (onFavoriteToggle != null)
                    _FavoriteButton(
                      isFavorite: ref.watch(isSavedProvider(listing)),
                      onTap: onFavoriteToggle!,
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Thumbnail extends StatelessWidget {
  const _Thumbnail({required this.listing});

  final Listing listing;

  @override
  Widget build(BuildContext context) {
    final photo = listing.coverPhoto;

    return Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          child: SizedBox(
            width: 92,
            height: 92,
            child: photo == null
                // Most listings arrive without a photo — a farmer posting from
                // a field types faster than they photograph. The category
                // emoji on mint is a deliberate placeholder, not a broken
                // image icon.
                ? Container(
                    color: AppColors.mint,
                    alignment: Alignment.center,
                    child: Text(
                      listing.category.emoji ?? '🌾',
                      style: const TextStyle(fontSize: 32),
                    ),
                  )
                : Image.network(
                    photo.feedUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      color: AppColors.mint,
                      alignment: Alignment.center,
                      child: Text(
                        listing.category.emoji ?? '🌾',
                        style: const TextStyle(fontSize: 32),
                      ),
                    ),
                  ),
          ),
        ),
        if (listing.isPromoted)
          Positioned(
            top: AppSpacing.xs,
            left: AppSpacing.xs,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.saffron,
                borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
              ),
              child: Text(
                AppStrings.topBadge,
                style: AppTypography.body(
                  size: 10,
                  weight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _Details extends StatelessWidget {
  const _Details({required this.listing});

  final Listing listing;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          listing.title,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.heading(size: 15, weight: FontWeight.w700),
        ),
        const SizedBox(height: AppSpacing.sm),

        // Price and volume sit on one line, both in harvest green, both in
        // tabular figures. Neither outranks the other.
        Row(
          children: [
            Flexible(
              child: Text(
                UzFormat.price(listing.price, listing.priceUnit),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.number(size: 15),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            VolumeChip(
              quantity: listing.quantity,
              unit: listing.quantityUnit,
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),

        Row(
          children: [
            const Icon(Icons.place_outlined, size: 14, color: AppColors.inkFaint),
            const SizedBox(width: 2),
            Expanded(
              child: Text(
                listing.locationLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.body(size: 12, color: AppColors.inkMuted),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Text(
              UzFormat.timeAgo(listing.createdAt),
              style: AppTypography.body(size: 11, color: AppColors.inkFaint),
            ),
          ],
        ),
      ],
    );
  }
}

/// The green volume chip — "12 t".
///
/// Public because the detail screen shows the same chip, and two copies would
/// drift apart the first time the radius changes.
class VolumeChip extends StatelessWidget {
  const VolumeChip({
    required this.quantity,
    required this.unit,
    this.large = false,
    super.key,
  });

  final num quantity;
  final QuantityUnit unit;
  final bool large;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: large ? AppSpacing.md : AppSpacing.sm,
        vertical: large ? 6 : 3,
      ),
      decoration: BoxDecoration(
        color: AppColors.mint,
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      ),
      child: Text(
        UzFormat.quantity(quantity, unit),
        style: AppTypography.number(size: large ? 16 : 13, weight: FontWeight.w700),
      ),
    );
  }
}

class _FavoriteButton extends StatelessWidget {
  const _FavoriteButton({required this.isFavorite, required this.onTap});

  final bool isFavorite;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      toggled: isFavorite,
      label: isFavorite
          ? AppStrings.removeFromFavorites
          : AppStrings.addToFavorites,
      child: InkResponse(
        onTap: onTap,
        radius: AppSpacing.minTapTarget / 2,
        child: SizedBox(
          width: AppSpacing.minTapTarget,
          height: AppSpacing.minTapTarget,
          child: Icon(
            isFavorite ? Icons.favorite_rounded : Icons.favorite_border_rounded,
            size: 22,
            // Saved is the only place danger red is not an error — a filled
            // heart is universally read as "kept", and a green one would
            // collide with the money colour.
            color: isFavorite ? AppColors.danger : AppColors.inkFaint,
          ),
        ),
      ),
    );
  }
}
