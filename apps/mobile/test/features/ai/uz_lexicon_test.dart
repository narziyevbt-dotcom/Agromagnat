import 'package:agromagnat/features/ai/data/uz_lexicon.dart';
import 'package:flutter_test/flutter_test.dart';

/// The sentences a seller actually says. Each of these is the whole point of
/// the feature: get them wrong and the form fills itself in with nonsense,
/// which is worse than leaving it empty.
void main() {
  group('the canonical sentence', () {
    test('"12 tonna pomidor, kilosi 14 ming so\'m"', () {
      final facts = parseFacts("12 tonna pomidor, kilosi 14 ming so'm");

      expect(facts.categorySlug, 'sabzavotlar');
      expect(facts.quantity, 12);
      expect(facts.quantityUnit, 't');
      expect(facts.price, 14000);
      expect(facts.priceUnit, 'kg');
    });
  });

  group('money', () {
    test('scales ming and million', () {
      expect(parseFacts("14 ming so'm").price, 14000);
      expect(parseFacts("2 mln so'm").price, 2000000);
      expect(parseFacts("185 million so'm").price, 185000000);
    });

    test('takes any suffix on the currency word', () {
      // "so'mdan", "so'mga", "so'mdir" — all of them turn up.
      expect(parseFacts("9500 so'mdan").price, 9500);
      expect(parseFacts("9500 so'mga").price, 9500);
      expect(parseFacts('9500 sum').price, 9500);
    });

    test('accepts the apostrophe variants a phone keyboard produces', () {
      expect(parseFacts("14 ming so‘m").price, 14000);
      expect(parseFacts("14 ming soʻm").price, 14000);
    });

    test('reads the unit on either side of the amount', () {
      expect(parseFacts("kilosi 14 ming so'm").priceUnit, 'kg');
      expect(parseFacts("14 ming so'm/kg").priceUnit, 'kg');
      expect(parseFacts("tonnasi 4 ming so'm").priceUnit, 't');
    });

    test('never invents a price', () {
      // A plausible price is worse than an empty field.
      expect(parseFacts('12 tonna pomidor').price, isNull);
    });
  });

  group('volume', () {
    test('does not read the price as a volume', () {
      final facts = parseFacts("12 tonna pomidor, kilosi 14 ming so'm");

      // "14" belongs to the money clause. Reading it as a volume is the bug
      // this ordering exists to prevent.
      expect(facts.quantity, 12);
    });

    test('understands the words people say', () {
      expect(parseFacts('500 kilo olma').quantityUnit, 'kg');
      expect(parseFacts('500 kg olma').quantityUnit, 'kg');
      expect(parseFacts('30 tn tarvuz').quantityUnit, 't');
      expect(parseFacts('140 bosh qo‘y').quantityUnit, 'dona');
      expect(parseFacts('4 gektar yer').quantityUnit, 'ga');
    });

    test('handles a decimal', () {
      expect(parseFacts('8.5 tonna uzum').quantity, 8.5);
    });
  });

  group('category', () {
    test('matches a product stem', () {
      expect(parseFacts('pomidor').categorySlug, 'sabzavotlar');
      expect(parseFacts('uzum sotaman').categorySlug, 'mevalar');
      expect(parseFacts('tarvuz bor').categorySlug, 'poliz');
      expect(parseFacts("bug'doy 3-sinf").categorySlug, 'don');
      expect(parseFacts('traktor MTZ-82').categorySlug, 'texnika');
    });

    test('matches through the apostrophe variants', () {
      expect(parseFacts("bug‘doy").categorySlug, 'don');
      expect(parseFacts('bugdoy').categorySlug, 'don');
    });

    test('returns null rather than guessing', () {
      // A wrong category costs the seller more than no category does.
      expect(parseFacts('kakao dukkagi').categorySlug, isNull);
    });
  });

  group('title', () {
    test('takes the first clause without its numbers', () {
      expect(
        parseFacts("12 tonna pomidor, kilosi 14 ming so'm").title,
        'Pomidor',
      );
    });

    test('keeps a descriptive first clause intact', () {
      expect(
        parseFacts('Urgut pomidori gruntda, 12 tonna').title,
        'Urgut pomidori gruntda',
      );
    });

    test('gives up rather than returning a fragment', () {
      expect(parseFacts('12 t').title, isNull);
    });
  });

  group('normalizeUz', () {
    test('folds every apostrophe onto one', () {
      expect(normalizeUz("O‘zbek"), "o'zbek");
      expect(normalizeUz("Oʻzbek"), "o'zbek");
      expect(normalizeUz("O'zbek"), "o'zbek");
    });
  });
}
