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

export const metadata: Metadata = {
  title: 'ExiusCart - Smart Multi-Shop Business System',
  description:
    'UAE-focused POS + Inventory Management Platform for small businesses',
  keywords: ['POS', 'Point of Sale', 'UAE', 'Inventory', 'Invoicing'],
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
      <body className={`${inter.variable} ${cairo.variable} font-sans`}>
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
