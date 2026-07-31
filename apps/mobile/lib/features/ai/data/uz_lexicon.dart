/// Pulls a category, a volume and a price out of one Uzbek sentence.
///
/// A Dart mirror of the backend's `uz-lexicon.ts`, which is what the `local`
/// AI provider runs. It exists on the client for one reason: the audience is
/// on connections that drop, and a feature that only works when the network is
/// up is a feature that does not work in a field.
///
/// Not a stub. It handles the sentence people actually say:
///
///     "12 tonna pomidor, kilosi 14 ming so'm"
///       → sabzavotlar, 12 t, 14 000 so'm/kg
library;

/// Category slug for a product stem. Trimmed from the backend's ~120 to the
/// crops that carry the market — the rest fall through to no suggestion, which
/// leaves the seller picking a category rather than being told a wrong one.
const Map<String, List<String>> _categoryStems = {
  'sabzavotlar': [
    'pomidor', 'bodring', 'kartoshka', 'sabzi', 'piyoz', 'karam', 'qalampir',
    'baqlajon', 'sarimsoq', 'lavlagi', 'turp', 'sholg',
  ],
  'mevalar': [
    'olma', 'uzum', 'anor', 'shaftoli', 'nok', 'behi', 'olcha', 'gilos',
    'o‘rik', 'orik', 'xurmo', 'anjir', 'limon', 'banan',
  ],
  'poliz': ['tarvuz', 'qovun', 'qovoq', 'gulobi'],
  'don': ['bug‘doy', 'bugdoy', 'arpa', 'makkajo', 'sholi', 'guruch', 'mosh', 'loviya', 'no‘xat', 'noxat'],
  'quruq-mevalar': ['mayiz', 'bodom', 'yong‘oq', 'yongoq', 'pista', 'turshak', 'kishmish', 'mag‘iz', 'magiz'],
  'kokatlar': ['ko‘kat', 'kokat', 'jambil', 'rayhon', 'shivit', 'kashnich', 'petrushka'],
  'chorva': ['qo‘y', 'qoy', 'qo‘chqor', 'sigir', 'buzoq', 'echki', 'tovuq', 'ot ', 'mol '],
  'urug-kochat': ['urug', 'ko‘chat', 'kochat', 'nihol'],
  'texnika': ['traktor', 'kombayn', 'plug', 'kultivator', 'seyalka', 'mtz', 'nasos'],
  'xizmatlar': ['xizmat', 'haydash', 'tashish', 'purkash', 'yig‘ish'],
  'yer': ['yer ', 'gektar yer', 'maydon', 'ijaraga yer'],
};

/// Unit words as people say them, in the order they are tried. Longer forms
/// first so "tonna" is not eaten by "t".
const List<(String, String)> _unitWords = [
  ('tonna', 't'),
  ('tn', 't'),
  ('kilogramm', 'kg'),
  ('kilo', 'kg'),
  ('kg', 'kg'),
  ('dona', 'dona'),
  ('tup', 'dona'),
  ('bosh', 'dona'),
  ('quti', 'quti'),
  ('yashik', 'quti'),
  ('qop', 'qop'),
  ('litr', 'l'),
  ('gektar', 'ga'),
  ('ga ', 'ga'),
];

/// What a sentence gave up.
class ParsedFacts {
  const ParsedFacts({
    this.categorySlug,
    this.quantity,
    this.quantityUnit,
    this.price,
    this.priceUnit,
    this.title,
  });

  final String? categorySlug;
  final num? quantity;
  final String? quantityUnit;
  final num? price;
  final String? priceUnit;
  final String? title;
}

/// Folds the Latin-Uzbek variants people type into one form.
///
/// `o‘`, `o'`, `oʻ` and `o` are the same letter as far as matching goes, and a
/// farmer typing on a phone keyboard produces all four.
String normalizeUz(String input) {
  return input
      .toLowerCase()
      .replaceAll(RegExp(r'[‘’ʻʼ`´]'), "'")
      .replaceAll('ʼ', "'")
      .trim();
}

/// Strips the apostrophes entirely, for stem matching only.
String _flatten(String input) => normalizeUz(input).replaceAll("'", '');

ParsedFacts parseFacts(String text) {
  final source = normalizeUz(text);
  final flat = _flatten(text);

  num? price;
  String? priceUnit;
  int priceStart = -1;
  int priceEnd = -1;

  // Money first, so its number is never also read as a volume. The currency
  // word takes any suffix — "so'mdan", "so'mga", "so'mdir".
  final priceMatch = RegExp(
    r"(\d[\d\s.,]*?)\s*(ming|mln|million)?\s*(so'm|som|sum)\w*",
  ).firstMatch(source);

  if (priceMatch != null) {
    final scale = switch (priceMatch.group(2)) {
      final String s when s.startsWith('ming') => 1000,
      final String _ => 1000000,
      null => 1,
    };
    final value = num.tryParse(
      priceMatch.group(1)!.replaceAll(RegExp(r'[\s,]'), ''),
    );

    if (value != null && value > 0) {
      price = value * scale;
      priceStart = priceMatch.start;
      priceEnd = priceMatch.end;

      // "kilosi 14 ming so'm" / "14 ming so'm/kg" — the unit sits either side.
      final around = source.substring(
        (priceStart - 20).clamp(0, source.length),
        (priceEnd + 12).clamp(0, source.length),
      );
      for (final (word, unit) in _unitWords) {
        if (around.contains(word) || around.contains('/$unit')) {
          priceUnit = unit;
          break;
        }
      }
    }
  }

  // Volume next, skipping whatever the price consumed.
  num? quantity;
  String? quantityUnit;

  for (final match in RegExp(r'(\d[\d\s.,]*)\s*([a-z‘’]+)').allMatches(source)) {
    if (priceStart >= 0 && match.start >= priceStart && match.start < priceEnd) {
      continue;
    }
    final word = match.group(2)!;
    final unit = _unitWords
        .where((entry) => word.startsWith(entry.$1.trim()))
        .map((entry) => entry.$2)
        .firstOrNull;
    if (unit == null) {
      continue;
    }

    final value = num.tryParse(
      match.group(1)!.replaceAll(RegExp(r'[\s,]'), '').replaceAll(',', '.'),
    );
    if (value != null && value > 0) {
      quantity = value;
      quantityUnit = unit;
      break;
    }
  }

  return ParsedFacts(
    categorySlug: matchCategory(flat),
    quantity: quantity,
    quantityUnit: quantityUnit,
    price: price,
    priceUnit: priceUnit ?? quantityUnit,
    title: _titleFrom(text),
  );
}

/// The first category whose stem appears. Null when nothing matches — a wrong
/// category costs the seller more than no category does.
String? matchCategory(String flattened) {
  for (final entry in _categoryStems.entries) {
    for (final stem in entry.value) {
      if (flattened.contains(_flatten(stem))) {
        return entry.key;
      }
    }
  }
  return null;
}

/// A title from the sentence: the first clause, trimmed of numbers.
///
/// Better than the whole sentence, which would put the price in the headline,
/// and better than nothing, which leaves the seller retyping what they just
/// said.
String? _titleFrom(String text) {
  final firstClause = text.split(RegExp(r'[,.;\n]')).first.trim();
  if (firstClause.isEmpty) {
    return null;
  }

  final words = firstClause
      .split(RegExp(r'\s+'))
      .where((word) => !RegExp(r'^\d').hasMatch(word))
      .where((word) => !_unitWords.any((entry) => word.toLowerCase() == entry.$1.trim()))
      .toList();

  final title = words.join(' ').trim();
  if (title.length < 3) {
    return null;
  }

  return title[0].toUpperCase() + title.substring(1);
}
