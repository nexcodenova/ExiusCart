import type { MetadataRoute } from 'next';

const BASE = 'https://exiuscart.com';

const BLOG_SLUGS = [
  'uae-vat-invoicing-guide-small-business',
  'skip-admin-panel-connect-custom-website',
  'thedersi-sellers-manage-orders-exiuscart',
  'pos-vs-cash-register-uae-shops-2026',
  'scale-uae-business-multiple-branches',
  'stop-using-spreadsheets-switch-exiuscart',
  'hr-payroll-small-business-no-hr-team',
  'shopify-woocommerce-sync-exiuscart',
  'best-pos-system-small-business-uae-2025',
  'inventory-management-software-sri-lanka-retailers',
  'exiuscart-vs-zoho-inventory-comparison',
  'all-in-one-business-software-uae-under-aed-100',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE,                                 priority: 1.0, changeFrequency: 'weekly' },
    { url: `${BASE}/pricing`,                    priority: 0.9, changeFrequency: 'monthly' },
    { url: `${BASE}/features`,                   priority: 0.9, changeFrequency: 'monthly' },
    { url: `${BASE}/register`,                   priority: 0.9, changeFrequency: 'monthly' },
    { url: `${BASE}/blog`,                       priority: 0.8, changeFrequency: 'weekly' },
    { url: `${BASE}/about`,                      priority: 0.7, changeFrequency: 'monthly' },
    { url: `${BASE}/contact`,                    priority: 0.7, changeFrequency: 'monthly' },
    { url: `${BASE}/demo`,                       priority: 0.7, changeFrequency: 'monthly' },
    { url: `${BASE}/integrations`,               priority: 0.7, changeFrequency: 'monthly' },
    { url: `${BASE}/affiliate`,                  priority: 0.6, changeFrequency: 'monthly' },
    { url: `${BASE}/industries`,                 priority: 0.6, changeFrequency: 'monthly' },
    { url: `${BASE}/industries/boutique`,        priority: 0.6, changeFrequency: 'monthly' },
    { url: `${BASE}/industries/electronics`,     priority: 0.6, changeFrequency: 'monthly' },
    { url: `${BASE}/industries/grocery`,         priority: 0.6, changeFrequency: 'monthly' },
    { url: `${BASE}/faq`,                        priority: 0.6, changeFrequency: 'monthly' },
    { url: `${BASE}/features/whatsapp-orders`,   priority: 0.6, changeFrequency: 'monthly' },
    { url: `${BASE}/privacy`,                    priority: 0.3, changeFrequency: 'yearly' },
    { url: `${BASE}/terms`,                      priority: 0.3, changeFrequency: 'yearly' },
    { url: `${BASE}/refund-policy`,              priority: 0.3, changeFrequency: 'yearly' },
  ];

  const blogPages: MetadataRoute.Sitemap = BLOG_SLUGS.map((slug) => ({
    url: `${BASE}/blog/${slug}`,
    priority: 0.8,
    changeFrequency: 'monthly' as const,
  }));

  return [...staticPages, ...blogPages];
}
