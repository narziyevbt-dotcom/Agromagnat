import { Injectable } from '@nestjs/common';
import {
  AiService,
  AssistAnswer,
  AssistTurn,
  CategorySuggestion,
  DraftContext,
  ListingDraft,
  SearchContext,
  SearchIntent,
} from './ai.types';
import { matchCategories, normalizeUz, parseFacts } from './uz-lexicon';

/**
 * The provider that needs nothing: no key, no network, no cost.
 *
 * It is the default in development and in tests, and it is also the fallback
 * the Anthropic provider drops to when the API is unreachable — which on the
 * connections this audience has is not an edge case. A farmer typing
 * "12 tonna pomidor 14 ming so'mdan" gets the right category and a filled
 * quantity out of this file alone.
 */
@Injectable()
export class LocalAiService implements AiService {
  async suggestCategory(text: string, context: DraftContext): Promise<CategorySuggestion> {
    return {
      candidates: this.rank(text, context),
      source: 'keyword',
    };
  }

  async draftListing(text: string, context: DraftContext): Promise<ListingDraft> {
    const [best] = this.rank(text, context);
    const facts = parseFacts(text);
    const spec = best ? context.specFor(best.slug) : null;

    // Only offer a unit the chosen category actually accepts — suggesting
    // kilos for a tractor is exactly the bug this whole spec exists to stop.
    const quantityUnit =
      facts.quantityUnit && spec?.quantity.units.includes(facts.quantityUnit as never)
        ? facts.quantityUnit
        : (spec?.quantity.units[0] ?? null);
    const priceUnit =
      facts.priceUnit && spec?.price.units.includes(facts.priceUnit as never)
        ? facts.priceUnit
        : (quantityUnit ?? spec?.price.units[0] ?? null);

    const missingUz: string[] = [];
    if (!best) missingUz.push('Kategoriyani tanlang');
    if (!facts.quantity) missingUz.push('Hajmni kiriting');
    if (!facts.price) missingUz.push('Narxni kiriting');
    if (!context.regionId) missingUz.push('Viloyat va tumanni tanlang');

    return {
      title: this.titleFrom(text),
      description: text.trim(),
      categoryId: best?.categoryId ?? null,
      categorySlug: best?.slug ?? null,
      quantity: facts.quantity ?? null,
      quantityUnit,
      price: facts.price ?? null,
      priceUnit,
      regionId: context.regionId ?? null,
      districtId: context.districtId ?? null,
      harvestDate: null,
      seasonMonths: [],
      attributes: {},
      missingUz,
      source: 'keyword',
    };
  }

  /**
   * History is ignored here — matching one question against a fixed list has
   * no use for the turns before it. The signature keeps it so the two providers
   * stay swappable.
   */
  async assist(question: string, _history: AssistTurn[] = []): Promise<AssistAnswer> {
    const asked = normalizeUz(question);
    const hit = CANNED.find((entry) => entry.triggers.some((word) => asked.includes(word)));

    return {
      answerUz: hit?.answerUz ?? FALLBACK_ANSWER,
      source: 'canned',
    };
  }

  /**
   * A buyer's sentence, read as filters.
   *
   * "Samarqanddan 5 tonnadan ko'p oq kartoshka, 10 mingdan arzon" contains a
   * region, a volume floor, a category and a price ceiling — every one of which
   * the feed already knows how to filter on. Keyword search throws all of that
   * away and matches four words against a tsvector.
   *
   * Runs before any model call and answers most real queries on its own,
   * because the vocabulary a buyer uses here is small and repetitive.
   */
  async parseSearch(text: string, context: SearchContext): Promise<SearchIntent> {
    const source = normalizeUz(text);
    const consumed: string[] = [];

    const withDelivery = /yetkaz|dostavka|olib kel/.test(source) ? true : null;
    const verifiedOnly = /tasdiqlangan|ishonchli/.test(source) ? true : null;

    // A phrase serves one role. "yetkazib berish" is a multi-word stem of the
    // services category and outscores any single product word, so
    // "arzon pomidor, yetkazib berish bilan" searched services rather than
    // vegetables — even after the ambiguity discount, because the discount
    // applies to both and preserves their order. Since the phrase has already
    // been read as a delivery filter, it must not also claim the category.
    const forCategory = source
      .replace(/yetkazib berish|yetkazib berad\w*|yetkaz\w*|dostavka|olib kel\w*/g, ' ')
      .replace(/tasdiqlangan|ishonchli/g, ' ');

    const [best] = this.rank(forCategory, context);
    // The stems of the category actually chosen, not of whatever matched first.
    // Reading them from a second, independent `matchCategories` call let the
    // two disagree — the category came from one candidate and the consumed
    // words from another, so the product name survived into `leftoverQ`.
    if (best) consumed.push(...best.matched);

    const region = this.matchRegion(source, context.regions);
    // The stem, not the full name: the text says "Samarqanddan" while the row
    // says "Samarqand viloyati", so only the stem is actually present to remove.
    if (region) consumed.push(region.stem);

    // Volume first: "5 tonnadan ko'p" has to be claimed as a volume before the
    // money parser gets a chance to read the 5 as a price.
    const quantityMin = this.parseVolumeFloor(source, consumed);
    const money = this.parseMoneyBounds(source, consumed);
    const sort = /arzon/.test(source)
      ? ('cheapest' as const)
      : /qimmat/.test(source)
        ? ('expensive' as const)
        : null;

    return {
      categoryId: best?.categoryId ?? null,
      categorySlug: best?.slug ?? null,
      regionId: region?.id ?? null,
      regionName: region?.nameUz ?? null,
      priceMin: money.min,
      priceMax: money.max,
      quantityMin,
      withDelivery,
      verifiedOnly,
      sort,
      leftoverQ: this.leftover(source, consumed),
      summaryUz: '',
      source: 'keyword',
    };
  }

  /** Longest region name first, so "Toshkent shahri" beats "Toshkent". */
  private matchRegion(haystack: string, regions: SearchContext['regions']) {
    const found = regions
      .map((region) => {
        const needle = normalizeUz(region.nameUz);
        return { ...region, needle, stem: needle.split(' ')[0] };
      })
      // Region names decline: "Samarqanddan", "Samarqandda". Matching the stem
      // and letting the suffix run is what makes those hit.
      .filter((region) => haystack.includes(region.stem))
      .sort((a, b) => b.needle.length - a.needle.length);
    return found[0] ?? null;
  }

  /**
   * "10 mingdan arzon" is a ceiling, "10 mingdan qimmat" a floor, and
   * "10-15 ming" a range. Which side a number falls on is decided by the word
   * next to it, not by its position.
   */
  private parseMoneyBounds(
    source: string,
    consumed: string[],
  ): { min: number | null; max: number | null } {
    const range = source.match(/(\d[\d\s]*)\s*(?:ming|mln)?\s*[-–]\s*(\d[\d\s]*)\s*(ming|mln)?/);
    if (range) {
      const scale = range[3] === 'mln' ? 1_000_000 : range[3] === 'ming' ? 1_000 : 1;
      consumed.push(range[0]);
      return {
        min: Number(range[1].replace(/\s/g, '')) * scale,
        max: Number(range[2].replace(/\s/g, '')) * scale,
      };
    }

    // A scale or a currency word is required, not optional.
    //
    // Without it "5 tonnadan ko'p" parsed as a price floor of 5 so'm: a bare
    // number next to a comparison word is not a price, and volumes are written
    // in exactly that shape. Money in Uzbek always carries "ming", "mln" or
    // "so'm".
    const bound = source.match(
      /(\d[\d\s]*?)\s*(ming|mln|million|so'm\w*)\s*(dan|gacha)?\s*(arzon|qimmat|kam|ko'p|past|baland)?/,
    );
    if (!bound) return { min: null, max: null };

    // The direction word can trail the match, so look a little past its end.
    const window = source.slice(bound.index ?? 0, (bound.index ?? 0) + bound[0].length + 12);
    if (!/arzon|qimmat|kam|ko'p|past|baland|gacha/.test(window)) {
      return { min: null, max: null };
    }

    const scale = bound[2].startsWith('ming')
      ? 1_000
      : bound[2].startsWith('mln') || bound[2].startsWith('million')
        ? 1_000_000
        : 1;
    const value = Number(bound[1].replace(/\s/g, '')) * scale;
    if (!Number.isFinite(value) || value <= 0) return { min: null, max: null };

    consumed.push(bound[0]);
    const isCeiling = /arzon|kam|past|gacha/.test(window);
    return isCeiling ? { min: null, max: value } : { min: value, max: null };
  }

  /** "5 tonnadan ko'p" — a wholesale floor, not a price. */
  private parseVolumeFloor(source: string, consumed: string[]): number | null {
    const match = source.match(/(\d[\d\s.,]*)\s*(tonna\w*|tn|kg|kilo\w*)\s*(dan)?\s*(ko'p|yuqori|katta|boshlab)/);
    if (!match) return null;

    const raw = Number(match[1].replace(/[\s,]/g, ''));
    if (!Number.isFinite(raw) || raw <= 0) return null;

    consumed.push(match[0]);
    // The feed's quantityMin is in the listing's own unit, and produce is
    // quoted in tonnes far more often than in kilos at this volume.
    return /tonna|tn/.test(match[2]) ? raw : raw / 1000;
  }

  /**
   * What is left after the filters took their words — this still goes to the
   * full-text index, so "oq kartoshka" keeps "oq" once "kartoshka" has become
   * a category.
   */
  private leftover(source: string, consumed: string[]): string | null {
    let rest = source;
    for (const part of consumed) {
      const needle = normalizeUz(part).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Trailing word characters go with it: Uzbek declines, so "samarqanddan"
      // has to disappear when "samarqand" is consumed, or the suffix survives
      // into the query and matches nothing.
      rest = rest.replace(new RegExp(`${needle}\\w*`, 'g'), ' ');
    }
    rest = rest
      .replace(STOPWORDS, ' ')
      .replace(/[^a-z0-9'\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Two letters is a real Uzbek word — "oq" (white) is the commonest
    // qualifier in this market. Only a single stray letter is noise.
    return rest.length >= 2 ? rest.slice(0, 120) : null;
  }

  private rank(text: string, context: DraftContext) {
    const bySlug = new Map(context.categories.map((category) => [category.slug, category]));

    return matchCategories(text)
      .map((match) => {
        const category = bySlug.get(match.slug);
        if (!category) return null;
        return {
          categoryId: category.id,
          slug: category.slug,
          nameUz: category.nameUz,
          confidence: match.confidence,
          matched: match.matched,
          reasonUz: `«${match.matched[0]}» so'zi bo'yicha`,
        };
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
  }

  /**
   * The first clause of what the seller wrote, capped at the title's own limit.
   * Cutting on a word boundary matters more than cutting at exactly 160 — a
   * title ending mid-word reads as broken software.
   */
  private titleFrom(text: string): string {
    const firstClause = text.trim().split(/[.,\n]/)[0].trim() || text.trim();
    if (firstClause.length <= 160) return firstClause.slice(0, 160);

    const cut = firstClause.slice(0, 160);
    const lastSpace = cut.lastIndexOf(' ');
    return lastSpace > 40 ? cut.slice(0, lastSpace) : cut;
  }
}

/**
 * Words that describe the act of searching rather than the thing sought.
 *
 * `leftoverQ` is handed to the full-text index, so anything left here has to be
 * a term that could plausibly appear in a listing title. "traktor sotib olaman"
 * parsed correctly to the machinery category and then returned nothing, because
 * "sotib olaman" went to the index and no advert contains it — the query was
 * understood and answered with an empty market.
 */
const STOPWORDS =
  /\b(dan|gacha|uchun|kerak|kerakmi|bor|bormi|bilan|menga|men|man|topib|toping|bering|beradi|beraman|sotib|sotuvchi|sotuvchidan|sotuvchidan|olaman|olmoqchiman|olmoqchi|izlayapman|qidiryapman|qidiraman|topmoqchiman|xohlayman|ko'p|arzon|qimmat|yetkazib|berish|tasdiqlangan|ishonchli|kim|qayerda|bo'ladi|bo'lsa)\b/g;

const FALLBACK_ANSWER =
  "Bu savolga hozir aniq javob bera olmadim. E'lon joylash bo'yicha yordam kerak bo'lsa, " +
  "«E'lon joylash» tugmasini bosing va shakldagi maydonlarni to'ldiring — " +
  "kategoriya, hajm, narx va manzil majburiy.";

/**
 * Answers to the questions support actually gets, kept here so the assistant is
 * useful with no key configured. The model provider answers everything else.
 */
const CANNED: Array<{ triggers: string[]; answerUz: string }> = [
  {
    triggers: ['qancha', 'pul', 'to\'lov', 'bepul', 'narxi qancha'],
    answerUz:
      "E'lon joylash butunlay bepul. Pul faqat e'lonni TOP'ga chiqarish uchun olinadi, " +
      "u ixtiyoriy.",
  },
  {
    triggers: ['qancha turadi', 'muddat', 'necha kun', 'eskiradi', 'yo\'qoldi'],
    answerUz:
      "Har bir e'lon 14 kun turadi, keyin avtomatik arxivga o'tadi. " +
      "Profilingizdan uni bir bosishda qayta faollashtirsangiz bo'ladi.",
  },
  {
    triggers: ['rasm', 'foto', 'surat'],
    answerUz:
      "Bitta e'longa 5 tagacha rasm qo'shish mumkin. Birinchi rasm muqova bo'ladi — " +
      "u qidiruvda ko'rinadi, shuning uchun eng yaxshisini birinchi qo'ying.",
  },
  {
    triggers: ['xaridor', 'qo\'ng\'iroq', 'aloqa', 'telefon'],
    answerUz:
      "Xaridor e'loningizdagi «Qo'ng'iroq qilish» tugmasi orqali sizga to'g'ridan-to'g'ri " +
      "qo'ng'iroq qiladi yoki «Yozish» orqali xabar yuboradi. Vositachi yo'q.",
  },
  {
    triggers: ['sotildi', 'yopish', 'o\'chirish'],
    answerUz:
      "Mahsulot sotilgach e'lonni «Sotildi» deb belgilang. Shunda xaridorlar sizga " +
      "baho qoldira oladi va reytingingiz o'sadi.",
  },
  {
    triggers: ['tasdiq', 'verifikatsiya', 'ishonchli'],
    answerUz:
      "Tasdiqlangan sotuvchi belgisi ishonchni oshiradi va e'lonlaringiz qidiruvda " +
      "yuqoriroq chiqadi. Tasdiqdan o'tish uchun profilingizni to'ldiring.",
  },
];
