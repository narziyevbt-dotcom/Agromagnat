import '../../features/listings/domain/entities/units.dart';

/// Uzbek number, money and date formatting.
///
/// Mirrors `apps/web/lib/format.ts` so a price reads identically in the app
/// and on the website. `intl`'s NumberFormat is not used for money: its uz_UZ
/// locale data groups with a comma, and the convention here is a space.
abstract final class UzFormat {
  /// Thousands are grouped with a non-breaking space: 14 000 so'm.
  ///
  /// The space is U+00A0 on purpose — a regular space lets a price wrap in the
  /// middle of the number when a card is narrow.
  static const String _groupSeparator = ' ';

  static String money(num? value) {
    if (value == null || !value.isFinite) {
      return '—';
    }

    final rounded = value.round().abs();
    final digits = rounded.toString();
    final buffer = StringBuffer(value.isNegative ? '-' : '');

    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) {
        buffer.write(_groupSeparator);
      }
      buffer.write(digits[i]);
    }

    return buffer.toString();
  }

  /// "14 000 so'm/kg" — the form used everywhere a price appears.
  static String price(num? value, PriceUnit unit) {
    if (value == null || !value.isFinite) {
      return '—';
    }
    return "${money(value)} so'm/${unit.label}";
  }

  /// The green chip on every card. Trailing zeros are dropped — "12 t", never
  /// "12.000 t" — and fractions keep at most three digits.
  static String quantity(num? value, QuantityUnit unit) {
    if (value == null || !value.isFinite) {
      return '—';
    }

    final rounded = (value * 1000).round() / 1000;
    final whole = rounded.truncate();

    if (rounded == whole) {
      return '${money(whole)} ${unit.label}';
    }

    // Only the integer part is grouped; a fraction reads as one token.
    final fraction = rounded
        .abs()
        .toStringAsFixed(3)
        .split('.')
        .last
        .replaceFirst(RegExp(r'0+$'), '');

    return '${money(whole)},$fraction ${unit.label}';
  }

  /// Total value of a lot, for the "12 t × 9 000 = 108 000 000 so'm" line.
  static String total(num? value) {
    if (value == null || !value.isFinite) {
      return '—';
    }
    return "${money(value)} so'm";
  }

  /// Relative time in Uzbek. Anything older than a week gets an absolute date,
  /// because "23 kun oldin" is harder to place than "8-iyul".
  static String timeAgo(DateTime? then, {DateTime? now}) {
    if (then == null) {
      return '';
    }

    final reference = now ?? DateTime.now();
    final minutes = reference.difference(then).inMinutes;

    if (minutes < 1) return 'hozirgina';
    if (minutes < 60) return '$minutes daqiqa oldin';

    final hours = minutes ~/ 60;
    if (hours < 24) return '$hours soat oldin';

    final days = hours ~/ 24;
    if (days == 1) return 'kecha';
    if (days < 7) return '$days kun oldin';

    return date(then);
  }

  static const List<String> _months = [
    'yanvar',
    'fevral',
    'mart',
    'aprel',
    'may',
    'iyun',
    'iyul',
    'avgust',
    'sentabr',
    'oktabr',
    'noyabr',
    'dekabr',
  ];

  /// "8-iyul" — the Uzbek ordinal-day form, not "8 iyul".
  static String date(DateTime? value) {
    if (value == null) {
      return '';
    }
    return '${value.day}-${_months[value.month - 1]}';
  }

  /// Days left before a listing auto-expires, or null once it has.
  static int? daysUntil(DateTime? expiresAt, {DateTime? now}) {
    if (expiresAt == null) {
      return null;
    }
    final days = expiresAt.difference(now ?? DateTime.now()).inDays;
    return days < 0 ? null : days;
  }

  /// "+998 90 123 45 67". Anything that is not a 12-digit Uzbek number is
  /// handed back untouched rather than mangled.
  static String phone(String raw) {
    final digits = raw.replaceAll(RegExp(r'\D'), '');
    if (digits.length != 12 || !digits.startsWith('998')) {
      return raw;
    }
    return '+${digits.substring(0, 3)} ${digits.substring(3, 5)} '
        '${digits.substring(5, 8)} ${digits.substring(8, 10)} '
        '${digits.substring(10)}';
  }
}
