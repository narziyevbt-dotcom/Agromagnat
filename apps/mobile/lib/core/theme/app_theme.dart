import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_colors.dart';
import 'app_spacing.dart';
import 'app_typography.dart';

/// Assembles the design tokens into a single ThemeData.
///
/// Anything visual should come from here rather than being written inline in a
/// screen — that is what keeps saffron confined to CTAs and green to numbers.
abstract final class AppTheme {
  static ThemeData light() {
    final textTheme = AppTypography.buildTextTheme();

    const colorScheme = ColorScheme.light(
      primary: AppColors.cobalt,
      onPrimary: AppColors.onCobalt,
      secondary: AppColors.turquoise,
      onSecondary: Colors.white,
      tertiary: AppColors.saffron,
      onTertiary: Colors.white,
      error: AppColors.error,
      onError: Colors.white,
      surface: AppColors.surface,
      onSurface: AppColors.textPrimary,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: AppColors.background,
      textTheme: textTheme,
      dividerColor: AppColors.divider,
      splashFactory: InkSparkle.splashFactory,

      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.cobalt,
        foregroundColor: AppColors.onCobalt,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: AppTypography.heading(size: 20, color: AppColors.onCobalt),
        systemOverlayStyle: SystemUiOverlayStyle.light,
      ),

      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        ),
      ),

      // Saffron is reserved for calls to action — this is the only place it
      // becomes a fill colour.
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.saffron,
          foregroundColor: Colors.white,
          elevation: 0,
          minimumSize: const Size.fromHeight(AppSpacing.primaryButtonHeight),
          textStyle: AppTypography.body(size: 16, weight: FontWeight.w600),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          ),
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.cobalt,
          minimumSize: const Size.fromHeight(AppSpacing.minTapTarget),
          side: const BorderSide(color: AppColors.divider),
          textStyle: AppTypography.body(size: 15, weight: FontWeight.w600),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          ),
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.turquoise,
          minimumSize: const Size(AppSpacing.minTapTarget, AppSpacing.minTapTarget),
          textStyle: AppTypography.body(size: 15, weight: FontWeight.w600),
        ),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        hintStyle: AppTypography.body(size: 15, color: AppColors.textTertiary),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          borderSide: const BorderSide(color: AppColors.divider),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          borderSide: const BorderSide(color: AppColors.divider),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          borderSide: const BorderSide(color: AppColors.turquoise, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          borderSide: const BorderSide(color: AppColors.error),
        ),
      ),

      chipTheme: ChipThemeData(
        backgroundColor: AppColors.cobaltSubtle,
        labelStyle: AppTypography.body(size: 13, weight: FontWeight.w500),
        side: BorderSide.none,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
        ),
      ),

      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.cobalt,
        unselectedItemColor: AppColors.textTertiary,
        selectedLabelStyle: AppTypography.body(size: 11, weight: FontWeight.w600),
        unselectedLabelStyle: AppTypography.body(size: 11),
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),

      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppSpacing.radiusLg)),
        ),
      ),

      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.cobalt,
        contentTextStyle: AppTypography.body(size: 14, color: Colors.white),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
