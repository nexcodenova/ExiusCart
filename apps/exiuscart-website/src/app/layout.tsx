import type { Metadata } from 'next';
import { Inter, Cairo } from 'next/font/google';
import Script from 'next/script';
// Imported before globals.css so Tailwind's own width/height utilities
// (used to size every <CountryFlag>) win the cascade over flag-icons' own
// em-based sizing, which has equal selector specificity. Bundled locally,
// not fetched from a CDN — an earlier version used react-country-flag's
// `svg` mode, which pulls each flag from cdn.jsdelivr.net/gh/lipis/... at
// runtime, a GitHub-raw-proxy path some ad-blockers/DNS filters block,
// silently leaving a broken image with no visible flag at all.
import 'flag-icons/css/flag-icons.min.css';
import './globals.css';
import { Providers } from '@/components/providers';
import { WhatsAppButton } from '@/components/ui/whatsapp-button';
import { ExitIntentPopup } from '@/components/ui/exit-intent-popup';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
});

const SITE_URL = 'https://exiuscart.com';
const SITE_TITLE = 'ExiusCart - All-in-One POS, Inventory & Multichannel Selling Platform';
const SITE_DESCRIPTION =
  'POS, inventory, invoicing, HR, and marketing, connecting every sales channel — plus Prodora product sourcing from verified suppliers. One platform, worldwide, from $14.99/month.';

export const metadata: Metadata = {
  // Without this, every relative image URL in openGraph/twitter below
  // (and on every page that sets its own metadata) resolves against
  // whatever host is currently serving the request instead of the real
  // domain — broken previews on localhost/staging, silently wrong in prod.
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: '%s | ExiusCart',
  },
  description: SITE_DESCRIPTION,
  keywords: [
    'POS', 'Point of Sale', 'Inventory management', 'Invoicing', 'Multichannel selling',
    'Dropshipping', 'Product sourcing', 'E-commerce platform', 'Small business software',
    'Prodora', 'Shopify alternative', 'UAE', 'worldwide',
  ],
  icons: {
    icon: '/logo-ec-square.png',
    shortcut: '/logo-ec-square.png',
    apple: '/logo-ec-square.png',
  },
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'ExiusCart',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: 'en_US',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'ExiusCart — Sell Everywhere. Run Everything.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${inter.className} ${cairo.variable} font-sans`}>
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}');
              `}
            </Script>
          </>
        )}
        <Providers>
          {children}
          <WhatsAppButton />
          <ExitIntentPopup />
        </Providers>
      </body>
    </html>
  );
}
