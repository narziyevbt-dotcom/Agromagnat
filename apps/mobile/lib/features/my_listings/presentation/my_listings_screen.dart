import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/uz_format.dart';
import '../../../core/localization/app_strings.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../shared/widgets/state_views.dart';
import '../../add_listing/presentation/add_listing_screen.dart';
import '../../add_listing/presentation/providers/draft_controller.dart';
import '../../auth/presentation/widgets/sign_in_gate.dart';
import '../../listings/domain/entities/listing.dart';
import '../../listings/domain/entities/units.dart';
import '../../listings/presentation/listing_detail_screen.dart';
import '../../listings/presentation/providers/listing_providers.dart';
import 'providers/my_listings_providers.dart';
import 'widgets/my_listing_tile.dart';

/// Everything the seller has posted, in any status.
///
/// The feed only shows active listings, so without this screen a listing that
/// expired or was blocked simply vanishes — and a farmer who cannot find their
/// own listing concludes the app lost it and posts it again.
class MyListingsScreen extends StatelessWidget {
  const MyListingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.myListingsTitle)),
      body: const SignInGate(
        reason: AppStrings.signInRequiredProfile,
        icon: Icons.list_alt_rounded,
        child: _MyListings(),
      ),
    );
  }
}

class _MyListings extends ConsumerWidget {
  const _MyListings();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(myListingsProvider);
    final controller = ref.read(myListingsProvider.notifier);

    return state.when(
      loading: () => ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: const [
          ListingCardSkeleton(),
          SizedBox(height: AppSpacing.md),
          ListingCardSkeleton(),
        ],
      ),
      error: (_, __) => ErrorView(onRetry: controller.refresh),
      data: (page) {
        if (page.items.isEmpty) {
          return EmptyView(
            title: AppStrings.myListingsEmpty,
            hint: AppStrings.myListingsEmptyHint,
            action: FilledButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const AddListingScreen(),
                ),
              ),
              child: const Text(AppStrings.navAdd),
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: controller.refresh,
          child: ListView.separated(
            padding: const EdgeInsets.all(AppSpacing.lg),
            itemCount: page.items.length + (page.hasMore ? 1 : 0),
            separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.md),
            itemBuilder: (context, index) {
              if (index >= page.items.length) {
                controller.loadMore();
                return const Padding(
                  padding: EdgeInsets.all(AppSpacing.lg),
                  child: Center(child: CircularProgressIndicator()),
                );
              }

              final listing = page.items[index];
              return MyListingTile(
                listing: listing,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => ListingDetailScreen(id: listing.id),
                  ),
                ),
                onEdit: () => _edit(context, ref, listing),
                onMarkSold: () => _markSold(context, ref, listing),
                onRenew: () => _renew(context, ref, listing),
                onDelete: () => _delete(context, ref, listing),
              );
            },
          ),
        );
      },
    );
  }

  /// Opens the posting form on an existing listing.
  ///
  /// The catalogue is read first because only its copy of a category carries
  /// the form spec — the one nested in a listing does not, and a form opened
  /// without it would show nothing but the category row.
  Future<void> _edit(
    BuildContext context,
    WidgetRef ref,
    Listing listing,
  ) async {
    final categories = await ref.read(categoriesProvider.future);
    final category = categories
        .where((candidate) => candidate.id == listing.category.id)
        .firstOrNull;

    if (!context.mounted) {
      return;
    }
    if (category == null) {
      // A category retired since the listing was posted. Saying so beats an
      // empty form the seller cannot submit.
      _say(context, AppStrings.editCategoryMissing);
      return;
    }

    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => AddListingScreen(
          editing: EditTarget(listing, category),
        ),
      ),
    );

    if ((saved ?? false) && context.mounted) {
      // Refetched rather than patched from the returned listing: an edit can
      // change what the row shows in more places than this screen tracks.
      await ref.read(myListingsProvider.notifier).refresh();
    }
  }

  Future<void> _markSold(
    BuildContext context,
    WidgetRef ref,
    Listing listing,
  ) async {
    // Confirmed because it is one-way: the API has no endpoint that puts a
    // sold listing back on the market.
    final confirmed = await _confirm(
      context,
      title: listing.title,
      body: AppStrings.markSoldConfirm,
      action: AppStrings.markSold,
    );
    if (!confirmed || !context.mounted) {
      return;
    }

    final ok = await ref.read(myListingsProvider.notifier).markSold(listing);
    if (context.mounted) {
      _say(context, ok ? AppStrings.markSoldDone : AppStrings.actionFailed);
    }
  }

  /// Not confirmed, unlike sold and delete: putting a listing back is the one
  /// action here that costs nothing to undo — the seller can mark it sold or
  /// delete it a moment later.
  Future<void> _renew(
    BuildContext context,
    WidgetRef ref,
    Listing listing,
  ) async {
    final ok = await ref.read(myListingsProvider.notifier).renew(listing);
    if (context.mounted) {
      _say(context, ok ? AppStrings.renewDone : AppStrings.actionFailed);
    }
  }

  Future<void> _delete(
    BuildContext context,
    WidgetRef ref,
    Listing listing,
  ) async {
    final confirmed = await _confirm(
      context,
      title: listing.title,
      body: AppStrings.deleteListingConfirm,
      action: AppStrings.deleteListing,
    );
    if (!confirmed || !context.mounted) {
      return;
    }

    final ok = await ref.read(myListingsProvider.notifier).remove(listing);
    if (context.mounted) {
      _say(
        context,
        ok ? AppStrings.deleteListingDone : AppStrings.actionFailed,
      );
    }
  }

  /// Names the listing in the title. "Delete this listing?" over a list of
  /// eight is how the wrong one gets deleted.
  Future<bool> _confirm(
    BuildContext context, {
    required String title,
    required String body,
    required String action,
  }) async {
    final answer = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(title, maxLines: 2, overflow: TextOverflow.ellipsis),
        content: Text(body),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text(AppStrings.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: Text(action),
          ),
        ],
      ),
    );
    return answer ?? false;
  }

  void _say(BuildContext context, String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }
}

/// The days-left note the tile shows, kept here so the screen and its tests
/// agree on when a listing counts as "about to expire".
String? expiryNote(Listing listing, {DateTime? now}) {
  if (listing.status != ListingStatus.active) {
    return null;
  }
  final days = UzFormat.daysUntil(listing.expiresAt, now: now);
  // Only near the end: a note on day one is noise, and noise is what people
  // learn to ignore before day twelve.
  return days == null || days > 3 ? null : AppStrings.expiresInDays(days);
}
