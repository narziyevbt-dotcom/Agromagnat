import 'package:flutter/material.dart';

import 'app_colors.dart';

/// One family for the whole product — headings, prose and figures alike.
///
/// Three faces used to do this job, with IBM Plex Mono reserved for every
/// number. The monospace is gone: at the size a price is actually shown, mono
/// reads as a code listing rather than a headline figure. Column-wise
/// alignment still matters when a buyer scans a list of prices, so it is
/// bought with tabular figures instead of a second family — same alignment,
/// none of the typewriter texture. [number] is what turns them on.
///
/// The face is a variable font, so weight is set through [FontVariation]
/// rather than by shipping eight static files. `fontWeight` is passed too: it
/// is what Flutter's layout and accessibility tooling read, and it keeps the
/// fallback face weighted correctly if the asset ever fails to load.
abstract final class AppTypography {
  static const String family = 'PlusJakartaSans';

  /// Digits share one advance width, so prices line up down a column.
  static const FontFeature _tabular = FontFeature.tabularFigures();

  static TextStyle _base({
    required double size,
    required FontWeight weight,
    required Color color,
    double? height,
    double? letterSpacing,
    List<FontFeature>? features,
  }) {
    return TextStyle(
      fontFamily: family,
      fontSize: size,
      fontWeight: weight,
      fontVariations: [FontVariation('wght', weight.value.toDouble())],
      color: color,
      height: height,
      letterSpacing: letterSpacing,
      fontFeatures: features,
    );
  }

  /// Screen titles and card names. Tracking tightens as the size grows.
  static TextStyle heading({
    double size = 22,
    FontWeight weight = FontWeight.w700,
    Color color = AppColors.ink,
    double? height,
  }) =>
      _base(
        size: size,
        weight: weight,
        color: color,
        height: height ?? 1.15,
        letterSpacing: size >= 24 ? -0.5 : -0.2,
      );

  /// Descriptions, buttons, menus — everything that is prose.
  static TextStyle body({
    double size = 15,
    FontWeight weight = FontWeight.w400,
    Color color = AppColors.ink,
    double? height,
  }) =>
      _base(size: size, weight: weight, color: color, height: height ?? 1.4);

  /// EVERY number the user reads: prices, volumes, distances, counts.
  ///
  /// Defaults to harvest green because most numbers in this app are money.
  /// Pass an explicit colour for the ones that are not.
  static TextStyle number({
    double size = 18,
    FontWeight weight = FontWeight.w700,
    Color color = AppColors.harvest,
    double? height,
  }) =>
      _base(
        size: size,
        weight: weight,
        color: color,
        height: height ?? 1.2,
        letterSpacing: -0.2,
        features: const [_tabular],
      );

  static TextTheme buildTextTheme() {
    return TextTheme(
      displayLarge: heading(size: 34, weight: FontWeight.w800),
      displayMedium: heading(size: 30, weight: FontWeight.w800),
      displaySmall: heading(size: 26),
      headlineLarge: heading(size: 24),
      headlineMedium: heading(size: 22),
      headlineSmall: heading(size: 20),
      titleLarge: heading(size: 18),
      titleMedium: heading(size: 16),
      titleSmall: heading(size: 14),
      bodyLarge: body(size: 16),
      bodyMedium: body(size: 15),
      bodySmall: body(size: 13, color: AppColors.inkMuted),
      labelLarge: body(size: 15, weight: FontWeight.w600),
      labelMedium: body(size: 13, weight: FontWeight.w500),
      labelSmall: body(size: 12, weight: FontWeight.w500, color: AppColors.inkMuted),
    );
  }
}
