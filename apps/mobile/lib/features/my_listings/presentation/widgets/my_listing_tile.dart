import 'package:flutter/material.dart';

import '../../../../core/localization/app_strings.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../listings/domain/entities/listing.dart';
import '../../../listings/domain/entities/units.dart';
import '../../../listings/presentation/widgets/listing_card.dart';
import '../my_listings_screen.dart' show expiryNote;

/// The seller's own listing: the same card a buyer sees, plus its status and
/// the two things the seller can do to it.
///
/// The buyer's card is reused rather than redrawn so that what the seller
/// checks is literally what a buyer will see — a separate layout here would
/// drift, and the first person to notice would be a farmer wondering why their
/// listing looks different in the feed.
class MyListingTile extends StatelessWidget {
  const MyListingTile({
    required this.listing,
    required this.onTap,
    required this.onMarkSold,
    required this.onDelete,
    this.now,
    super.key,
  });

  final Listing listing;
  final VoidCallback onTap;
  final VoidCallback onMarkSold;
  final VoidCallback onDelete;

  /// Injected so a test's "expires in 2 days" does not depend on the day it
  /// runs.
  final DateTime? now;

  @override
  Widget build(BuildContext context) {
    final note = expiryNote(listing, now: now);

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // No favourite button: a heart on your own listing does nothing
          // useful and takes the space the status needs.
          ListingCard(listing: listing, onTap: onTap),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              0,
              AppSpacing.sm,
              AppSpacing.xs,
            ),
            child: Row(
              children: [
                _StatusPill(status: listing.status),
                if (note != null) ...[
                  const SizedBox(width: AppSpacing.sm),
                  Flexible(
                    child: Text(
                      note,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body(
                        size: 12,
                        color: AppColors.saffronDark,
                      ),
                    ),
                  ),
                ],
                const Spacer(),
                // Only an active listing can be sold. Offering it on a sold or
                // expired one is a button that can only return an error.
                if (listing.status == ListingStatus.active)
                  TextButton(
                    onPressed: onMarkSold,
                    child: const Text(AppStrings.markSold),
                  ),
                IconButton(
                  onPressed: onDelete,
                  tooltip: AppStrings.deleteListing,
                  icon: const Icon(Icons.delete_outline_rounded, size: 20),
                  color: AppColors.danger,
                ),
              ],
            ),
          ),
          if (listing.status == ListingStatus.expired ||
              listing.status == ListingStatus.blocked)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                0,
                AppSpacing.md,
                AppSpacing.md,
              ),
              child: Text(
                listing.status == ListingStatus.expired
                    ? AppStrings.expiredHint
                    : AppStrings.blockedHint,
                style: AppTypography.body(size: 12, color: AppColors.inkMuted),
              ),
            ),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});

  final ListingStatus status;

  @override
  Widget build(BuildContext context) {
    final (label, foreground, background) = switch (status) {
      ListingStatus.active => (
          AppStrings.statusActive,
          AppColors.harvest,
          AppColors.mint,
        ),
      ListingStatus.sold => (
          AppStrings.statusSold,
          AppColors.inkMuted,
          AppColors.surfaceSoft,
        ),
      ListingStatus.expired => (
          AppStrings.statusExpired,
          AppColors.saffronDark,
          AppColors.saffronSubtle,
        ),
      ListingStatus.blocked => (
          AppStrings.statusBlocked,
          AppColors.danger,
          AppColors.surfaceSoft,
        ),
      ListingStatus.draft => (
          AppStrings.statusDraft,
          AppColors.inkMuted,
          AppColors.surfaceSoft,
        ),
      ListingStatus.pending => (
          AppStrings.statusPending,
          AppColors.turquoise,
          AppColors.surfaceSoft,
        ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
      ),
      child: Text(
        label,
        style: AppTypography.body(
          size: 12,
          weight: FontWeight.w600,
          color: foreground,
        ),
      ),
    );
  }
}
