import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ExiusCart Affiliates',
  description: 'ExiusCart Affiliate Partner Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
