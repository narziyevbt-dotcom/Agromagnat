import 'package:agromagnat/core/format/uz_format.dart';
import 'package:agromagnat/features/listings/domain/entities/units.dart';
import 'package:flutter_test/flutter_test.dart';

/// The separator UzFormat groups with. Spelled out here rather than typed
/// literally, because a non-breaking space and a normal one are impossible to
/// tell apart in a diff — and this test exists precisely to pin which one is
/// used.
const String nbsp = ' ';

void main() {
  group('money', () {
    test('groups thousands with a non-breaking space', () {
      expect(UzFormat.money(14000), '14${nbsp}000');
      expect(UzFormat.money(185000000), '185${nbsp}000${nbsp}000');
    });

    test('leaves values under a thousand ungrouped', () {
      expect(UzFormat.money(0), '0');
      expect(UzFormat.money(900), '900');
    });

    test('rounds rather than truncating', () {
      expect(UzFormat.money(9499.6), '9${nbsp}500');
    });

    test('renders nothing usable as an em dash', () {
      expect(UzFormat.money(null), '—');
      expect(UzFormat.money(double.nan), '—');
      expect(UzFormat.money(double.infinity), '—');
    });

    test('keeps the sign on a negative value', () {
      expect(UzFormat.money(-1500), '-1${nbsp}500');
    });
  });

  group('price', () {
    test('reads as amount per unit', () {
      expect(UzFormat.price(9500, QuantityUnit.t), "9${nbsp}500 so'm/t");
      expect(UzFormat.price(78000, QuantityUnit.kg), "78${nbsp}000 so'm/kg");
    });
  });

  group('quantity', () {
    test('drops trailing zeros', () {
      expect(UzFormat.quantity(12, QuantityUnit.t), '12 t');
      expect(UzFormat.quantity(12.0, QuantityUnit.t), '12 t');
    });

    test('keeps a real fraction', () {
      expect(UzFormat.quantity(8.5, QuantityUnit.t), '8,5 t');
      expect(UzFormat.quantity(0.25, QuantityUnit.t), '0,25 t');
    });

    test('groups large whole quantities', () {
      expect(UzFormat.quantity(25000, QuantityUnit.dona), '25${nbsp}000 dona');
    });
  });

  group('timeAgo', () {
    final now = DateTime.utc(2026, 7, 31, 12);

    test('counts minutes, hours and days', () {
      expect(UzFormat.timeAgo(now.subtract(const Duration(seconds: 20)), now: now),
          'hozirgina');
      expect(UzFormat.timeAgo(now.subtract(const Duration(minutes: 5)), now: now),
          '5 daqiqa oldin');
      expect(UzFormat.timeAgo(now.subtract(const Duration(hours: 3)), now: now),
          '3 soat oldin');
      expect(UzFormat.timeAgo(now.subtract(const Duration(days: 1)), now: now),
          'kecha');
      expect(UzFormat.timeAgo(now.subtract(const Duration(days: 3)), now: now),
          '3 kun oldin');
    });

    test('falls back to an absolute date past a week', () {
      // "23 kun oldin" is harder to place than a date, which is the whole
      // reason for the cutoff.
      expect(UzFormat.timeAgo(now.subtract(const Duration(days: 23)), now: now),
          '8-iyul');
    });
  });

  group('phone', () {
    test('formats a 12-digit Uzbek number', () {
      expect(UzFormat.phone('998901234567'), '+998 90 123 45 67');
    });

    test('hands back anything else untouched rather than mangling it', () {
      expect(UzFormat.phone('12345'), '12345');
      expect(UzFormat.phone('+1 202 555 0134'), '+1 202 555 0134');
    });
  });

  group('daysUntil', () {
    final now = DateTime.utc(2026, 7, 31, 12);

    test('counts whole days remaining', () {
      expect(UzFormat.daysUntil(now.add(const Duration(days: 5)), now: now), 5);
    });

    test('returns null once the date has passed', () {
      expect(UzFormat.daysUntil(now.subtract(const Duration(days: 1)), now: now),
          isNull);
      expect(UzFormat.daysUntil(null, now: now), isNull);
    });
  });
}
