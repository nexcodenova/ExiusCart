import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Self-hosted (not next/font/google) — the production server's build step
// can't always reach fonts.googleapis.com, which silently fails the whole
// build. Same file, just bundled locally so the build never depends on
// reaching Google's servers at all.
const inter = localFont({
  src: './fonts/Inter-Variable.woff2',
  weight: '100 900',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Admin Dashboard | ExiusCart',
  description: 'ExiusCart Admin - Manage stores, payments, and subscriptions',
  icons: {
    icon: '/logo.svg',
    shortcut: '/logo.svg',
    apple: '/logo.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>{children}</body>
    </html>
  );
}
