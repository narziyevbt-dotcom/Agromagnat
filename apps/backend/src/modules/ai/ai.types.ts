import { CategoryFormSpec } from '../catalog/category-forms';

/**
 * The contract every AI provider implements. Injected by token so the mock and
 * the Anthropic-backed provider are interchangeable, and so a future provider
 * (a locally hosted model, say — user data has to stay in Uzbekistan) is a new
 * class rather than a rewrite of the callers.
 */
export const AI_SERVICE = Symbol('AI_SERVICE');

export interface CategoryCandidate {
  categoryId: string;
  slug: string;
  nameUz: string;
  /** 0-1. The UI auto-selects above 0.75 and merely suggests below it. */
  confidence: number;
  /** One short Uzbek line explaining the pick. */
  reasonUz?: string;
}

export interface CategorySuggestion {
  candidates: CategoryCandidate[];
  /** Which pass answered — useful in logs when a suggestion looks wrong. */
  source: 'keyword' | 'model';
}

/** Everything the posting form can be pre-filled with. */
export interface ListingDraft {
  title: string;
  description: string;
  categoryId: string | null;
  categorySlug: string | null;
  quantity: number | null;
  quantityUnit: string | null;
  price: number | null;
  priceUnit: string | null;
  regionId: string | null;
  districtId: string | null;
  harvestDate: string | null;
  seasonMonths: number[];
  attributes: Record<string, string | number>;
  /** Uzbek notes on what the seller still has to fill in by hand. */
  missingUz: string[];
  source: 'keyword' | 'model';
}

export interface DraftContext {
  /** Every category, so the provider can only ever return a real id. */
  categories: Array<{ id: string; slug: string; nameUz: string }>;
  /** The spec the draft has to satisfy once a category is chosen. */
  specFor: (slug: string) => CategoryFormSpec | null;
  /** The seller's saved location, used when the text does not name one. */
  regionId?: string | null;
  districtId?: string | null;
}

/**
 * A search query understood as filters rather than as keywords.
 *
 * Everything is optional: the parser fills what the sentence actually said and
 * leaves the rest alone. `leftoverQ` carries the words that were not consumed
 * by a filter, so they still reach the full-text index — "oq kartoshka" keeps
 * "oq" as a term after "kartoshka" resolves to a category.
 */
export interface SearchIntent {
  categoryId: string | null;
  categorySlug: string | null;
  regionId: string | null;
  regionName: string | null;
  priceMin: number | null;
  priceMax: number | null;
  quantityMin: number | null;
  withDelivery: boolean | null;
  verifiedOnly: boolean | null;
  sort: 'newest' | 'cheapest' | 'expensive' | null;
  leftoverQ: string | null;
  /** One Uzbek line telling the searcher what was understood. */
  summaryUz: string;
  source: 'keyword' | 'model';
}

export interface SearchContext extends DraftContext {
  regions: Array<{ id: string; slug: string; nameUz: string }>;
}

export interface AssistTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistAnswer {
  answerUz: string;
  source: 'canned' | 'model';
}

export interface AiService {
  /** Free text ("12 tonna pomidor") to a ranked set of categories. */
  suggestCategory(text: string, context: DraftContext): Promise<CategorySuggestion>;

  /** Free text or a voice transcript to a complete posting-form draft. */
  draftListing(text: string, context: DraftContext): Promise<ListingDraft>;

  /** Answers a seller's question about using Agromagnat, in Uzbek. */
  assist(question: string, history: AssistTurn[]): Promise<AssistAnswer>;

  /** A sentence a buyer would say, turned into the feed's own filters. */
  parseSearch(text: string, context: SearchContext): Promise<SearchIntent>;
}
