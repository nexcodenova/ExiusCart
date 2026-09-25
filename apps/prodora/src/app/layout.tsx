import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import LoginModalProvider from '@/components/providers/LoginModalProvider';

const inter = Inter({ subsets: ['latin'] });

const SITE_URL = 'https://prodora.exiuscart.com';

const SITE_TITLE = 'Prodora — AI Product Sourcing for Ecommerce Sellers';
const SITE_DESCRIPTION = 'Discover, analyze, and import winning products with AI — real supplier pricing, demand signals, and one-click import into your ExiusCart store.';

export const metadata: Metadata = {
  // Without this, the favicon/logo URLs below resolve against whatever host
  // is serving the request instead of the real domain — the exact reason
  // Google wasn't reliably picking up the logo for search results.
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: '%s | Prodora' },
  description: SITE_DESCRIPTION,
  icons: {
    icon: '/prodora-logo.png',
    shortcut: '/prodora-logo.png',
    apple: '/prodora-logo.png',
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  // A child route's own `openGraph`/`twitter` key, if it defines one at all,
  // fully replaces this rather than merging into it (a real Next.js
  // metadata gotcha, confirmed the hard way on the main ExiusCart site) —
  // so only blog/[slug] defines its own (per-article image), everything
  // else inherits this default untouched.
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Prodora',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: 'en_US',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Prodora — AI Product Sourcing for Ecommerce Sellers' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/og-image.png'],
  },
};

// Organization structured data — this is the actual signal Google uses to
// show a brand's logo next to search results (and, over time, in a
// Knowledge Panel for brand-name searches like "Prodora"). The favicon
// alone only controls the small icon next to individual page results;
// this is what ties that icon to "Prodora the brand" specifically.
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Prodora',
  url: SITE_URL,
  logo: `${SITE_URL}/prodora-logo.png`,
  sameAs: ['https://exiuscart.com'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <LoginModalProvider>{children}</LoginModalProvider>
      </body>
    </html>
  );
}
