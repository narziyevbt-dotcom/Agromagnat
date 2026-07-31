import 'package:flutter/material.dart';

/// The palette, mirroring `apps/web/app/globals.css` value for value.
///
/// A buyer who found a listing through Google and then installs the app has to
/// recognise it as the same product, so both platforms resolve to one set of
/// hexes. When a colour changes it changes in both files or in neither.
///
/// Green dominates and the accents stay scarce on purpose: lime is the only
/// thing that reads as "press me", and harvest green is only ever money.
abstract final class AppColors {
  // --- Surfaces -----------------------------------------------------------

  /// App background. Warm grey rather than white — photographed produce looks
  /// washed out against a pure white feed.
  static const Color canvas = Color(0xFFECEEEA);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceSoft = Color(0xFFF6F8F5);

  // --- Brand greens -------------------------------------------------------

  /// Primary. Header, bottom bar, dark panels.
  static const Color forest = Color(0xFF0B1D14);
  static const Color forestSoft = Color(0xFF16321F);
  static const Color forestDeep = Color(0xFF061109);

  // --- Money --------------------------------------------------------------

  /// Prices and volumes ONLY, so the user learns "green number = money".
  static const Color harvest = Color(0xFF1F7A4D);
  static const Color harvestBright = Color(0xFF2FA36A);

  /// The fill behind a volume chip.
  static const Color mint = Color(0xFFE7F4EC);

  // --- Call to action -----------------------------------------------------

  /// CTA ONLY. Used anywhere else it stops meaning "press me".
  static const Color lime = Color(0xFFD4E96A);
  static const Color limeDark = Color(0xFFC2DA51);

  /// Sits on lime. Lime is far too light to carry white text — this pairing is
  /// the one that clears WCAG AA, so never substitute white here.
  static const Color onLime = forest;

  // --- Accents ------------------------------------------------------------

  static const Color turquoise = Color(0xFF1D7F8C);

  /// The TOP badge, and nothing else.
  static const Color saffron = Color(0xFFE0932A);
  static const Color saffronDark = Color(0xFFC67D1C);

  /// 12% saffron — the fill behind a TOP badge.
  static const Color saffronSubtle = Color(0x1FE0932A);

  /// Errors and falling prices ONLY.
  static const Color danger = Color(0xFFC4452F);

  // --- Text ---------------------------------------------------------------

  static const Color ink = Color(0xFF0B1D14);
  static const Color inkMuted = Color(0xFF5C6B62);
  static const Color inkFaint = Color(0xFF8B978F);
  static const Color onForest = Color(0xFFFFFFFF);

  // --- Lines --------------------------------------------------------------

  static const Color hairline = Color(0xFFE4E9E4);
}
