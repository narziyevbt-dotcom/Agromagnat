import 'package:flutter/material.dart';

/// The Rishtan-ceramic palette from the brand book.
///
/// The screen is full of fruit and vegetable photography — already green, red
/// and yellow. A green interface would swallow the product; cobalt and
/// turquoise make the photos stand out instead.
abstract final class AppColors {
  /// Primary. Headers, bottom nav, the market-price card.
  static const Color cobalt = Color(0xFF0A3A55);

  /// Secondary. Verified badge, secondary accents.
  static const Color turquoise = Color(0xFF1D7F8C);

  /// CTA ONLY — action buttons and the TOP badge. Used anywhere else it stops
  /// meaning "press me".
  static const Color saffron = Color(0xFFE0932A);

  /// Prices and volumes ONLY, so the user learns "green number = money".
  static const Color harvest = Color(0xFF1F7A4D);

  /// Errors and falling prices ONLY.
  static const Color error = Color(0xFFC4452F);

  /// App background.
  static const Color background = Color(0xFFEEF1F2);

  static const Color surface = Color(0xFFFFFFFF);
  static const Color onCobalt = Color(0xFFFFFFFF);

  // Text ramp, all derived from cobalt so the greys never look muddy next to it.
  static const Color textPrimary = Color(0xFF0A3A55);
  static const Color textSecondary = Color(0xFF5B6B75);
  static const Color textTertiary = Color(0xFF8A97A0);

  static const Color divider = Color(0xFFDCE2E5);

  /// 12% saffron — the fill behind a TOP badge.
  static const Color saffronSubtle = Color(0x1FE0932A);

  /// 12% harvest green — the fill behind a volume chip.
  static const Color harvestSubtle = Color(0x1F1F7A4D);

  /// 10% cobalt — neutral chip fill.
  static const Color cobaltSubtle = Color(0x1A0A3A55);
}
