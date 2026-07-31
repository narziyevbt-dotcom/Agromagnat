import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../listings/domain/entities/category_form.dart';
import '../../../listings/domain/entities/units.dart';
import 'attribute_fields.dart';

/// A number plus its unit, drawn from the category's spec.
///
/// Machinery is counted in `dona` and land measured in `ga`, and the spec says
/// so by listing one unit. A select offering a single option looks interactive
/// and is not, so it renders locked instead — the seller can see what the unit
/// is without being invited to change it.
class MeasureField extends StatelessWidget {
  const MeasureField({
    required this.spec,
    required this.value,
    required this.unit,
    required this.onValueChanged,
    required this.onUnitChanged,
    this.error,
    this.required = true,
    super.key,
  });

  final MeasureSpec spec;
  final num? value;
  final QuantityUnit? unit;
  final ValueChanged<num?> onValueChanged;
  final ValueChanged<QuantityUnit> onUnitChanged;
  final String? error;
  final bool required;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldLabel(label: spec.labelUz, required: required, hint: spec.hintUz),
        const SizedBox(height: AppSpacing.sm),
        TextFormField(
          initialValue: value?.toString() ?? '',
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
          ],
          style: AppTypography.number(size: 18, color: AppColors.ink),
          decoration: InputDecoration(
            hintText: spec.placeholder,
            errorText: error,
          ),
          // Uzbek keyboards produce a comma for the decimal separator.
          onChanged: (raw) => onValueChanged(num.tryParse(raw.replaceAll(',', '.'))),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final option in spec.units)
              ChoiceChipButton(
                label: option.label,
                selected: option == unit,
                enabled: !spec.isLocked,
                onTap: () => onUnitChanged(option),
              ),
          ],
        ),
      ],
    );
  }
}
