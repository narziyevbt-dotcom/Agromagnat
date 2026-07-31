import type { MetadataRoute } from 'next';
import { getCategories, getListings } from '@/lib/api';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://agromagnat.uz';

/**
 * Static pages, one entry per category, and the most recent active listings.
 *
 * Listings are capped at 50 for now — the number of active listings is small
 * during the pilot region phase, and a full sitemap index only becomes worth
 * the machinery once the catalogue outgrows a single file.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE, changeFrequency: 'hourly', priority: 1 },
    { url: `${SITE}/qidiruv`, changeFrequency: 'hourly', priority: 0.9 },
  ];

  const [categories, feed] = await Promise.all([
    getCategories().catch(() => []),
    getListings({ limit: 50 }).catch(() => ({ items: [], hasMore: false, nextCursor: null })),
  ]);

  return [
    ...staticPages,
    ...categories.map((category) => ({
      url: `${SITE}/qidiruv?categoryId=${category.id}`,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    ...feed.items.map((listing) => ({
      url: `${SITE}/e/${listing.id}`,
      lastModified: new Date(listing.createdAt),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];
}
