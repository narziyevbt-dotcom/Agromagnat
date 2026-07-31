import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://agromagnat.uz';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Private and transactional pages have nothing to index, and crawling
      // them would only burn budget that belongs to listing pages.
      disallow: ['/api/', '/profil', '/sevimlilar', '/joylash', '/kirish', '/xabarlar'],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
