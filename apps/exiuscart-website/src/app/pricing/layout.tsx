import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing | Plans from AED 45/month | ExiusCart',
  description: 'ExiusCart pricing plans for UAE small businesses. Monthly plans from AED 45/month. 14-day free trial, no credit card required.',
  openGraph: {
    title: 'ExiusCart Pricing | Plans from AED 45/month',
    description: 'Affordable pricing for UAE small businesses. Monthly or yearly plans. 14-day free trial.',
    url: 'https://exiuscart.com/pricing',
    siteName: 'ExiusCart',
    type: 'website',
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
