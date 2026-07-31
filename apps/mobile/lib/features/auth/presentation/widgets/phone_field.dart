import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';

/// Formats a national Uzbek number as it is typed: 90 123 45 67.
///
/// The country code is not in the field — it is a fixed prefix beside it —
/// because +998 is the only value it can take and asking for it is one more
/// thing to mistype.
class UzPhoneInputFormatter extends TextInputFormatter {
  static const List<int> _groups = [2, 3, 2, 2];

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    final capped = digits.length > 9 ? digits.substring(0, 9) : digits;

    final buffer = StringBuffer();
    var index = 0;
    for (final size in _groups) {
      if (index >= capped.length) {
        break;
      }
      if (index > 0) {
        buffer.write(' ');
      }
      final end = (index + size).clamp(0, capped.length);
      buffer.write(capped.substring(index, end));
      index = end;
    }

    final text = buffer.toString();
    return TextEditingValue(
      text: text,
      // Always at the end: this formatter only ever appends separators, and
      // recomputing an interior offset would fight the user's cursor.
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}

class PhoneField extends StatelessWidget {
  const PhoneField({
    required this.controller,
    this.onChanged,
    this.onSubmitted,
    this.errorText,
    this.enabled = true,
    super.key,
  });

  final TextEditingController controller;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final String? errorText;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      enabled: enabled,
      autofocus: true,
      keyboardType: TextInputType.phone,
      textInputAction: TextInputAction.done,
      inputFormatters: [UzPhoneInputFormatter()],
      onChanged: onChanged,
      onSubmitted: onSubmitted,
      // Tabular figures so the groups do not shift width as digits land.
      style: AppTypography.number(size: 20, color: AppColors.ink),
      decoration: InputDecoration(
        hintText: '90 123 45 67',
        errorText: errorText,
        prefixIcon: Padding(
          padding: const EdgeInsets.only(
            left: AppSpacing.lg,
            right: AppSpacing.sm,
          ),
          child: Text(
            '+998',
            style: AppTypography.number(size: 20, color: AppColors.inkMuted),
          ),
        ),
        prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.lg,
        ),
      ),
    );
  }
}
