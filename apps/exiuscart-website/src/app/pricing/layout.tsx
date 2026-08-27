import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing | Plans from $12/month | ExiusCart',
  description: 'ExiusCart pricing plans for small businesses worldwide. Monthly plans from $12/month. 14-day free trial, no credit card required.',
  openGraph: {
    title: 'ExiusCart Pricing | Plans from $12/month',
    description: 'Affordable pricing for businesses worldwide. Monthly or yearly plans. 14-day free trial.',
    url: 'https://exiuscart.com/pricing',
    siteName: 'ExiusCart',
    type: 'website',
  },
};

// Structured data so Google can show the real $12/$29 price directly in
// search results (rich snippet) instead of a crawler guessing at a number
// buried in page text — same reason this matters for AI answer engines
// reading the page. Kept here (a server component) since the page itself
// is a client component and can't export raw <script> data safely otherwise.
const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ExiusCart',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: [
    {
      '@type': 'Offer',
      name: 'Starter',
      price: '12',
      priceCurrency: 'USD',
      billingDuration: 'P1M',
      url: 'https://exiuscart.com/pricing',
    },
    {
      '@type': 'Offer',
      name: 'Premium',
      price: '29',
      priceCurrency: 'USD',
      billingDuration: 'P1M',
      url: 'https://exiuscart.com/pricing',
    },
    {
      '@type': 'Offer',
      name: 'Free Trial',
      price: '0',
      priceCurrency: 'USD',
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
