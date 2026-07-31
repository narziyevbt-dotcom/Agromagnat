import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/app_strings.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../shared/widgets/state_views.dart';
import '../../listings/domain/repositories/listing_repository.dart';
import '../../listings/presentation/favorite_action.dart';
import '../../listings/presentation/listing_detail_screen.dart';
import '../../listings/presentation/providers/listing_providers.dart';
import '../../listings/presentation/widgets/listing_card.dart';
import 'widgets/filter_sheet.dart';

/// Search with filters, sorting and cursor paging.
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _controller.text = ref.read(searchQueryProvider).text ?? '';
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  /// Without the debounce this fires a query per keystroke, which on a metered
  /// connection is both slow and expensive for the user.
  void _onTextChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      final trimmed = value.trim();
      ref.read(searchQueryProvider.notifier).update(
            (query) => query.copyWith(
              text: trimmed.isEmpty ? null : trimmed,
              cursor: null,
            ),
          );
    });
  }

  void _onScroll() {
    if (!_scrollController.hasClients) {
      return;
    }
    final position = _scrollController.position;
    // Fetch a screen early so the list never visibly stalls at the bottom.
    if (position.pixels >= position.maxScrollExtent - 600) {
      ref
          .read(searchResultsProvider(ref.read(searchQueryProvider)).notifier)
          .loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(searchQueryProvider);
    final results = ref.watch(searchResultsProvider(query));

    // The query is the provider family's key, so a filter change swaps to a
    // different notifier. The field has to be kept in step when the change
    // came from somewhere else — a category tap on the home screen, say.
    final incomingText = query.text ?? '';
    if (_debounce?.isActive != true && _controller.text != incomingText) {
      _controller.text = incomingText;
    }

    return Scaffold(
      appBar: AppBar(
        titleSpacing: AppSpacing.lg,
        title: _SearchField(
          controller: _controller,
          onChanged: _onTextChanged,
          onClear: () {
            _controller.clear();
            ref.read(searchQueryProvider.notifier).update(
                  (current) => current.copyWith(text: null, cursor: null),
                );
          },
        ),
        actions: [
          _FilterButton(
            count: query.activeFilterCount,
            onTap: () => showFilterSheet(context),
          ),
          const SizedBox(width: AppSpacing.sm),
        ],
      ),
      body: results.when(
        loading: () => ListView.separated(
          padding: const EdgeInsets.all(AppSpacing.lg),
          itemCount: 5,
          separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.md),
          itemBuilder: (_, __) => const ListingCardSkeleton(),
        ),
        error: (_, __) => ErrorView(
          onRetry: () =>
              ref.read(searchResultsProvider(query).notifier).refresh(),
        ),
        data: (page) {
          if (page.items.isEmpty) {
            return EmptyView(
              action: query.isUnfiltered
                  ? null
                  : OutlinedButton(
                      onPressed: () => ref
                          .read(searchQueryProvider.notifier)
                          .state = const ListingQuery(),
                      child: const Text(AppStrings.reset),
                    ),
            );
          }

          return Column(
            children: [
              _ResultBar(count: page.items.length, query: query),
              Expanded(
                child: ListView.separated(
                  controller: _scrollController,
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    AppSpacing.md,
                    AppSpacing.lg,
                    AppSpacing.xl,
                  ),
                  // One extra row carries the "loading more" spinner.
                  itemCount: page.items.length + (page.hasMore ? 1 : 0),
                  separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.md),
                  itemBuilder: (context, index) {
                    if (index >= page.items.length) {
                      return const Padding(
                        padding: EdgeInsets.all(AppSpacing.lg),
                        child: Center(child: CircularProgressIndicator()),
                      );
                    }

                    final listing = page.items[index];
                    return ListingCard(
                      listing: listing,
                      onFavoriteToggle: () =>
                          toggleFavoriteOrSignIn(context, ref, listing),
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => ListingDetailScreen(id: listing.id),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({
    required this.controller,
    required this.onChanged,
    required this.onClear,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: AppSpacing.minTapTarget,
      child: TextField(
        controller: controller,
        onChanged: onChanged,
        textInputAction: TextInputAction.search,
        style: AppTypography.body(size: 15),
        decoration: InputDecoration(
          hintText: AppStrings.searchHint,
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
          prefixIcon: const Icon(Icons.search_rounded, color: AppColors.inkFaint),
          suffixIcon: ValueListenableBuilder<TextEditingValue>(
            valueListenable: controller,
            builder: (context, value, _) {
              if (value.text.isEmpty) {
                return const SizedBox.shrink();
              }
              return IconButton(
                icon: const Icon(Icons.close_rounded, size: 20),
                onPressed: onClear,
                tooltip: AppStrings.reset,
              );
            },
          ),
        ),
      ),
    );
  }
}

class _FilterButton extends StatelessWidget {
  const _FilterButton({required this.count, required this.onTap});

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: AppStrings.filters,
      child: InkResponse(
        onTap: onTap,
        radius: AppSpacing.minTapTarget / 2,
        child: SizedBox(
          width: AppSpacing.minTapTarget,
          height: AppSpacing.minTapTarget,
          child: Stack(
            alignment: Alignment.center,
            children: [
              const Icon(Icons.tune_rounded, color: Colors.white),
              if (count > 0)
                Positioned(
                  top: 6,
                  right: 4,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                    decoration: BoxDecoration(
                      color: AppColors.lime,
                      borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
                    ),
                    child: Text(
                      '$count',
                      style: AppTypography.number(size: 10, color: AppColors.onLime),
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

/// Result count on the left, sort menu on the right.
class _ResultBar extends ConsumerWidget {
  const _ResultBar({required this.count, required this.query});

  final int count;
  final ListingQuery query;

  static const Map<ListingSort, String> _sortLabels = {
    ListingSort.newest: AppStrings.sortNewest,
    ListingSort.priceAsc: AppStrings.sortPriceAsc,
    ListingSort.priceDesc: AppStrings.sortPriceDesc,
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md, AppSpacing.sm, 0),
      child: Row(
        children: [
          Text(
            AppStrings.resultCount(count),
            style: AppTypography.body(size: 13, color: AppColors.inkMuted),
          ),
          const Spacer(),
          PopupMenuButton<ListingSort>(
            initialValue: query.sort,
            tooltip: AppStrings.sortTitle,
            onSelected: (sort) => ref
                .read(searchQueryProvider.notifier)
                .update((current) => current.copyWith(sort: sort, cursor: null)),
            itemBuilder: (context) => [
              for (final entry in _sortLabels.entries)
                PopupMenuItem<ListingSort>(
                  value: entry.key,
                  child: Text(entry.value),
                ),
            ],
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.sm,
                vertical: AppSpacing.md,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _sortLabels[query.sort] ?? AppStrings.sortNewest,
                    style: AppTypography.body(size: 13, weight: FontWeight.w600),
                  ),
                  const Icon(Icons.arrow_drop_down_rounded, size: 20),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
