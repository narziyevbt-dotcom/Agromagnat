import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';
import '../../features/listings/data/listing_outbox.dart';
import '../../features/listings/presentation/providers/outbox_providers.dart';

/// Says that a listing is written down but not yet live.
///
/// It has to be visible on the screen the seller lands on, not tucked into a
/// profile page. Somebody who taps publish and sees nothing in the feed will
/// conclude it failed and post it again — the duplicate is the failure mode
/// this banner exists to prevent.
class OutboxBanner extends ConsumerWidget {
  const OutboxBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final outbox = ref.watch(outboxControllerProvider);
    if (!outbox.hasPending) {
      return const SizedBox.shrink();
    }

    final stuck = outbox.stuck.isNotEmpty;

    return Container(
      color: stuck ? AppColors.mint : AppColors.saffronSubtle,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        children: [
          Icon(
            stuck ? Icons.error_outline_rounded : Icons.schedule_send_rounded,
            size: 16,
            color: stuck ? AppColors.danger : AppColors.saffronDark,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _headline(outbox),
                  style: AppTypography.body(size: 13, weight: FontWeight.w600),
                ),
                Text(
                  stuck ? AppStrings.queuedStuckHint : AppStrings.queuedHint,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.body(size: 12, color: AppColors.inkMuted),
                ),
              ],
            ),
          ),
          if (outbox.sending)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          else if (stuck)
            // The hint tells them to delete it and post again, so the button
            // has to be the delete. Retrying is what already failed five times.
            TextButton(
              onPressed: () => _discard(context, ref, outbox.stuck.first),
              child: const Text(AppStrings.discardQueued),
            )
          else
            TextButton(
              onPressed: () =>
                  ref.read(outboxControllerProvider.notifier).flush(),
              child: const Text(AppStrings.sendNow),
            ),
        ],
      ),
    );
  }

  /// Says what is actually waiting. A banner that counts listings while the
  /// queue holds only photos is a banner that reads as a bug.
  String _headline(OutboxState outbox) {
    if (outbox.pending == 0) {
      return AppStrings.queuedPhotoCount(outbox.pendingPhotos);
    }
    if (outbox.pendingPhotos == 0) {
      return AppStrings.queuedCount(outbox.pending);
    }
    return AppStrings.queuedBoth(outbox.pending, outbox.pendingPhotos);
  }

  /// Asked first: this is the seller's own typing and there is no undo.
  Future<void> _discard(
    BuildContext context,
    WidgetRef ref,
    OutboxEntry entry,
  ) async {
    // Asked first: this is the seller's own typing and there is no undo.
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text(AppStrings.discardQueuedTitle),
        content: Text(AppStrings.discardQueuedBody(entry.title)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text(AppStrings.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text(AppStrings.discardQueued),
          ),
        ],
      ),
    );

    if (confirmed ?? false) {
      await ref.read(outboxControllerProvider.notifier).discard(entry.id);
    }
  }
}
