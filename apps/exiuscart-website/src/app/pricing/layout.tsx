import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing | Plans from $14.99/month | ExiusCart',
  description: 'ExiusCart pricing plans for small businesses worldwide. Monthly plans from $14.99/month. Launch is free for 7 days; Growth and Scale start at $1 for your first 7 days. No credit card required to start.',
  openGraph: {
    title: 'ExiusCart Pricing | Plans from $14.99/month',
    description: 'Affordable pricing for businesses worldwide. Monthly or yearly plans. Launch is free for 7 days; Growth and Scale start at $1 for your first 7 days.',
    url: 'https://exiuscart.com/pricing',
    siteName: 'ExiusCart',
    type: 'website',
  },
};

// Structured data so Google can show the real price directly in search
// results (rich snippet) instead of a crawler guessing at a number buried
// in page text — same reason this matters for AI answer engines reading
// the page. Kept here (a server component) since the page itself is a
// client component and can't export raw <script> data safely otherwise.
// Prices must mirror apps/exiuscart-website/src/config/pricing.ts exactly.
const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ExiusCart',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: [
    {
      '@type': 'Offer',
      name: 'Launch',
      price: '14.99',
      priceCurrency: 'USD',
      billingDuration: 'P1M',
      url: 'https://exiuscart.com/pricing',
    },
    {
      '@type': 'Offer',
      name: 'Growth',
      price: '24.99',
      priceCurrency: 'USD',
      billingDuration: 'P1M',
      url: 'https://exiuscart.com/pricing',
    },
    {
      '@type': 'Offer',
      name: 'Scale',
      price: '39.99',
      priceCurrency: 'USD',
      billingDuration: 'P1M',
      url: 'https://exiuscart.com/pricing',
    },
  ],
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {children}
    </>
  );
}
