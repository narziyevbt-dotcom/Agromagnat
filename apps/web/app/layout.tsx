import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { t } from '@/lib/strings';
import './globals.css';

// The three font roles from the brand book. latin-ext covers the Uzbek Latin
// alphabet — without it, oʻ and gʻ fall back to a different face mid-word.
const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin', 'latin-ext'],
  weight: ['600', '700', '800'],
  display: 'swap',
});

const plexSans = IBM_Plex_Sans({
  variable: '--font-plex-sans',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: `${t.brand} — ${t.tagline}`,
    template: `%s · ${t.brand}`,
  },
  description:
    "O'zbekiston bo'ylab fermer mahsulotlari bozori. Meva, sabzavot, poliz, don — vositachisiz, to'g'ridan-to'g'ri fermerdan.",
  keywords: ['agro bozor', 'fermer', 'hosil', 'ulgurji', "o'zbekiston", 'meva sabzavot'],
  openGraph: {
    type: 'website',
    locale: 'uz_UZ',
    siteName: t.brand,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0A3A55',
  width: 'device-width',
  initialScale: 1,
};

/**
 * Root layout carries only the document, fonts and metadata. Chrome belongs to
 * the route groups: (site) has the header and footer, /dashboard has a sidebar.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="uz"
      className={`${bricolage.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
