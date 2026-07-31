/**
 * Uzbek product words mapped to category slugs, and the small parser that
 * reads a quantity and a price out of a sentence a farmer would actually type.
 *
 * This exists so category suggestion works with no model behind it. Two
 * reasons, both practical: the audience is on connections that drop, and a
 * round trip to a model costs money on every keystroke-debounced request. The
 * local pass answers the common cases instantly and for nothing, and the model
 * is asked only when the local pass is unsure — which is also what makes the
 * mock provider a real feature rather than a test stub.
 */

/** Latin Uzbek is written with several apostrophes; fold them to one. */
export function normalizeUz(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʻʼ`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Word stems per category. Stems, not whole words, because Uzbek is
 * agglutinative — "pomidor", "pomidorim", "pomidorlar" and "pomidorni" all have
 * to hit, and a suffix list would be longer and less accurate than a prefix
 * match on the stem.
 */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  mevalar: [
    'olma', 'nok', 'shaftoli', "o'rik", 'gilos', 'olcha', 'uzum', 'anor', 'anjir',
    'behi', 'tut', 'qulupnay', 'malina', 'limon', 'apelsin', 'mandarin', 'xurmo',
    'meva', 'nashvati', 'olxo\'ri', 'olcha',
  ],
  sabzavotlar: [
    'pomidor', 'bodring', 'kartoshka', 'sabzi', 'piyoz', 'karam', 'bulg\'or',
    'qalampir', 'baqlajon', 'sarimsoq', 'turp', 'sholg\'om', 'rediska', 'qovoq',
    'sabzavot', 'lavlagi', 'brokkoli',
  ],
  poliz: ['tarvuz', 'qovun', 'poliz', 'handalak'],
  'quruq-meva': [
    'mayiz', 'turshak', 'kishmish', 'bodom', "yong'oq", 'pista', 'danak',
    'quruq meva', 'quritilgan', 'qoqi',
  ],
  'don-va-dukkak': [
    "bug'doy", 'arpa', "makkajo'xori", 'sholi', 'guruch', "no'xat", 'loviya',
    'mosh', 'kunjut', 'kungaboqar', 'soya', 'don', 'dukkak', 'urug\'lik don',
  ],
  kokatlar: [
    'kashnich', 'jambil', 'rayhon', 'shivit', 'ukrop', 'ismaloq', "ko'k piyoz",
    "ko'kat", 'petrushka', 'sedana',
  ],
  'urug-va-kochat': ["urug'", "ko'chat", 'nihol', 'ekin materiali', 'payvand'],
  'ogit-va-kimyo': [
    "o'g'it", 'selitra', 'ammofos', 'karbamid', 'gerbitsid', 'pestitsid',
    'fungitsid', 'kimyo', 'dorilash dori', 'go\'ng', 'biohumus',
  ],
  texnika: [
    'traktor', 'kombayn', 'plug', 'mola', 'seyalka', 'kultivator', 'motoblok',
    'pritsep', 'nasos', 'texnika', 'mtz', 'john deere', 'agregat', 'diskator',
    'purkagich', 'suv nasosi', 'dvigatel',
  ],
  'chorva-ozuqasi': [
    'ozuqa', 'kepak', 'silos', 'beda', 'xashak', 'somon', 'kunjara', 'jom',
    'yem', 'komboyem', 'chorva ozuq',
  ],
  xizmatlar: [
    'xizmat', 'haydab beraman', 'tashib beraman', 'yetkazib berish', 'transport',
    'yuk mashina', 'dorilash xizmat', "o'rim", 'ijaraga beraman traktor', 'shudgor',
  ],
  yer: ['yer', 'maydon', 'gektar yer', 'uchastka', 'tomorqa', 'fermer xo\'jaligi yeri'],
};

export interface KeywordMatch {
  slug: string;
  /** 0-1. Rises with how many stems matched and how specific they were. */
  confidence: number;
  /** The words that produced the match, for the "why this category" line. */
  matched: string[];
}

/**
 * Ranks categories by keyword overlap. Returns at most three, best first, and
 * an empty array when nothing matched — an empty result is the signal to ask
 * the model rather than to guess.
 */
export function matchCategories(text: string): KeywordMatch[] {
  const haystack = normalizeUz(text);
  if (haystack.length < 2) return [];

  const scored: KeywordMatch[] = [];

  for (const [slug, stems] of Object.entries(CATEGORY_KEYWORDS)) {
    const matched: string[] = [];
    let score = 0;

    for (const stem of stems) {
      const needle = normalizeUz(stem);
      if (!haystack.includes(needle)) continue;

      matched.push(stem);
      // A multi-word phrase ("yuk mashina") is far more telling than a short
      // stem that could be part of another word, so it scores higher.
      score += needle.includes(' ') ? 3 : needle.length >= 5 ? 2 : 1;
    }

    if (matched.length) {
      scored.push({ slug, matched, confidence: Math.min(1, score / 4) });
    }
  }

  scored.sort((a, b) => b.confidence - a.confidence);

  // A clear winner should not look like a coin toss next to a weak runner-up.
  if (scored.length > 1 && scored[0].confidence > scored[1].confidence) {
    scored[0].confidence = Math.min(1, scored[0].confidence + 0.15);
  }

  return scored.slice(0, 3);
}

export interface ParsedFacts {
  quantity?: number;
  quantityUnit?: string;
  price?: number;
  priceUnit?: string;
}

/**
 * Unit words with a trailing `\w*`, because Uzbek declines them: a price is
 * quoted as "kilosi 14 ming", a volume as "tonnadan". Matching the bare stem
 * would miss every real sentence. The one-letter forms stay anchored — an
 * unanchored `t` would fire on any word starting with one.
 */
const UNIT_WORDS: Array<[RegExp, string]> = [
  [/\b(tonna\w*|tn)\b|\bt\b/, 't'],
  [/\b(kilogramm\w*|kilo\w*|kg)\b/, 'kg'],
  [/\b(dona\w*|shtuk\w*)\b/, 'dona'],
  [/\b(quti\w*|yashik\w*)\b/, 'quti'],
  [/\b(qop\w*|meshok\w*)\b/, 'qop'],
  [/\b(litr\w*)\b|\bl\b/, 'l'],
  [/\b(gektar\w*)\b|\bga\b/, 'ga'],
];

/**
 * Pulls a volume and a price out of free text.
 *
 * Uzbek writes prices as "14 ming so'm" and "1 mln", and writes them next to
 * the unit they are per — "kilosi 14 ming". The two are told apart by which
 * side of the sentence carries a currency word, not by which number came
 * first, because "12 tonna pomidor 14 ming so'mdan" and "14 mingdan 12 tonna
 * pomidor" both occur.
 */
export function parseFacts(text: string): ParsedFacts {
  const source = normalizeUz(text);
  const facts: ParsedFacts = {};

  // Money first, so its number is not also read as a volume.
  // The currency word takes any suffix too — "so'mdan", "so'mga", "so'mdir".
  const priceMatch = source.match(
    /(\d[\d\s.,]*?)\s*(ming|mln|million)?\s*(so'm|som|sum)\w*/,
  );
  let priceSpan: [number, number] | null = null;

  if (priceMatch) {
    const scale = priceMatch[2]?.startsWith('ming')
      ? 1_000
      : priceMatch[2]
        ? 1_000_000
        : 1;
    const value = Number(priceMatch[1].replace(/[\s,]/g, '')) * scale;
    if (Number.isFinite(value) && value > 0) {
      facts.price = value;
      priceSpan = [priceMatch.index ?? 0, (priceMatch.index ?? 0) + priceMatch[0].length];
    }

    // "kilosi 14 ming so'm" / "14 ming so'm/kg" — the unit sits either side.
    const around = source.slice(
      Math.max(0, (priceMatch.index ?? 0) - 20),
      (priceMatch.index ?? 0) + priceMatch[0].length + 12,
    );
    for (const [pattern, unit] of UNIT_WORDS) {
      if (pattern.test(around) || around.includes(`/${unit}`)) {
        facts.priceUnit = unit;
        break;
      }
    }
  }

  // Volume: the first number followed by a unit word that is not inside the
  // price phrase we just consumed.
  const volume = [...source.matchAll(/(\d[\d\s.,]*)\s*([a-z'’]+)/g)].find((match) => {
    const at = match.index ?? 0;
    if (priceSpan && at >= priceSpan[0] && at < priceSpan[1]) return false;
    return UNIT_WORDS.some(([pattern]) => pattern.test(` ${match[2]} `));
  });

  if (volume) {
    const value = Number(volume[1].replace(/[\s,]/g, '').replace(',', '.'));
    if (Number.isFinite(value) && value > 0) {
      facts.quantity = value;
      const hit = UNIT_WORDS.find(([pattern]) => pattern.test(` ${volume[2]} `));
      if (hit) facts.quantityUnit = hit[1];
    }
  }

  return facts;
}
