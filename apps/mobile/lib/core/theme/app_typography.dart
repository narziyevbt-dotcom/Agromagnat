import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

/// The three font roles from the brand book.
///
/// The split is not decorative. Numbers carry the meaning in this app — a
/// farmer scans a column of prices top to bottom — so every price, volume,
/// tonnage and percentage is set in a monospace face where the digits share one
/// width and line up. Prose never uses it; numbers never use anything else.
abstract final class AppTypography {
  /// Bricolage Grotesque — screen titles, card names.
  static TextStyle heading({
    double size = 22,
    FontWeight weight = FontWeight.w700,
    Color color = AppColors.textPrimary,
    double? height,
  }) =>
      GoogleFonts.bricolageGrotesque(
        fontSize: size,
        fontWeight: weight,
        color: color,
        height: height,
      );

  /// IBM Plex Sans — descriptions, buttons, menus.
  static TextStyle body({
    double size = 15,
    FontWeight weight = FontWeight.w400,
    Color color = AppColors.textPrimary,
    double? height,
  }) =>
      GoogleFonts.ibmPlexSans(
        fontSize: size,
        fontWeight: weight,
        color: color,
        height: height,
      );

  /// IBM Plex Mono — ALL numbers, without exception.
  static TextStyle number({
    double size = 18,
    FontWeight weight = FontWeight.w600,
    Color color = AppColors.harvest,
    double? height,
  }) =>
      GoogleFonts.ibmPlexMono(
        fontSize: size,
        fontWeight: weight,
        color: color,
        height: height,
      );

  static TextTheme buildTextTheme() {
    return TextTheme(
      displayLarge: heading(size: 34),
      displayMedium: heading(size: 30),
      displaySmall: heading(size: 26),
      headlineLarge: heading(size: 24),
      headlineMedium: heading(size: 22),
      headlineSmall: heading(size: 20),
      titleLarge: heading(size: 18),
      titleMedium: heading(size: 16),
      titleSmall: heading(size: 14),
      bodyLarge: body(size: 16),
      bodyMedium: body(size: 15),
      bodySmall: body(size: 13, color: AppColors.textSecondary),
      labelLarge: body(size: 15, weight: FontWeight.w600),
      labelMedium: body(size: 13, weight: FontWeight.w500),
      labelSmall: body(size: 12, weight: FontWeight.w500, color: AppColors.textSecondary),
    );
  }
}
