import { Injectable } from '@nestjs/common';
import {
  AiService,
  AssistAnswer,
  AssistTurn,
  CategorySuggestion,
  DraftContext,
  ListingDraft,
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
