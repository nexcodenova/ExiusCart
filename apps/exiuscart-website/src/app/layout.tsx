import type { Metadata } from 'next';
import { Inter, Cairo } from 'next/font/google';
import Script from 'next/script';
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
const SITE_TITLE = 'ExiusCart - Smart Multi-Shop Business System';
const SITE_DESCRIPTION =
  'All-in-one POS, inventory & invoicing platform for small businesses worldwide — UAE and international.';

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
  keywords: ['POS', 'Point of Sale', 'UAE', 'Inventory', 'Invoicing', 'worldwide', 'small business'],
  icons: {
    icon: '/logo.svg',
    shortcut: '/logo.svg',
    apple: '/logo.svg',
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
    images: [{ url: '/dashboard.png', width: 1200, height: 630, alt: 'ExiusCart dashboard' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/dashboard.png'],
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
