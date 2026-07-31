import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/uz_format.dart';
import '../../../core/localization/app_strings.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../auth/presentation/widgets/sign_in_gate.dart';
import '../../listings/domain/entities/location.dart';
import '../../listings/domain/entities/units.dart';
import '../../listings/presentation/listing_detail_screen.dart';
import '../../listings/presentation/providers/listing_providers.dart';
import 'providers/draft_controller.dart';
import 'widgets/attribute_fields.dart';
import 'widgets/measure_field.dart';
import 'widgets/photo_picker_field.dart';
import 'widgets/voice_composer.dart';

/// Posting a listing.
///
/// One long scroll rather than a wizard. A four-step flow looks tidier, but it
/// hides how much is left and turns "go back and fix the volume" into a
/// navigation problem; a farmer standing in a field wants to see the whole
/// thing and fill it in whatever order the answers come to mind.
///
/// Which questions appear is decided entirely by the category's form spec —
/// see docs/CATEGORY-FORMS.md. Nothing in this file knows what a tractor is.
class AddListingScreen extends StatelessWidget {
  const AddListingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.addTitle)),
      // A listing has to belong to a verified phone number, or the marketplace
      // fills with numbers nobody answers.
      body: const SignInGate(
        reason: AppStrings.signInRequiredAdd,
        icon: Icons.add_circle_outline_rounded,
        child: _Form(),
      ),
    );
  }
}

class _Form extends ConsumerWidget {
  const _Form();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(draftControllerProvider);
    final controller = ref.read(draftControllerProvider.notifier);
    final categories = ref.watch(categoriesProvider);

    final draft = state.draft;
    final spec = draft.spec;

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              // Above everything, because one sentence can fill most of what
              // follows — including the category. Entirely skippable.
              const VoiceComposer(),
              const SizedBox(height: AppSpacing.xl),

              const FieldLabel(label: AppStrings.chooseCategory, required: true),
              const SizedBox(height: AppSpacing.sm),
              categories.when(
                loading: () => const _RowSpinner(),
                error: (_, __) => const SizedBox.shrink(),
                data: (all) => Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: [
                    for (final category in all)
                      ChoiceChipButton(
                        label: '${category.emoji ?? ''} ${category.nameUz}'.trim(),
                        selected: category.id == draft.category?.id,
                        onTap: () => controller.setCategory(category),
                      ),
                  ],
                ),
              ),
              if (state.errors['category'] != null)
                _FieldError(state.errors['category']!),

              // Everything below depends on the spec, so it stays hidden until
              // there is one. A volume field with no legal unit to put it in is
              // a question the seller cannot answer yet.
              if (spec != null) ...[
                const SizedBox(height: AppSpacing.xl),
                // Above the title because a listing with a photo is the one
                // buyers call — but optional, because one bar of signal in a
                // field is the common case.
                const PhotoPickerField(),

                const SizedBox(height: AppSpacing.lg),
                _TitleField(
                  key: ValueKey('title-${draft.category!.id}'),
                  initial: draft.title,
                  error: state.errors['title'],
                  onChanged: controller.setTitle,
                ),

                const SizedBox(height: AppSpacing.lg),
                MeasureField(
                  key: ValueKey('quantity-${draft.category!.id}'),
                  spec: spec.quantity,
                  value: draft.quantity,
                  unit: draft.quantityUnit,
                  error: state.errors['quantity'],
                  onValueChanged: controller.setQuantity,
                  onUnitChanged: controller.setQuantityUnit,
                ),

                const SizedBox(height: AppSpacing.lg),
                MeasureField(
                  key: ValueKey('price-${draft.category!.id}'),
                  spec: spec.price,
                  value: draft.price,
                  unit: draft.priceUnit,
                  error: state.errors['price'],
                  onValueChanged: controller.setPrice,
                  onUnitChanged: controller.setPriceUnit,
                ),

                const SizedBox(height: AppSpacing.xl),
                const _SectionTitle(AppStrings.whereFrom),
                const SizedBox(height: AppSpacing.md),
                _LocationFields(state: state, controller: controller),

                if (spec.attributes.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xl),
                  AttributeFields(
                    // Rebuilt from scratch on a category change: the previous
                    // category's answers are gone from the draft, and reusing
                    // the fields would leave their text on screen.
                    key: ValueKey('attributes-${draft.category!.id}'),
                    attributes: spec.attributes,
                    values: draft.attributes,
                    errors: state.errors,
                    onChanged: controller.setAttribute,
                  ),
                ],

                const SizedBox(height: AppSpacing.md),
                const _SectionTitle(AppStrings.extras),
                const SizedBox(height: AppSpacing.md),
                _OptionalFields(
                  key: ValueKey('optional-${draft.category!.id}'),
                  state: state,
                  controller: controller,
                ),

                const SizedBox(height: AppSpacing.lg),
                _DescriptionField(
                  key: ValueKey('description-${draft.category!.id}'),
                  initial: draft.description,
                  onChanged: controller.setDescription,
                ),
              ],

              if (state.failure != null) ...[
                const SizedBox(height: AppSpacing.lg),
                _FieldError(state.failure!),
              ],
              const SizedBox(height: AppSpacing.xxl),
            ],
          ),
        ),
        _SubmitBar(state: state, controller: controller),
      ],
    );
  }
}

class _TitleField extends StatelessWidget {
  const _TitleField({
    required this.initial,
    required this.error,
    required this.onChanged,
    super.key,
  });

  final String initial;
  final String? error;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const FieldLabel(
          label: AppStrings.listingTitle,
          required: true,
          hint: AppStrings.listingTitleHint,
        ),
        const SizedBox(height: AppSpacing.sm),
        TextFormField(
          initialValue: initial,
          maxLength: 120,
          textCapitalization: TextCapitalization.sentences,
          style: AppTypography.body(size: 16),
          decoration: const InputDecoration(
            hintText: AppStrings.listingTitlePlaceholder,
            counterText: '',
          ),
          onChanged: onChanged,
        ),
        if (error != null) _FieldError(error!),
      ],
    );
  }
}

class _DescriptionField extends StatelessWidget {
  const _DescriptionField({
    required this.initial,
    required this.onChanged,
    super.key,
  });

  final String initial;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const FieldLabel(
          label: AppStrings.listingDescription,
          hint: AppStrings.listingDescriptionHint,
        ),
        const SizedBox(height: AppSpacing.sm),
        TextFormField(
          initialValue: initial,
          maxLines: 4,
          maxLength: 2000,
          textCapitalization: TextCapitalization.sentences,
          style: AppTypography.body(size: 15),
          decoration: const InputDecoration(counterText: ''),
          onChanged: onChanged,
        ),
      ],
    );
  }
}

class _LocationFields extends ConsumerWidget {
  const _LocationFields({required this.state, required this.controller});

  final DraftState state;
  final DraftController controller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final regions = ref.watch(regionsProvider);
    final regionId = state.draft.region?.id;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const FieldLabel(label: AppStrings.region, required: true),
        const SizedBox(height: AppSpacing.sm),
        regions.when(
          loading: () => const _RowSpinner(),
          error: (_, __) => const SizedBox.shrink(),
          data: (all) => _ChipWrap<Region>(
            options: all,
            selected: state.draft.region,
            labelOf: (region) => region.nameUz,
            onSelected: controller.setRegion,
          ),
        ),
        if (state.errors['region'] != null) _FieldError(state.errors['region']!),

        if (regionId != null) ...[
          const SizedBox(height: AppSpacing.lg),
          const FieldLabel(label: AppStrings.district, required: true),
          const SizedBox(height: AppSpacing.sm),
          ref.watch(districtsProvider(regionId)).when(
                loading: () => const _RowSpinner(),
                error: (_, __) => const SizedBox.shrink(),
                data: (all) => _ChipWrap<District>(
                  options: all,
                  selected: state.draft.district,
                  labelOf: (district) => district.nameUz,
                  onSelected: controller.setDistrict,
                ),
              ),
          if (state.errors['district'] != null)
            _FieldError(state.errors['district']!),
        ],
      ],
    );
  }
}

/// The optional fields the spec says this kind actually asks for.
///
/// Machinery gets no minimum lot and no picking date; land gets no delivery
/// option. None of that is decided here — the spec's `optional` flags are.
class _OptionalFields extends StatelessWidget {
  const _OptionalFields({
    required this.state,
    required this.controller,
    super.key,
  });

  final DraftState state;
  final DraftController controller;

  @override
  Widget build(BuildContext context) {
    final draft = state.draft;
    final optional = draft.spec!.optional;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (optional.minOrder) ...[
          _NumberField(
            label: AppStrings.minOrder,
            initial: draft.minOrder,
            suffix: draft.quantityUnit?.label,
            error: state.errors['minOrder'],
            onChanged: controller.setMinOrder,
          ),
          const SizedBox(height: AppSpacing.lg),
        ],
        if (optional.wholesalePrice) ...[
          _NumberField(
            label: AppStrings.wholesalePrice,
            initial: draft.wholesalePrice,
            suffix: "so'm",
            onChanged: controller.setWholesalePrice,
          ),
          const SizedBox(height: AppSpacing.lg),
        ],
        if (optional.harvestDate) ...[
          _HarvestDateField(
            value: draft.harvestDate,
            onChanged: controller.setHarvestDate,
          ),
          const SizedBox(height: AppSpacing.lg),
        ],
        if (optional.delivery) ...[
          const FieldLabel(label: AppStrings.delivery),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final option in DeliveryOption.values)
                ChoiceChipButton(
                  label: option.label,
                  selected: option == draft.delivery,
                  onTap: () => controller.setDelivery(option),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _HarvestDateField extends StatelessWidget {
  const _HarvestDateField({required this.value, required this.onChanged});

  final DateTime? value;
  final ValueChanged<DateTime?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const FieldLabel(label: AppStrings.harvestDate),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () async {
                  final now = DateTime.now();
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: value ?? now,
                    // A picking date is either recent or imminent; a year
                    // either side covers both without offering 2031.
                    firstDate: now.subtract(const Duration(days: 365)),
                    lastDate: now.add(const Duration(days: 365)),
                  );
                  if (picked != null) {
                    onChanged(picked);
                  }
                },
                child: Text(
                  value == null ? AppStrings.chooseDate : UzFormat.date(value),
                ),
              ),
            ),
            if (value != null)
              TextButton(
                onPressed: () => onChanged(null),
                child: const Text(AppStrings.clear),
              ),
          ],
        ),
      ],
    );
  }
}

class _NumberField extends StatelessWidget {
  const _NumberField({
    required this.label,
    required this.initial,
    required this.onChanged,
    this.suffix,
    this.error,
  });

  final String label;
  final num? initial;
  final ValueChanged<num?> onChanged;
  final String? suffix;
  final String? error;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldLabel(label: label),
        const SizedBox(height: AppSpacing.sm),
        TextFormField(
          initialValue: initial?.toString() ?? '',
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          style: AppTypography.number(size: 16, color: AppColors.ink),
          decoration: InputDecoration(suffixText: suffix, errorText: error),
          onChanged: (raw) => onChanged(num.tryParse(raw.replaceAll(',', '.'))),
        ),
      ],
    );
  }
}

class _SubmitBar extends ConsumerWidget {
  const _SubmitBar({required this.state, required this.controller});

  final DraftState state;
  final DraftController controller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.hairline)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: ElevatedButton(
            onPressed: state.submitting ? null : () => _submit(context, ref),
            child: state.submitting
                ? Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.onLime,
                        ),
                      ),
                      if (state.draft.photos.isNotEmpty) ...[
                        const SizedBox(width: AppSpacing.md),
                        // Uploading five photos on EDGE is slow enough that a
                        // bare spinner reads as a hang.
                        Text(
                          AppStrings.uploadingPhotos,
                          style: AppTypography.body(
                            size: 14,
                            weight: FontWeight.w600,
                            color: AppColors.onLime,
                          ),
                        ),
                      ],
                    ],
                  )
                : const Text(AppStrings.publish),
          ),
        ),
      ),
    );
  }

  Future<void> _submit(BuildContext context, WidgetRef ref) async {
    final published = await controller.submit();
    if (!context.mounted) {
      return;
    }

    if (!published) {
      // The errors are now on the fields themselves; the snackbar only says
      // that the tap was heard and something above needs attention.
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text(AppStrings.fixErrors)),
      );
      return;
    }

    final result = ref.read(draftControllerProvider);
    // The feed is stale the moment a listing joins it.
    ref.invalidate(homeFeedProvider);

    await _showPublished(context, result.published!.id, result.photoFailure);
  }

  Future<void> _showPublished(
    BuildContext context,
    String id,
    String? photoFailure,
  ) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      isDismissible: false,
      enableDrag: false,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.check_circle_rounded,
                size: 48,
                color: AppColors.harvest,
              ),
              const SizedBox(height: AppSpacing.md),
              Text(AppStrings.published, style: AppTypography.heading(size: 20)),
              const SizedBox(height: AppSpacing.sm),
              Text(
                AppStrings.publishedHint,
                textAlign: TextAlign.center,
                style: AppTypography.body(size: 14, color: AppColors.inkMuted),
              ),
              if (photoFailure != null) ...[
                const SizedBox(height: AppSpacing.md),
                Text(
                  photoFailure,
                  textAlign: TextAlign.center,
                  style: AppTypography.body(size: 13, color: AppColors.danger),
                ),
              ],
              const SizedBox(height: AppSpacing.xl),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.of(sheetContext).pop('view'),
                  child: const Text(AppStrings.viewListing),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              TextButton(
                onPressed: () => Navigator.of(sheetContext).pop('close'),
                child: const Text(AppStrings.navHome),
              ),
            ],
          ),
        ),
      ),
    );

    if (!context.mounted) {
      return;
    }

    // Either way the posting screen closes. It is a full-screen flow pushed
    // over the shell, and leaving a submitted draft on the stack invites a
    // second submit of the same listing.
    final navigator = Navigator.of(context);
    navigator.pop();

    if (action == 'view') {
      await navigator.push(
        MaterialPageRoute<void>(builder: (_) => ListingDetailScreen(id: id)),
      );
    }
  }
}

class _ChipWrap<T> extends StatelessWidget {
  const _ChipWrap({
    required this.options,
    required this.selected,
    required this.labelOf,
    required this.onSelected,
  });

  final List<T> options;
  final T? selected;
  final String Function(T) labelOf;
  final ValueChanged<T> onSelected;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        for (final option in options)
          ChoiceChipButton(
            label: labelOf(option),
            selected: option == selected,
            onTap: () => onSelected(option),
          ),
      ],
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

class _FieldError extends StatelessWidget {
  const _FieldError(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.xs),
      child: Text(
        message,
        style: AppTypography.body(size: 12, color: AppColors.danger),
      ),
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
