/// Spacing, radius and hit-target constants.
///
/// [minTapTarget] is 44 because the audience skews older and often taps with a
/// work-worn thumb — every interactive element must clear it.
abstract final class AppSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;

  static const double radiusSm = 8;
  static const double radiusMd = 12;
  static const double radiusLg = 16;
  static const double radiusPill = 999;

  /// Minimum tap target in logical pixels — a hard rule, never shrink it.
  static const double minTapTarget = 44;

  /// Height of the big saffron CTA at the bottom of the listing detail screen.
  static const double primaryButtonHeight = 56;
}
