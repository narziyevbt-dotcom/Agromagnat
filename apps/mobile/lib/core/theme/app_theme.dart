import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_colors.dart';
import 'app_spacing.dart';
import 'app_typography.dart';

/// Assembles the design tokens into a single ThemeData.
///
/// Anything visual comes from here rather than being written inline in a
/// screen — that is what keeps lime confined to calls to action and harvest
/// green to money.
abstract final class AppTheme {
  static ThemeData light() {
    final textTheme = AppTypography.buildTextTheme();

    const colorScheme = ColorScheme.light(
      primary: AppColors.forest,
      onPrimary: AppColors.onForest,
      // Lime is the action colour, and it is light — the "on" pairing has to
      // be forest, never white, or every button label fails contrast.
      secondary: AppColors.lime,
      onSecondary: AppColors.onLime,
      tertiary: AppColors.harvest,
      onTertiary: Colors.white,
      error: AppColors.danger,
      onError: Colors.white,
      surface: AppColors.surface,
      onSurface: AppColors.ink,
      outline: AppColors.hairline,
      outlineVariant: AppColors.hairline,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      fontFamily: AppTypography.family,
      scaffoldBackgroundColor: AppColors.canvas,
      textTheme: textTheme,
      dividerColor: AppColors.hairline,
      splashFactory: InkSparkle.splashFactory,

      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.forest,
        foregroundColor: AppColors.onForest,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: AppTypography.heading(size: 20, color: AppColors.onForest),
        // A dark bar needs light status-bar glyphs above it.
        systemOverlayStyle: SystemUiOverlayStyle.light,
      ),

      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusCard),
        ),
      ),

      // Lime is reserved for calls to action — this is the only place it
      // becomes a fill colour.
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.lime,
          foregroundColor: AppColors.onLime,
          disabledBackgroundColor: AppColors.hairline,
          disabledForegroundColor: AppColors.inkFaint,
          elevation: 0,
          minimumSize: const Size.fromHeight(AppSpacing.primaryButtonHeight),
          textStyle: AppTypography.body(size: 16, weight: FontWeight.w700),
          shape: const StadiumBorder(),
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.forest,
          minimumSize: const Size.fromHeight(AppSpacing.minTapTarget),
          side: const BorderSide(color: AppColors.hairline),
          textStyle: AppTypography.body(size: 15, weight: FontWeight.w600),
          shape: const StadiumBorder(),
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.harvest,
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
        hintStyle: AppTypography.body(size: 15, color: AppColors.inkFaint),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          borderSide: const BorderSide(color: AppColors.hairline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          borderSide: const BorderSide(color: AppColors.hairline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          borderSide: const BorderSide(color: AppColors.harvest, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          borderSide: const BorderSide(color: AppColors.danger),
        ),
      ),

      chipTheme: ChipThemeData(
        backgroundColor: AppColors.surfaceSoft,
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

      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppSpacing.radiusCard),
          ),
        ),
      ),

      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.forest,
        contentTextStyle: AppTypography.body(size: 14, color: Colors.white),
        behavior: SnackBarBehavior.floating,
      ),

      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.harvest,
      ),
    );
  }
}
