'use client';

import { useState } from 'react';
import { Code2, Copy, Check, ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react';
import { CopyBox } from '@/components/channels/CopyBox';

const API_BASE = 'https://api.exiuscart.com/api/v1';

// The only endpoints a Custom Website's own code ever needs to call —
// deliberately not the full `/docs` (which mixes in hundreds of internal
// seller-dashboard endpoints). Curated for the developer building the
// storefront, not the seller configuring ExiusCart.
const STOREFRONT_ENDPOINTS = (slug: string) => [
  { method: 'GET', path: `/public/store/${slug}/categories`, desc: 'Category tree' },
  { method: 'GET', path: `/public/store/${slug}/products`, desc: 'Product list — supports ?category=, ?featured=, ?trending=, ?search=. Check product_type ("physical" | "digital" | "affiliate") — for "affiliate", link straight to affiliate_url instead of Add to Cart' },
  { method: 'GET', path: `/public/store/${slug}/products/{slug}`, desc: 'Single product detail — includes rating, view count, units sold, affiliate_url/affiliate_cta_text for affiliate products, faq[], shipping_note, shipping_steps[] (render as an arrow-flow, falling back to shipping_note when empty), seo_keywords[] (use to build your own meta title/description, not a raw <meta keywords> dump) and highlights[] ({icon, label} — icon is a fixed key like "clock"/"mail"/"truck", not affiliate products) if the seller set them' },
  { method: 'GET', path: `/public/store/${slug}/products/{slug}/reviews`, desc: 'Approved reviews for one product' },
  { method: 'POST', path: `/public/store/${slug}/track`, desc: 'Records one real visitor event — body: { event: "view" | "search" | "add_to_cart", product_id?, query? }. Call this on a product page load (view), when someone searches (search), and on Add to Cart (add_to_cart). This is the only source for the Website Traffic chart and the product funnel on your dashboard — nothing shows there until your site actually calls it.' },
  { method: 'POST', path: `/public/store/${slug}/checkout`, desc: 'Create an order + get payment params' },
  { method: 'GET', path: `/public/store/${slug}/orders/{order_number}?email=`, desc: 'Guest order lookup + tracking — status, tracking_number, carrier, shipped_at, estimated_delivery (tracking fields null until the seller marks it shipped)' },
  { method: 'POST', path: `/public/store/${slug}/auth/signup`, desc: 'Create a customer account' },
  { method: 'POST', path: `/public/store/${slug}/auth/login`, desc: 'Log in, returns a token' },
  { method: 'GET', path: `/public/store/${slug}/wallet`, desc: 'Balance + history — needs the token from login' },
  { method: 'GET', path: `/public/download/{token}`, desc: 'Digital product delivery — reveals product/shop name only, for the download page a customer lands on from their delivery email' },
  { method: 'POST', path: `/public/download/{token}/verify`, desc: 'Body: code — verifies the access code, returns the real file_url' },
  { method: 'GET', path: `/public/store/${slug}/blog`, desc: 'Published blog posts — supports ?tag=' },
  { method: 'GET', path: `/public/store/${slug}/blog/{slug}`, desc: 'Single blog post, full content' },
  { method: 'POST', path: `/public/store/${slug}/checkout-started`, desc: 'Body: { email, items[] } — fire this the instant a real email is captured at checkout, before the order is actually submitted. This is what powers Abandoned Cart recovery emails; skip it and abandoned carts never get flagged.' },
];

// These three key off the shop's numeric ID, not its slug — a real
// inconsistency in the API surface (categories/products/checkout all use
// the slug). Documented honestly rather than silently normalized away.
const SHOP_ID_ENDPOINTS = (shopId: string) => [
  { method: 'GET', path: `/public/popups/${shopId}`, desc: 'Active on-site popups (discount code, announcement, exit-intent) — render whichever ones are_active' },
  { method: 'POST', path: `/public/popups/{popup_id}/track?event=impression|click`, desc: 'Call once per popup shown (impression) and once if clicked — powers the popup\'s stats on your dashboard' },
  { method: 'GET', path: `/public/signup-forms/${shopId}`, desc: 'Active embeddable signup/lead forms — each has its own fields[] and delay_seconds before showing' },
  { method: 'POST', path: `/public/signup-forms/{form_id}/track`, desc: 'Call once when a form is shown, to count impressions' },
  { method: 'POST', path: `/public/signup-forms/{form_id}/submit`, desc: 'Body: { answers: { [field_id]: value } } — submits the visitor\'s answers as a lead' },
];

const ORDER_WEBHOOK_EXAMPLE = `{
  "channel_order_id": "your-own-order-id-123",
  "buyer_name": "Jane Doe",
  "buyer_email": "jane@example.com",
  "buyer_phone": "+94771234567",
  "shipping_address": "123 Main St, Colombo, Sri Lanka",
  "items": [
    { "product_id": 42, "quantity": 2, "unit_price": 24.99 }
  ],
  "subtotal": 49.98,
  "total": 49.98,
  "currency": "USD",
  "payment_status": "paid"
}`;

function CodeBlock({ code, id, copied, onCopy }: { code: string; id: string; copied: string | null; onCopy: (text: string, key: string) => void }) {
  return (
    <div className="relative">
      <pre className="bg-muted border border-border rounded-lg p-3.5 text-[11px] text-foreground overflow-x-auto font-mono leading-relaxed">{code}</pre>
      <button onClick={() => onCopy(code, id)} className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-card border border-border text-muted-foreground hover:text-foreground">
        {copied === id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

export default function DeveloperDocs({ slug, shopId, webhookUrl }: { slug: string; shopId: string; webhookUrl: string | null }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-5">
      {/* Security model — corrected a second time. First pass said the API
          key verifies inbound signatures (wrong — the webhook URL's own
          secret does that). Second pass said ExiusCart calls back out to
          push stock updates using the API key (also wrong — checked the
          real code: outbound stock pushes only exist for the TheDersi
          marketplace channel, MARKETPLACE_CHANNELS = {"thedersi"} in
          channels.py, not Custom Website). So today the API key has no
          real usage in ExiusCart's own code at all — it's a value you
          define and can check independently if you build your own
          outbound integration later, not something ExiusCart currently
          sends anywhere. */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">How authentication actually works</p>
            <p className="text-xs text-muted-foreground">Two directions, two different checks</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 bg-muted/50 rounded-lg p-3.5">
            <ArrowRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-foreground">Your site → ExiusCart (creating an order)</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                The webhook URL below has your secret baked into it — that secret <em>is</em> the authentication. Anyone with the URL can create orders on your behalf, so treat it like a password: keep it server-side, never in client-side JS.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-muted/50 rounded-lg p-3.5">
            <ArrowLeft className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-foreground">ExiusCart → your site — not built yet</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Right now ExiusCart never calls back out to your site — no stock push, no order-status push. Your API key is just a value you chose; it isn't checked or sent anywhere by ExiusCart's own code today. Keep an eye on this page — an outbound push (stock/tracking back to your site) is a real, planned feature, not yet live.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Order webhook */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <p className="font-semibold text-foreground text-sm">Sending an order to ExiusCart</p>
          <p className="text-xs text-muted-foreground mt-0.5">Called by your own site's backend the moment a customer completes checkout</p>
        </div>
        <div className="p-5 space-y-4">
          {webhookUrl ? (
            <CopyBox label="POST this to your order webhook URL" value={webhookUrl} />
          ) : (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5">Connect Custom Website above to get your real webhook URL.</p>
          )}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Example request body</p>
            <CodeBlock code={ORDER_WEBHOOK_EXAMPLE} id="webhook-body" copied={copied} onCopy={copy} />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            <code className="text-foreground">items[].product_id</code> must match a real product ID from <code className="text-foreground">GET /public/store/{slug}/products</code>. ExiusCart creates the order, decrements stock once <code className="text-foreground">payment_status</code> is <code className="text-foreground">&quot;paid&quot;</code>, and finds-or-creates the customer by email.
          </p>
        </div>
      </div>

      {/* Storefront endpoints */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Code2 className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm">Public storefront API</p>
            <p className="text-xs text-muted-foreground">No API key needed — hand this to whoever's building your website</p>
          </div>
          <a href="https://exiuscart.com/developers" target="_blank" rel="noopener noreferrer"
            className="shrink-0 text-xs font-medium text-primary hover:text-primary/80 transition whitespace-nowrap">
            Full API docs →
          </a>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Base API URL</p>
              <div className="flex items-center gap-2 bg-muted border border-border rounded-lg px-3 py-2">
                <code className="text-xs text-foreground flex-1 truncate">{API_BASE}</code>
                <button onClick={() => copy(API_BASE, 'base')} className="shrink-0 text-muted-foreground hover:text-foreground">
                  {copied === 'base' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Your shop slug</p>
              <div className="flex items-center gap-2 bg-muted border border-border rounded-lg px-3 py-2">
                <code className="text-xs text-foreground flex-1 truncate">{slug}</code>
                <button onClick={() => copy(slug, 'slug')} className="shrink-0 text-muted-foreground hover:text-foreground">
                  {copied === 'slug' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            {STOREFRONT_ENDPOINTS(slug).map((e) => {
              const full = `${API_BASE}${e.path}`;
              const key = e.method + e.path;
              return (
                <div key={key} className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${e.method === 'GET' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                    {e.method}
                  </span>
                  <div className="min-w-0 flex-1">
                    <code className="text-xs text-foreground block truncate">{full}</code>
                    <p className="text-[11px] text-muted-foreground truncate">{e.desc}</p>
                  </div>
                  <button onClick={() => copy(full, key)} className="shrink-0 text-muted-foreground hover:text-foreground">
                    {copied === key ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Popups & signup forms — only shown once the seller actually has
          one active, since a numeric shop_id with nothing configured
          behind it isn't a useful thing to hand a developer. */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <p className="font-semibold text-foreground text-sm">Popups &amp; signup forms</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Only needed if you've built Popups or Signup Forms in the ExiusCart dashboard. These key off your shop&apos;s numeric ID (<code className="text-foreground">{shopId || '—'}</code>), not the <code className="text-foreground">{slug}</code> slug used everywhere else — an inconsistency in the API, not a typo below.
          </p>
        </div>
        <div className="p-5">
          <div className="space-y-1.5">
            {SHOP_ID_ENDPOINTS(shopId || '{shop_id}').map((e) => {
              const full = `${API_BASE}${e.path}`;
              const key = e.method + e.path;
              return (
                <div key={key} className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${e.method === 'GET' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                    {e.method}
                  </span>
                  <div className="min-w-0 flex-1">
                    <code className="text-xs text-foreground block truncate">{full}</code>
                    <p className="text-[11px] text-muted-foreground truncate">{e.desc}</p>
                  </div>
                  <button onClick={() => copy(full, key)} className="shrink-0 text-muted-foreground hover:text-foreground">
                    {copied === key ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
