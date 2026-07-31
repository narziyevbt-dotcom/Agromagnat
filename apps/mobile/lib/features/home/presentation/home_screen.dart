import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/app_strings.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../shared/widgets/offline_banner.dart';
import '../../../shared/widgets/state_views.dart';
import '../../listings/domain/entities/category.dart';
import '../../listings/domain/repositories/listing_repository.dart';
import '../../listings/presentation/listing_detail_screen.dart';
import '../../listings/presentation/providers/listing_providers.dart';
import '../../listings/presentation/widgets/listing_card.dart';
import '../../shell/presentation/main_shell.dart';

/// Search bar, category grid, newest listings.
///
/// The search field here is a button, not an input: tapping it opens the
/// search screen with the keyboard already up. Typing on the home screen would
/// mean maintaining two result lists.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  /// The home feed is always the newest listings, unfiltered. Search owns the
  /// query the user edits.
  static const ListingQuery _feedQuery = ListingQuery(limit: 20);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feed = ref.watch(homeFeedProvider(_feedQuery));
    final categories = ref.watch(categoriesProvider);

    return Scaffold(
      body: RefreshIndicator(
        color: AppColors.harvest,
        onRefresh: () =>
            ref.read(homeFeedProvider(_feedQuery).notifier).refresh(),
        child: CustomScrollView(
          slivers: [
            const _HomeHeader(),
            // Above the categories, not buried under the feed: it changes how
            // every price below it should be read.
            if (feed.valueOrNull?.cachedAt case final cachedAt?)
              SliverToBoxAdapter(
                child: OfflineBanner(
                  cachedAt: cachedAt,
                  onRetry: () =>
                      ref.read(homeFeedProvider(_feedQuery).notifier).refresh(),
                ),
              ),
            SliverToBoxAdapter(child: _Categories(categories: categories)),
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.xl,
                  AppSpacing.lg,
                  AppSpacing.md,
                ),
                child: _SectionTitle(AppStrings.latestListings),
              ),
            ),
            feed.when(
              loading: () => SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                sliver: SliverList.separated(
                  itemCount: 4,
                  separatorBuilder: _gap,
                  itemBuilder: _skeleton,
                ),
              ),
              error: (_, __) => SliverFillRemaining(
                hasScrollBody: false,
                child: ErrorView(
                  onRetry: () =>
                      ref.read(homeFeedProvider(_feedQuery).notifier).refresh(),
                ),
              ),
              data: (page) {
                if (page.items.isEmpty) {
                  return const SliverFillRemaining(
                    hasScrollBody: false,
                    child: EmptyView(),
                  );
                }
                return SliverPadding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    0,
                    AppSpacing.lg,
                    AppSpacing.xl,
                  ),
                  sliver: SliverList.separated(
                    itemCount: page.items.length,
                    separatorBuilder: _gap,
                    itemBuilder: (context, index) {
                      final listing = page.items[index];
                      return ListingCard(
                        listing: listing,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => ListingDetailScreen(id: listing.id),
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  static Widget _gap(BuildContext context, int index) =>
      const SizedBox(height: AppSpacing.md);

  static Widget _skeleton(BuildContext context, int index) =>
      const ListingCardSkeleton();
}

/// Forest header carrying the brand and the search entry point.
class _HomeHeader extends StatelessWidget {
  const _HomeHeader();

  @override
  Widget build(BuildContext context) {
    return SliverToBoxAdapter(
      child: Container(
        color: AppColors.forest,
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.md,
              AppSpacing.lg,
              AppSpacing.lg,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  AppStrings.appName,
                  style: AppTypography.heading(size: 24, color: Colors.white),
                ),
                const SizedBox(height: 2),
                Text(
                  AppStrings.tagline,
                  style: AppTypography.body(
                    size: 13,
                    color: Colors.white.withValues(alpha: 0.72),
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                const _SearchButton(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SearchButton extends ConsumerWidget {
  const _SearchButton();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Semantics(
      button: true,
      label: AppStrings.searchHint,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          onTap: () => ref.read(shellIndexProvider.notifier).state = 1,
          child: Container(
            height: AppSpacing.minTapTarget + 4,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            child: Row(
              children: [
                const Icon(Icons.search_rounded, color: AppColors.inkFaint),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  AppStrings.searchHint,
                  style: AppTypography.body(size: 15, color: AppColors.inkFaint),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Categories extends ConsumerWidget {
  const _Categories({required this.categories});

  final AsyncValue<List<ListingCategory>> categories;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return categories.when(
      loading: () => const SizedBox(height: 108),
      error: (_, __) => const SizedBox.shrink(),
      data: (all) {
        final featured = all.where((category) => category.isFeatured).toList();
        if (featured.isEmpty) {
          return const SizedBox.shrink();
        }

        return Padding(
          padding: const EdgeInsets.only(top: AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                child: _SectionTitle(AppStrings.categories),
              ),
              const SizedBox(height: AppSpacing.md),
              SizedBox(
                height: 92,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                  itemCount: featured.length,
                  separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.sm),
                  itemBuilder: (context, index) {
                    final category = featured[index];
                    return _CategoryTile(
                      category: category,
                      onTap: () {
                        // Selecting a category is a search with one filter set,
                        // so it hands off to the search tab rather than
                        // growing a third list on this screen.
                        ref.read(searchQueryProvider.notifier).state =
                            ListingQuery(categoryId: category.id);
                        ref.read(shellIndexProvider.notifier).state = 1;
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile({required this.category, required this.onTap});

  final ListingCategory category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: category.nameUz,
      child: ExcludeSemantics(
        child: Material(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            child: SizedBox(
              width: 88,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    category.emoji ?? '🌾',
                    style: const TextStyle(fontSize: 28),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    child: Text(
                      category.nameUz,
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body(size: 11, weight: FontWeight.w600),
                    ),
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

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(text, style: AppTypography.heading(size: 18));
  }
}
