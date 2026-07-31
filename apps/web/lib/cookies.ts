/**
 * Cookie names, on their own.
 *
 * Separate from `session.ts` because `proxy.ts` needs them and `session.ts`
 * reaches for `next/headers`, which does not exist in the proxy runtime.
 * One constant shared beats two spellings of the same string drifting apart.
 */
export const ACCESS_COOKIE = 'agm_at';
export const REFRESH_COOKIE = 'agm_rt';

export const ACCESS_MAX_AGE = 15 * 60;
export const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;
