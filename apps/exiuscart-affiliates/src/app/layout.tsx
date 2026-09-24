import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ExiusCart Affiliates',
  description: 'ExiusCart Affiliate Partner Dashboard',
  icons: {
    icon: '/logo-ec-square.png',
    shortcut: '/logo-ec-square.png',
    apple: '/logo-ec-square.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
