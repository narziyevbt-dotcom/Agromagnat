import type {
  AuthTokens,
  Category,
  CurrentUser,
  District,
  Listing,
  ListingFilters,
  Paginated,
  Region,
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
