import 'package:flutter/material.dart';

import '../../core/localization/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';

/// Empty, error and skeleton states.
///
/// They live together because on this product they are the common case, not
/// the exception: the audience is on EDGE in a field, so a request that is
/// still in flight or has just failed is what the screen shows most often. A
/// bare spinner tells a farmer nothing about whether to wait or retry.
class ErrorView extends StatelessWidget {
  const ErrorView({
    required this.onRetry,
    this.title = AppStrings.loadFailed,
    this.hint = AppStrings.loadFailedHint,
    super.key,
  });

  final VoidCallback onRetry;
  final String title;
  final String hint;

  @override
  Widget build(BuildContext context) {
    return _CenteredMessage(
      icon: Icons.wifi_off_rounded,
      title: title,
      hint: hint,
      action: OutlinedButton(
        onPressed: onRetry,
        child: const Text(AppStrings.retry),
      ),
    );
  }
}

class EmptyView extends StatelessWidget {
  const EmptyView({
    this.title = AppStrings.nothingFound,
    this.hint = AppStrings.nothingFoundHint,
    this.action,
    super.key,
  });

  final String title;
  final String hint;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return _CenteredMessage(
      icon: Icons.search_off_rounded,
      title: title,
      hint: hint,
      action: action,
    );
  }
}

class _CenteredMessage extends StatelessWidget {
  const _CenteredMessage({
    required this.icon,
    required this.title,
    required this.hint,
    this.action,
  });

  final IconData icon;
  final String title;
  final String hint;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: AppColors.inkFaint),
            const SizedBox(height: AppSpacing.lg),
            Text(
              title,
              textAlign: TextAlign.center,
              style: AppTypography.heading(size: 18),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              hint,
              textAlign: TextAlign.center,
              style: AppTypography.body(size: 14, color: AppColors.inkMuted),
            ),
            if (action != null) ...[
              const SizedBox(height: AppSpacing.lg),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}

/// Grey blocks in the shape of the cards that are coming.
///
/// A skeleton rather than a spinner because it keeps the list from jumping
/// when the data lands, and because it tells the user how much is on its way.
class ListingCardSkeleton extends StatelessWidget {
  const ListingCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusCard),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _Block(width: 92, height: 92, radius: AppSpacing.radiusMd),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                _Block(height: 14, widthFactor: 0.9),
                SizedBox(height: AppSpacing.sm),
                _Block(height: 14, widthFactor: 0.5),
                SizedBox(height: AppSpacing.md),
                _Block(height: 12, widthFactor: 0.65),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Block extends StatelessWidget {
  const _Block({
    this.width,
    this.widthFactor,
    required this.height,
    this.radius = AppSpacing.radiusSm,
  });

  final double? width;
  final double? widthFactor;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final block = Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.canvas,
        borderRadius: BorderRadius.circular(radius),
      ),
    );

    if (widthFactor == null) {
      return block;
    }
    return FractionallySizedBox(
      alignment: Alignment.centerLeft,
      widthFactor: widthFactor,
      child: block,
    );
  }
}
