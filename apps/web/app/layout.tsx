import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { t } from '@/lib/strings';
import './globals.css';

/**
 * One family, the whole product — headings, body and figures alike.
 *
 * Three faces used to do this job, with a monospace reserved for every number.
 * The monospace is gone: at the sizes the dashboard shows a figure, mono reads
 * as a code listing rather than a headline number. Alignment still matters in
 * price columns, so it is bought with tabular figures instead of a second
 * family — same column-wise alignment, none of the typewriter texture.
 *
 * latin-ext covers the Uzbek Latin alphabet; without it oʻ and gʻ fall back to
 * a different face mid-word.
 */
const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
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
  themeColor: '#0B1D14',
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
      className={`${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
