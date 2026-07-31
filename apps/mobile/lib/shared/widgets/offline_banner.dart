import 'package:flutter/material.dart';

import '../../core/format/uz_format.dart';
import '../../core/localization/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';

/// Says that what is on screen came off the disk, and how old it is.
///
/// The age is the point. Showing stale listings silently is worse than showing
/// none: a farmer who reads a three-day-old price as today's will quote it to
/// a buyer. "Offline" on its own leaves them to guess how old, and they will
/// guess generously.
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({required this.cachedAt, this.onRetry, super.key});

  final DateTime cachedAt;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.saffronSubtle,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_rounded, size: 16, color: AppColors.saffronDark),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  AppStrings.offlineTitle,
                  style: AppTypography.body(size: 13, weight: FontWeight.w600),
                ),
                Text(
                  AppStrings.offlineSince(UzFormat.timeAgo(cachedAt)),
                  style: AppTypography.body(size: 12, color: AppColors.inkMuted),
                ),
              ],
            ),
          ),
          if (onRetry != null)
            TextButton(
              onPressed: onRetry,
              child: const Text(AppStrings.offlineRetry),
            ),
        ],
      ),
    );
  }
}
