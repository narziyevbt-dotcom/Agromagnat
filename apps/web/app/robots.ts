import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Private and transactional pages have nothing to index, and crawling
      // them would only burn budget that belongs to listing pages.
      disallow: ['/api/', '/profil', '/sevimlilar', '/joylash', '/kirish', '/xabarlar'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
