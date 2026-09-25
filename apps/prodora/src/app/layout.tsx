import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import LoginModalProvider from '@/components/providers/LoginModalProvider';

const inter = Inter({ subsets: ['latin'] });

const SITE_URL = 'https://prodora.exiuscart.com';

export const metadata: Metadata = {
  // Without this, the favicon/logo URLs below resolve against whatever host
  // is serving the request instead of the real domain — the exact reason
  // Google wasn't reliably picking up the logo for search results.
  metadataBase: new URL(SITE_URL),
  title: 'Prodora — AI Product Sourcing for Ecommerce Sellers',
  description: 'Discover, analyze, and import winning products with AI — real supplier pricing, demand signals, and one-click import into your ExiusCart store.',
  icons: {
    icon: '/prodora-logo.png',
    shortcut: '/prodora-logo.png',
    apple: '/prodora-logo.png',
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
