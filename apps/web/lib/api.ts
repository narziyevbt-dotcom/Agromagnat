import type {
  AdminOverview,
  AssistAnswer,
  AdminPage,
  AdminReport,
  AdminUser,
  AuthTokens,
  Category,
  CategoryFormSpec,
  CategorySuggestion,
  ChatMessage,
  ChatSummary,
  CurrentUser,
  District,
  Listing,
  ListingDraft,
  ListingFilters,
  MessagePage,
  Paginated,
  PriceIndexPoint,
  PriceSuggestion,
  PriceTrend,
  Region,
  ReportReason,
  Review,
  SellerReviews,
  SellerStats,
} from './types';

/**
 * Server-side calls go straight to the backend container; the browser goes
 * through the public URL. Both default to localhost for a fresh checkout.
 */
const SERVER_BASE = process.env.API_URL ?? 'http://localhost:3000/api';
const BROWSER_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

const baseUrl = (): string => (typeof window === 'undefined' ? SERVER_BASE : BROWSER_BASE);

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  token?: string;
  /** Seconds to cache on the server. 0 disables caching. */
  revalidate?: number;
}

/**
 * Pulls the Uzbek message out of a Nest error envelope so the user sees the
 * backend's wording rather than a status code. Nest returns `message` as either
 * a string or an array of validation failures.
 */
function extractMessage(payload: unknown, status: number): string {
  const message = (payload as { message?: unknown } | null)?.message;
  if (typeof message === 'string') {
    return message;
  }
  if (Array.isArray(message) && typeof message[0] === 'string') {
    return message[0];
  }
  return status >= 500
    ? "Serverda xatolik. Birozdan keyin urinib ko'ring"
    : "So'rov bajarilmadi";
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, token, revalidate, headers, ...rest } = options;

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const response = await fetch(`${baseUrl()}${path}`, {
    ...rest,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
    ...(revalidate === undefined
      ? {}
      : revalidate === 0
        ? { cache: 'no-store' as const }
        : { next: { revalidate } }),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(extractMessage(payload, response.status), response.status);
  }

  return payload as T;
}

function toQuery(filters: ListingFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

/* ------------------------------------------------------------------ catalog */

/**
 * Reference data changes about twice a year. An hour of ISR keeps the region
 * picker off the database on every page view.
 */
export const getCategories = () =>
  apiFetch<Category[]>('/categories', { revalidate: 3600 });

export const getRegions = () => apiFetch<Region[]>('/regions', { revalidate: 3600 });

export const getDistricts = (regionId: string) =>
  apiFetch<District[]>(`/regions/${regionId}/districts`, { revalidate: 3600 });

/**
 * The posting form for one category. `getCategories` already carries this on
 * every row, so this is for the narrower case of loading a spec on its own —
 * an edit screen that knows the category and nothing else.
 */
export const getCategoryForm = (idOrSlug: string) =>
  apiFetch<CategoryFormSpec>(`/categories/${idOrSlug}/form`, { revalidate: 3600 });

/* ----------------------------------------------------------------- pricing */

/**
 * Public and cached for ten minutes server-side, so this is safe to call as the
 * seller changes category or unit. No token: the index is an aggregate over
 * listings that are themselves public.
 */
export const getPriceSuggestion = (body: {
  categoryId: string;
  regionId?: string;
  unit: string;
  quantity?: number;
}) =>
  apiFetch<PriceSuggestion>('/pricing/suggest', {
    method: 'POST',
    body,
    revalidate: 0,
  });

export const getPriceHistory = (params: {
  categoryId: string;
  regionId?: string;
  unit?: string;
  days?: number;
}) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  return apiFetch<PriceIndexPoint[]>(`/pricing/history?${search}`, { revalidate: 900 });
};

/* ---------------------------------------------------------------------- ai */

export const aiSuggestCategory = (text: string, token: string) =>
  apiFetch<CategorySuggestion>('/ai/category', {
    method: 'POST',
    body: { text },
    token,
    revalidate: 0,
  });

export const aiDraftListing = (text: string, token: string) =>
  apiFetch<ListingDraft>('/ai/draft', {
    method: 'POST',
    body: { text },
    token,
    revalidate: 0,
  });

export const aiAssist = (
  question: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  token: string,
) =>
  apiFetch<AssistAnswer>('/ai/assist', {
    method: 'POST',
    body: { question, history },
    token,
    revalidate: 0,
  });

/* ----------------------------------------------------------------- listings */

/**
 * The feed is revalidated every 60s to match the backend's own cache window.
 * A personalised request (one carrying a token) must not be cached at all, or
 * one visitor's saved-listing flags would be served to the next.
 */
export const getListings = (filters: ListingFilters = {}, token?: string) =>
  apiFetch<Paginated<Listing>>(`/listings${toQuery(filters)}`, {
    token,
    revalidate: token ? 0 : 60,
  });

export const getListing = (id: string, token?: string) =>
  apiFetch<Listing>(`/listings/${id}`, { token, revalidate: 0 });

export const createListing = (body: unknown, token: string) =>
  apiFetch<Listing>('/listings', { method: 'POST', body, token });

export const updateListing = (id: string, body: unknown, token: string) =>
  apiFetch<Listing>(`/listings/${id}`, { method: 'PATCH', body, token });

export const deleteListing = (id: string, token: string) =>
  apiFetch<void>(`/listings/${id}`, { method: 'DELETE', token });

export const markListingSold = (id: string, token: string) =>
  apiFetch<Listing>(`/listings/${id}/sold`, { method: 'POST', token });

export const uploadListingPhotos = (id: string, files: FormData, token: string) =>
  apiFetch<unknown>(`/listings/${id}/photos`, { method: 'POST', body: files, token });

/** Fire-and-forget: the tel: link must open whether or not this lands. */
export const registerCall = (id: string) =>
  apiFetch<{ callCount: number }>(`/listings/${id}/call`, {
    method: 'POST',
    revalidate: 0,
  }).catch(() => null);

export const getMyListings = (token: string, filters: ListingFilters = {}) =>
  apiFetch<Paginated<Listing>>(`/listings/me${toQuery(filters)}`, {
    token,
    revalidate: 0,
  });

/* ---------------------------------------------------------------- favorites */

export const addFavorite = (id: string, token: string) =>
  apiFetch<void>(`/listings/${id}/favorite`, { method: 'POST', token });

export const removeFavorite = (id: string, token: string) =>
  apiFetch<void>(`/listings/${id}/favorite`, { method: 'DELETE', token });

export const getFavorites = (token: string) =>
  apiFetch<Listing[]>('/me/favorites', { token, revalidate: 0 });

/* -------------------------------------------------------------------- stats */

export const getSellerStats = (token: string) =>
  apiFetch<SellerStats>('/me/stats', { token, revalidate: 0 });

/** Public: medians are aggregate figures, and the landing page renders them. */
export const getPriceTrend = (categories?: string[], regionId?: string) => {
  const params = new URLSearchParams();
  if (categories?.length) params.set('categories', categories.join(','));
  if (regionId) params.set('regionId', regionId);
  const query = params.toString();

  return apiFetch<PriceTrend>(`/stats/price-trend${query ? `?${query}` : ''}`, {
    revalidate: 900,
  });
};

/* --------------------------------------------------------------------- auth */

export const requestOtp = (phone: string) =>
  apiFetch<{ sent: boolean; expiresIn: number }>('/auth/request-otp', {
    method: 'POST',
    body: { phone },
  });

export const verifyOtp = (phone: string, code: string, name?: string) =>
  apiFetch<AuthTokens>('/auth/verify-otp', {
    method: 'POST',
    body: { phone, code, ...(name ? { name } : {}) },
  });

export const refreshTokens = (refreshToken: string) =>
  apiFetch<AuthTokens>('/auth/refresh', { method: 'POST', body: { refreshToken } });

export const logout = (refreshToken: string, token?: string) =>
  apiFetch<void>('/auth/logout', { method: 'POST', body: { refreshToken }, token });

export const getMe = (token: string) =>
  apiFetch<CurrentUser>('/auth/me', { token, revalidate: 0 });

/* -------------------------------------------------------------- reports */

export const reportListing = (
  listingId: string,
  reason: ReportReason,
  comment: string | undefined,
  token: string,
) =>
  apiFetch<unknown>(`/listings/${listingId}/report`, {
    method: 'POST',
    body: { reason, ...(comment ? { comment } : {}) },
    token,
  });

/* ------------------------------------------------------------------ chat */

/** Idempotent: returns the existing conversation about this listing if there is one. */
export const openChat = (listingId: string, token: string) =>
  apiFetch<{ id: string }>(`/listings/${listingId}/chat`, { method: 'POST', token });

export const getChats = (token: string) =>
  apiFetch<ChatSummary[]>('/chats', { token, revalidate: 0 });

export const getChat = (chatId: string, token: string) =>
  apiFetch<ChatSummary>(`/chats/${chatId}`, { token, revalidate: 0 });

export const getMessages = (
  chatId: string,
  token: string,
  params: { cursor?: string; limit?: number } = {},
) => {
  const search = new URLSearchParams();
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.limit) search.set('limit', String(params.limit));
  const query = search.toString();

  return apiFetch<MessagePage>(`/chats/${chatId}/messages${query ? `?${query}` : ''}`, {
    token,
    revalidate: 0,
  });
};

/**
 * The clientId is what makes a retry safe. On a weak connection the request
 * often succeeds while the response is lost; without it, the user's second tap
 * posts the message twice.
 */
export const sendMessage = (chatId: string, body: string, clientId: string, token: string) =>
  apiFetch<ChatMessage>(`/chats/${chatId}/messages`, {
    method: 'POST',
    body: { body, clientId },
    token,
  });

export const markChatRead = (chatId: string, token: string) =>
  apiFetch<{ unread: number }>(`/chats/${chatId}/read`, { method: 'POST', token });

export const getUnreadCount = (token: string) =>
  apiFetch<{ unread: number }>('/chats/unread-count', { token, revalidate: 0 });

/* --------------------------------------------------------------- reviews */

/** Public: a seller's rating is what a buyer checks before calling. */
export const getSellerReviews = (sellerId: string, page = 1) =>
  apiFetch<SellerReviews>(`/sellers/${sellerId}/reviews?page=${page}`, { revalidate: 60 });

export const createReview = (
  listingId: string,
  rating: number,
  comment: string | undefined,
  token: string,
) =>
  apiFetch<Review>(`/listings/${listingId}/review`, {
    method: 'POST',
    body: { rating, ...(comment ? { comment } : {}) },
    token,
  });

export const getMyReview = (listingId: string, token: string) =>
  apiFetch<Review | null>(`/listings/${listingId}/review`, { token, revalidate: 0 });

/* ---------------------------------------------------------------- admin */

const adminQuery = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
};

export const getAdminOverview = (token: string) =>
  apiFetch<AdminOverview>('/admin/stats', { token, revalidate: 0 });

export const getAdminListings = (
  token: string,
  params: { status?: string; q?: string; page?: number } = {},
) =>
  apiFetch<AdminPage<Listing>>(`/admin/listings${adminQuery(params)}`, {
    token,
    revalidate: 0,
  });

export const adminApproveListing = (id: string, token: string) =>
  apiFetch<Listing>(`/admin/listings/${id}/approve`, { method: 'POST', token });

export const adminBlockListing = (id: string, reason: string, token: string) =>
  apiFetch<Listing>(`/admin/listings/${id}/block`, {
    method: 'POST',
    body: { reason },
    token,
  });

export const adminPromoteListing = (id: string, days: number, token: string) =>
  apiFetch<Listing>(`/admin/listings/${id}/promote`, {
    method: 'POST',
    body: { days },
    token,
  });

export const getAdminUsers = (
  token: string,
  params: { q?: string; page?: number } = {},
) => apiFetch<AdminPage<AdminUser>>(`/admin/users${adminQuery(params)}`, { token, revalidate: 0 });

export const adminSetUserVerified = (id: string, value: boolean, token: string) =>
  apiFetch<AdminUser>(`/admin/users/${id}/verify`, { method: 'POST', body: { value }, token });

export const adminSetUserBlocked = (id: string, value: boolean, token: string) =>
  apiFetch<AdminUser>(`/admin/users/${id}/block`, { method: 'POST', body: { value }, token });

export const getAdminReports = (
  token: string,
  params: { status?: string; page?: number } = {},
) =>
  apiFetch<AdminPage<AdminReport>>(`/admin/reports${adminQuery(params)}`, {
    token,
    revalidate: 0,
  });

export const getAdminReviews = (token: string, params: { page?: number } = {}) =>
  apiFetch<AdminPage<Review>>(`/admin/reviews${adminQuery(params)}`, {
    token,
    revalidate: 0,
  });

export const adminHideReview = (id: string, value: boolean, token: string) =>
  apiFetch<Review>(`/admin/reviews/${id}/hide`, { method: 'POST', body: { value }, token });

export const adminResolveReport = (
  id: string,
  outcome: 'resolved' | 'rejected',
  note: string | undefined,
  token: string,
) =>
  apiFetch<AdminReport>(`/admin/reports/${id}/resolve`, {
    method: 'POST',
    body: { outcome, ...(note ? { note } : {}) },
    token,
  });
