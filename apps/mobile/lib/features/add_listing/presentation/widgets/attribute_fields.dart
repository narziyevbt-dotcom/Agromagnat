import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../listings/domain/entities/category_form.dart';

/// Draws whatever the spec asks for.
///
/// It knows how to render a select, a number and a text box, and nothing about
/// what a tractor is. Adding a question is a backend change that reaches this
/// screen on the next API deploy rather than the next store review — which is
/// the whole reason the form is described by the server instead of written out
/// per category here.
class AttributeFields extends StatelessWidget {
  const AttributeFields({
    required this.attributes,
    required this.values,
    required this.errors,
    required this.onChanged,
    super.key,
  });

  final List<AttributeDef> attributes;
  final Map<String, Object> values;
  final Map<String, String> errors;
  final void Function(String key, Object? value) onChanged;

  @override
  Widget build(BuildContext context) {
    if (attributes.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final attribute in attributes)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.lg),
            child: _AttributeField(
              attribute: attribute,
              value: values[attribute.key],
              error: errors[attribute.key],
              onChanged: (value) => onChanged(attribute.key, value),
            ),
          ),
      ],
    );
  }
}

class _AttributeField extends StatelessWidget {
  const _AttributeField({
    required this.attribute,
    required this.value,
    required this.error,
    required this.onChanged,
  });

  final AttributeDef attribute;
  final Object? value;
  final String? error;
  final ValueChanged<Object?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldLabel(label: attribute.labelUz, required: attribute.required),
        const SizedBox(height: AppSpacing.sm),
        switch (attribute.type) {
          AttributeType.select => _Select(
              attribute: attribute,
              value: value as String?,
              onChanged: onChanged,
            ),
          AttributeType.number => _NumberBox(
              attribute: attribute,
              value: value as num?,
              onChanged: onChanged,
            ),
          AttributeType.text => _TextBox(
              attribute: attribute,
              value: value as String?,
              onChanged: onChanged,
            ),
        },
        if (error != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            error!,
            style: AppTypography.body(size: 12, color: AppColors.danger),
          ),
        ],
      ],
    );
  }
}

/// Chips rather than a dropdown.
///
/// Every option list here is short, and a chip row shows all of them at once
/// on a screen held at arm's length in a field — a dropdown hides them behind
/// a tap and a scroll.
class _Select extends StatelessWidget {
  const _Select({
    required this.attribute,
    required this.value,
    required this.onChanged,
  });

  final AttributeDef attribute;
  final String? value;
  final ValueChanged<Object?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        for (final option in attribute.options)
          ChoiceChipButton(
            label: option.labelUz,
            selected: option.value == value,
            // Tapping the chosen option again clears it, unless the spec says
            // the question must be answered.
            onTap: () => onChanged(
              option.value == value && !attribute.required ? null : option.value,
            ),
          ),
      ],
    );
  }
}

class _NumberBox extends StatelessWidget {
  const _NumberBox({
    required this.attribute,
    required this.value,
    required this.onChanged,
  });

  final AttributeDef attribute;
  final num? value;
  final ValueChanged<Object?> onChanged;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      initialValue: value?.toString() ?? '',
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
      ],
      style: AppTypography.number(size: 16, color: AppColors.ink),
      decoration: InputDecoration(
        hintText: attribute.placeholderUz,
        suffixText: attribute.suffixUz,
        helperText: _rangeHint(attribute),
      ),
      onChanged: (raw) {
        // Uzbek keyboards produce a comma for the decimal separator.
        final parsed = num.tryParse(raw.replaceAll(',', '.'));
        onChanged(parsed);
      },
    );
  }

  /// Says the bounds up front. Finding out a year has to be after 1950 by
  /// having the form rejected is a wasted round trip on a slow connection.
  static String? _rangeHint(AttributeDef attribute) {
    if (attribute.min == null && attribute.max == null) {
      return null;
    }
    if (attribute.min != null && attribute.max != null) {
      return '${attribute.min} – ${attribute.max}';
    }
    return attribute.min != null
        ? '${attribute.min} dan'
        : '${attribute.max} gacha';
  }
}

class _TextBox extends StatelessWidget {
  const _TextBox({
    required this.attribute,
    required this.value,
    required this.onChanged,
  });

  final AttributeDef attribute;
  final String? value;
  final ValueChanged<Object?> onChanged;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      initialValue: value ?? '',
      maxLength: attribute.maxLength,
      style: AppTypography.body(size: 16),
      decoration: InputDecoration(
        hintText: attribute.placeholderUz,
        counterText: '',
      ),
      onChanged: (raw) => onChanged(raw.trim().isEmpty ? null : raw),
    );
  }
}

/// A field label with the required marker, used by the whole posting form.
class FieldLabel extends StatelessWidget {
  const FieldLabel({
    required this.label,
    this.required = false,
    this.hint,
    super.key,
  });

  final String label;
  final bool required;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(label, style: AppTypography.heading(size: 15)),
            if (required)
              Text(
                ' *',
                style: AppTypography.heading(size: 15, color: AppColors.danger),
              ),
          ],
        ),
        if (hint != null) ...[
          const SizedBox(height: 2),
          Text(
            hint!,
            style: AppTypography.body(size: 12, color: AppColors.inkMuted),
          ),
        ],
      ],
    );
  }
}

/// A pill that is either chosen or not. Shared by the attribute selects, the
/// unit picker and the delivery options so they cannot drift apart.
class ChoiceChipButton extends StatelessWidget {
  const ChoiceChipButton({
    required this.label,
    required this.selected,
    required this.onTap,
    this.enabled = true,
    super.key,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final background = selected
        ? (enabled ? AppColors.forest : AppColors.hairline)
        : AppColors.surfaceSoft;

    return Semantics(
      button: true,
      selected: selected,
      enabled: enabled,
      child: Material(
        color: background,
        borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
        child: InkWell(
          onTap: enabled ? onTap : null,
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
                color: selected
                    ? (enabled ? Colors.white : AppColors.inkMuted)
                    : AppColors.ink,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
