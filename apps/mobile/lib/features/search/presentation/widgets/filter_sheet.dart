import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/app_strings.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../listings/domain/entities/location.dart';
import '../../../listings/domain/repositories/listing_repository.dart';
import '../../../listings/presentation/providers/listing_providers.dart';

/// Opens the filter sheet and applies the result.
Future<void> showFilterSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (_) => const FilterSheet(),
  );
}

/// Category, region, district and price range.
///
/// Edits are held locally and only written to [searchQueryProvider] on
/// "Qo'llash". Applying each change as it is made would refetch four times
/// while the user is still deciding — on a slow connection that is four waits
/// and four times the data.
class FilterSheet extends ConsumerStatefulWidget {
  const FilterSheet({super.key});

  @override
  ConsumerState<FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends ConsumerState<FilterSheet> {
  late ListingQuery _draft;
  late final TextEditingController _minPrice;
  late final TextEditingController _maxPrice;

  @override
  void initState() {
    super.initState();
    _draft = ref.read(searchQueryProvider);
    _minPrice = TextEditingController(text: _draft.minPrice?.round().toString() ?? '');
    _maxPrice = TextEditingController(text: _draft.maxPrice?.round().toString() ?? '');
  }

  @override
  void dispose() {
    _minPrice.dispose();
    _maxPrice.dispose();
    super.dispose();
  }

  void _apply() {
    final min = num.tryParse(_minPrice.text.trim());
    final max = num.tryParse(_maxPrice.text.trim());

    ref.read(searchQueryProvider.notifier).state = _draft.copyWith(
      minPrice: min,
      maxPrice: max,
      // Any filter change invalidates the position in the result set.
      cursor: null,
    );
    Navigator.of(context).pop();
  }

  void _reset() {
    setState(() {
      // Text and sort are the user's, not the filter sheet's — clearing the
      // filters must not also throw away what they typed.
      _draft = ListingQuery(text: _draft.text, sort: _draft.sort);
      _minPrice.clear();
      _maxPrice.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(categoriesProvider);
    final regions = ref.watch(regionsProvider);
    final regionId = _draft.regionId;
    final districts = regionId == null
        ? const AsyncValue<List<District>>.data([])
        : ref.watch(districtsProvider(regionId));

    final media = MediaQuery.of(context);

    return SafeArea(
      child: ConstrainedBox(
        // Without a ceiling the sheet grows to its content — 10 categories,
        // 13 viloyats and a price row come to more than a phone screen — and
        // "Qo'llash" ends up below the fold with no way to reach it. Capping
        // it keeps the button pinned and moves the overflow into the list.
        constraints: BoxConstraints(maxHeight: media.size.height * 0.85),
        child: Padding(
          padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const _SheetHandle(),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                child: Row(
                  children: [
                    Text(AppStrings.filters, style: AppTypography.heading(size: 20)),
                    const Spacer(),
                    TextButton(onPressed: _reset, child: const Text(AppStrings.reset)),
                  ],
                ),
              ),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    AppSpacing.md,
                    AppSpacing.lg,
                    AppSpacing.lg,
                  ),
                  children: [
                    _Label(AppStrings.category),
                    categories.when(
                      loading: () => const _RowSpinner(),
                      error: (_, __) => const SizedBox.shrink(),
                      data: (all) => _ChipRow(
                        options: [
                          for (final category in all)
                            _Option(id: category.id, label: category.nameUz),
                        ],
                        selectedId: _draft.categoryId,
                        emptyLabel: AppStrings.anyCategory,
                        onSelected: (id) =>
                            setState(() => _draft = _draft.copyWith(categoryId: id)),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),

                    _Label(AppStrings.region),
                    regions.when(
                      loading: () => const _RowSpinner(),
                      error: (_, __) => const SizedBox.shrink(),
                      data: (all) => _ChipRow(
                        options: [
                          for (final region in all)
                            _Option(id: region.id, label: region.nameUz),
                        ],
                        selectedId: _draft.regionId,
                        emptyLabel: AppStrings.anyRegion,
                        onSelected: (id) => setState(() {
                          // A district only means something inside its region.
                          _draft = _draft.copyWith(regionId: id, districtId: null);
                        }),
                      ),
                    ),

                    if (_draft.regionId != null) ...[
                      const SizedBox(height: AppSpacing.lg),
                      _Label(AppStrings.district),
                      districts.when(
                        loading: () => const _RowSpinner(),
                        error: (_, __) => const SizedBox.shrink(),
                        data: (all) => _ChipRow(
                          options: [
                            for (final district in all)
                              _Option(id: district.id, label: district.nameUz),
                          ],
                          selectedId: _draft.districtId,
                          emptyLabel: AppStrings.anyDistrict,
                          onSelected: (id) =>
                              setState(() => _draft = _draft.copyWith(districtId: id)),
                        ),
                      ),
                    ],

                    const SizedBox(height: AppSpacing.lg),
                    _Label(AppStrings.priceRange),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _minPrice,
                            keyboardType: TextInputType.number,
                            style: AppTypography.number(size: 15, color: AppColors.ink),
                            decoration: const InputDecoration(
                              hintText: AppStrings.priceFrom,
                            ),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: TextField(
                            controller: _maxPrice,
                            keyboardType: TextInputType.number,
                            style: AppTypography.number(size: 15, color: AppColors.ink),
                            decoration: const InputDecoration(
                              hintText: AppStrings.priceTo,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  0,
                  AppSpacing.lg,
                  AppSpacing.lg,
                ),
                child: ElevatedButton(
                  onPressed: _apply,
                  child: const Text(AppStrings.apply),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Option {
  const _Option({required this.id, required this.label});

  final String id;
  final String label;
}

/// Single-select chips that wrap onto as many lines as they need, with a
/// leading "all" chip that clears the filter.
///
/// Wrapped rather than scrolled sideways: there are 13 viloyats and 10
/// categories, and a horizontal row hides most of them behind a gesture people
/// do not think to make. Every option being visible at once is what makes this
/// sheet answerable in one look.
class _ChipRow extends StatelessWidget {
  const _ChipRow({
    required this.options,
    required this.selectedId,
    required this.emptyLabel,
    required this.onSelected,
  });

  final List<_Option> options;
  final String? selectedId;
  final String emptyLabel;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        _Chip(
          label: emptyLabel,
          selected: selectedId == null,
          onTap: () => onSelected(null),
        ),
        for (final option in options)
          _Chip(
            label: option.label,
            selected: option.id == selectedId,
            onTap: () => onSelected(option.id),
          ),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      child: Material(
        color: selected ? AppColors.forest : AppColors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
          child: Container(
            alignment: Alignment.center,
            constraints: const BoxConstraints(minHeight: AppSpacing.minTapTarget),
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
            child: Text(
              label,
              style: AppTypography.body(
                size: 14,
                weight: selected ? FontWeight.w600 : FontWeight.w400,
                color: selected ? Colors.white : AppColors.ink,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Text(text, style: AppTypography.heading(size: 15)),
    );
  }
}

class _RowSpinner extends StatelessWidget {
  const _RowSpinner();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: AppSpacing.minTapTarget,
      child: Align(
        alignment: Alignment.centerLeft,
        child: SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
    );
  }
}

class _SheetHandle extends StatelessWidget {
  const _SheetHandle();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 4,
      margin: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.hairline,
        borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
      ),
    );
  }
}
