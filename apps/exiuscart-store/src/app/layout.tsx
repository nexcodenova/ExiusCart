import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
// Imported before globals.css so Tailwind's own width/height utilities
// (used to size every <CountryFlag>) win the cascade over flag-icons' own
// em-based sizing, which has equal selector specificity. Bundled locally,
// not fetched from a CDN — an earlier version used react-country-flag's
// `svg` mode, which pulls each flag from cdn.jsdelivr.net/gh/lipis/... at
// runtime, a GitHub-raw-proxy path some ad-blockers/DNS filters block,
// silently leaving a broken image with no visible flag at all.
import 'flag-icons/css/flag-icons.min.css';
import './globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';

// Self-hosted (not next/font/google) — the production server's build step
// can't always reach fonts.googleapis.com, which silently fails the whole
// build. These are the same Inter/Cairo files, just bundled locally so the
// build never depends on reaching Google's servers at all.
const inter = localFont({
  src: './fonts/Inter-Variable.woff2',
  weight: '100 900',
  variable: '--font-inter',
});

const cairo = localFont({
  src: './fonts/Cairo-Variable.ttf',
  weight: '200 1000',
  variable: '--font-cairo',
});

export const metadata: Metadata = {
  title: 'Shop Dashboard | ExiusCart',
  description: 'Manage your shop with ExiusCart - POS, Inventory, Orders',
  manifest: '/manifest.json',
  icons: {
    icon: '/logo.svg',
    shortcut: '/logo.svg',
    apple: '/logo.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ExiusCart',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1121' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="no-transitions">
      <body className={`${inter.variable} ${cairo.variable} font-sans`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
