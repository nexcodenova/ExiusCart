import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import LoginModalProvider from '@/components/providers/LoginModalProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Prodora — Discover Winning Products',
  description: 'Find winning products ready to sell. Powered by ExiusCart.',
  icons: {
    icon: '/logo.svg',
    shortcut: '/logo.svg',
    apple: '/logo.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen`}>
        <LoginModalProvider>{children}</LoginModalProvider>
      </body>
    </html>
  );
}
