import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'API Reference — ExiusCart Developers',
  description: 'Every public endpoint for building a Custom Website storefront on ExiusCart — no login required to read this page or call these endpoints.',
};

type Auth = 'none' | 'customer' | 'optional' | 'webhook';

interface Endpoint {
  method: 'GET' | 'POST';
  path: string;
  auth: Auth;
  purpose: string;
  params?: string;
  response?: string;
  note?: string;
}

interface Section {
  id: string;
  title: string;
  description?: string;
  endpoints: Endpoint[];
  note?: string;
}

const BASE_URL = 'https://api.exiuscart.com/api/v1';

const sections: Section[] = [
  {
    id: 'categories',
    title: 'Categories',
    description: 'Your storefront’s category tree, for nav menus and category pages.',
    endpoints: [
      {
        method: 'GET', path: '/public/store/{shop_slug}/categories', auth: 'none',
        purpose: 'Storefront category tree, for nav/grid display.',
        params: 'Query: channel (default "custom")',
        response: '[{ id, name, slug, icon_url, parent_id }]',
      },
    ],
  },
  {
    id: 'products',
    title: 'Products',
    description: 'Listing, detail, and reviews for products you’ve enabled on your Custom Website channel. A product only appears here once the seller has explicitly turned it on for this channel — nothing shows by default.',
    endpoints: [
      {
        method: 'GET', path: '/public/store/{shop_slug}/products', auth: 'none',
        purpose: 'Product listing for a grid/search page.',
        params: 'Query: search, featured, trending, category (slug)',
        response: 'Array of products: id, name, slug, description, currency, price, compare_at_price, in_stock, product_type, affiliate_url, affiliate_cta_text, faq[] ({question, answer}), shipping_note, quantity, images[], video_url, videos[], tags[], variants[], category_id, category_slug, category_ids[], category_slugs[], quantity_tiers[], avg_rating, review_count, view_count, units_sold, custom_fields',
      },
      {
        method: 'GET', path: '/public/store/{shop_slug}/products/{slug}', auth: 'none',
        purpose: 'Single product detail page (PDP). Increments the product’s view count on each call.',
        response: 'Same shape as the listing, single object. category_ids/category_slugs carry every category the product belongs to — a product can be filed under more than one. product_type is "physical" | "digital" | "affiliate" — for "affiliate", render affiliate_cta_text (fallback "Buy Now") as a link straight to affiliate_url instead of an Add to Cart button; the checkout endpoint below rejects affiliate products server-side if one is submitted anyway. faq is an optional seller-written Q&A list to render below the description; shipping_note is an optional free-text shipping/returns blurb (physical products only) — both render only when non-empty, no fallback copy.',
      },
      {
        method: 'GET', path: '/public/store/{shop_slug}/products/{slug}/reviews', auth: 'none',
        purpose: 'Approved reviews for one product.',
        response: '[{ id, customer_name, rating, comment, photo_url, submitted_at }]',
      },
      {
        method: 'GET', path: '/public/product/{barcode}', auth: 'none',
        purpose: 'Product + active reservations lookup for a QR/barcode page. Not shop_slug-scoped.',
        response: 'name, sku, barcode, price, currency, stock, reserved, available, shop_name, image_url, category, reservations[]',
      },
    ],
  },
  {
    id: 'reviews',
    title: 'Reviews',
    description: 'Submitting a review from a post-delivery email link, and the embeddable review widget.',
    endpoints: [
      {
        method: 'GET', path: '/public/review/{token}', auth: 'none',
        purpose: 'Review-request landing page data, from the link in a post-delivery email.',
        response: 'product_name, product_image, shop_name, customer_name, already_submitted, rating, comment',
      },
      {
        method: 'POST', path: '/public/review/{token}/submit', auth: 'none',
        purpose: 'Submit a review via the request-link token.',
        params: 'Body: rating (1–5), comment?, photo_url?',
        response: '{ submitted: true }',
      },
      {
        method: 'POST', path: '/public/review/{token}/photo', auth: 'none',
        purpose: 'Upload a photo for that review.',
        params: 'multipart file (≤ 8MB, jpg/jpeg/png/webp)',
        response: '{ url }',
      },
      {
        method: 'GET', path: '/public/products/{product_id}/reviews', auth: 'none',
        purpose: 'Approved reviews for the embeddable widget, by raw product id.',
        response: '{ avg_rating, count, reviews: [{ customer_name, rating, comment, photo_url, submitted_at }] }',
      },
      {
        method: 'GET', path: '/widget/reviews.js', auth: 'none',
        purpose: 'Static embeddable script — drop it in and it auto-mounts any element with data-exiuscart-reviews.',
      },
    ],
  },
  {
    id: 'customer-auth',
    title: 'Customer Auth',
    description: 'Signup/login for shoppers on your storefront. Returns a customer JWT (type: "customer") that’s only valid on the customer-scoped endpoints below — it’s a different token type than a seller session and can’t be used to access the ExiusCart dashboard.',
    endpoints: [
      {
        method: 'POST', path: '/public/store/{shop_slug}/auth/signup', auth: 'none',
        purpose: 'Create a storefront customer account.',
        params: 'Body: name, email, password (min 8 chars)',
        response: '{ token, customer: { id, name, email } }',
      },
      {
        method: 'POST', path: '/public/store/{shop_slug}/auth/login', auth: 'none',
        purpose: 'Log an existing customer in.',
        params: 'Body: email, password',
        response: '{ token, customer: { id, name, email } }',
      },
    ],
    note: 'Send the token as Authorization: Bearer <token> on any endpoint below marked "customer" or "optional".',
  },
  {
    id: 'checkout',
    title: 'Checkout & Orders',
    description: 'Placing an order, guest or logged-in, and tracking it afterward.',
    endpoints: [
      {
        method: 'POST', path: '/public/store/{shop_slug}/checkout', auth: 'optional',
        purpose: 'Create a pending order and get back the payment gateway’s request parameters. Works for a guest (just name/email) or a logged-in customer. Stock is validated here but not yet decremented — that happens once payment is confirmed.',
        params: 'Body: items [{ product_id, quantity, variant_id? }], name, email, phone?, shipping_address?, use_wallet_amount? (logged-in only), return_url? / cancel_url? (Stripe & PayPal)',
        response: '{ order_number, total, payment: { gateway, order_id, ...gateway-specific fields — see Payment below } }',
      },
      {
        method: 'GET', path: '/public/store/{shop_slug}/orders/{order_number}', auth: 'none',
        purpose: 'Guest order lookup/tracking — matched by order number + the email it was placed with.',
        params: 'Query: email (required)',
        response: '{ order_number, status, payment_status, total, items: [{ product_name, quantity, unit_price, total_price, variant_size, variant_color }], created_at }',
      },
      {
        method: 'GET', path: '/public/store/{shop_slug}/payment-return/paypal', auth: 'none',
        purpose: 'PayPal redirects the shopper back here after approval; this captures the payment server-to-server, then redirects onward to your site.',
        params: 'Query: order_number, redirect_to, token (PayPal order id)',
        response: '302 redirect to {redirect_to}?payment=success|failed&order_number=...',
      },
    ],
  },
  {
    id: 'payment',
    title: 'Payment',
    description: 'PayHere, Stripe, and PayPal are all supported. The gateway is configured per-seller in their ExiusCart dashboard; checkout’s response tells you which one is active and what to do with it.',
    endpoints: [
      {
        method: 'POST', path: '/public/payment-webhook/{shop_slug}', auth: 'webhook',
        purpose: 'Server-to-server only — the payment gateway calls this directly, your storefront never does. Signature-verified before anything is trusted; marks the order paid, decrements stock, credits wallet cashback, and triggers digital delivery if applicable.',
      },
    ],
  },
  {
    id: 'wallet',
    title: 'Wallet',
    description: 'Store credit earned as cashback on paid orders, spendable at checkout.',
    endpoints: [
      {
        method: 'GET', path: '/public/store/{shop_slug}/wallet', auth: 'customer',
        purpose: 'Balance and the last 50 transactions for the logged-in customer.',
        response: '{ balance, currency, transactions: [{ type, amount, description, created_at }] }',
      },
    ],
    note: 'Spend it by passing use_wallet_amount in the checkout body above — capped server-side at the real balance, and only ever debited from the authenticated customer’s own account, never a guest email.',
  },
  {
    id: 'digital-delivery',
    title: 'Digital Delivery',
    description: 'The download gate for digital products — the real file link is only ever revealed after a code sent by email is verified.',
    endpoints: [
      {
        method: 'GET', path: '/public/download/{token}', auth: 'none',
        purpose: 'Download gate landing page — reveals the product/shop name only, never the file.',
        response: '{ product_name, shop_name }',
      },
      {
        method: 'POST', path: '/public/download/{token}/verify', auth: 'none',
        purpose: 'Verify the emailed access code. Rate-limited to 10 attempts/hour/token.',
        params: 'Body: code',
        response: '{ file_url, file_name }',
      },
    ],
  },
  {
    id: 'blog',
    title: 'Blog',
    endpoints: [
      {
        method: 'GET', path: '/public/store/{shop_slug}/blog', auth: 'none',
        purpose: 'Published post list (omits the full content field, for a lighter list view).',
        params: 'Query: tag?',
        response: '[{ id, title, slug, excerpt, cover_image_url, status, published_at, author_name, tags[], cta_text, cta_url, view_count, created_at, updated_at }]',
      },
      {
        method: 'GET', path: '/public/store/{shop_slug}/blog/{slug}', auth: 'none',
        purpose: 'Single post detail. Increments view count.',
        response: 'Same shape, plus content.',
      },
    ],
  },
  {
    id: 'popups',
    title: 'Popups',
    description: 'Announcement, exit-intent, email-capture, and countdown popups the seller has built.',
    endpoints: [
      {
        method: 'GET', path: '/public/popups/{shop_id}', auth: 'none',
        purpose: 'Active popups for the embed script. Note: shop_id, not slug.',
        response: '{ popups: [{ id, popup_type, title, message, button_text, button_link, discount_code, image_url, delay_seconds }] }',
      },
      {
        method: 'POST', path: '/public/popups/{popup_id}/track', auth: 'none',
        purpose: 'Track an impression or click.',
        params: 'Query: event ("impression" | "click")',
        response: '{ ok: true }',
      },
      {
        method: 'GET', path: '/widget/popup.js', auth: 'none',
        purpose: 'Static embeddable script that renders the popups above.',
      },
    ],
  },
  {
    id: 'signup-forms',
    title: 'Signup Forms & Lead Capture',
    description: 'Seller-built lead forms, plus a way to mirror submissions from a form that already exists on your own site.',
    endpoints: [
      {
        method: 'GET', path: '/public/signup-forms/{shop_id}', auth: 'none',
        purpose: 'Active custom-built signup/inquiry forms.',
        response: '{ forms: [{ id, title, description, fields[], delay_seconds }] }',
      },
      {
        method: 'POST', path: '/public/signup-forms/{form_id}/track', auth: 'none',
        purpose: 'Track a form impression.',
        response: '{ ok: true }',
      },
      {
        method: 'POST', path: '/public/signup-forms/{form_id}/submit', auth: 'none',
        purpose: 'Submit answers — creates a Lead in the seller’s CRM if an email field is present.',
        params: 'Body: { answers: { field_id: value } }',
        response: '{ status, success_message, discount_code }',
      },
      {
        method: 'POST', path: '/public/capture-form/{shop_id}/submit', auth: 'none',
        purpose: 'Mirrors a submission of your own existing HTML form (tagged data-exiuscart-capture) into the Lead CRM, without changing how that form behaves.',
        params: 'Body: { fields: [{ name?, id?, type?, value? }], url? }',
        response: '{ status: "ok" }',
      },
      {
        method: 'GET', path: '/widget/signup-form.js', auth: 'none',
        purpose: 'Static embeddable script — renders custom forms and passively mirrors tagged existing forms.',
      },
    ],
  },
  {
    id: 'misc',
    title: 'Misc & Utility',
    endpoints: [
      {
        method: 'GET', path: '/public/check-ref/{code}', auth: 'none',
        purpose: 'Check whether an affiliate referral code is active.',
        response: '{ valid: boolean }',
      },
      {
        method: 'GET', path: '/public/reservation/{reservation_id}', auth: 'none',
        purpose: 'Reservation info for a QR-code public page.',
        response: 'id, customer_name, customer_phone, product_name, quantity, reservation_type, status, advance_amount, notes, expires_at, shop_name, currency, product_stock, product_reserved',
      },
      {
        method: 'GET', path: '/public/quotation/{token}', auth: 'none',
        purpose: 'A client views a shared B2B quotation.',
        response: 'quote_number, shop_name, items, subtotal, discount, tax, total, status, valid_until, and more',
      },
      {
        method: 'POST', path: '/public/quotation/{token}/respond', auth: 'none',
        purpose: 'Client accepts or rejects a quotation.',
        params: 'Body: { action: "accept" | "reject", name? }',
        response: '{ status }',
      },
      {
        method: 'GET', path: '/shops/exchange-rates', auth: 'none',
        purpose: 'Live currency conversion rates (12h cache). Not shop-scoped — a general utility.',
        params: 'Query: base (default "USD")',
        response: '{ base, rates, cached, stale? }',
      },
    ],
  },
];

const methodColor: Record<string, string> = {
  GET: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  POST: 'bg-blue-50 text-blue-700 ring-blue-600/20',
};

const authLabel: Record<Auth, string> = {
  none: 'No auth',
  customer: 'Customer token',
  optional: 'Optional customer token',
  webhook: 'Gateway webhook only',
};

const authColor: Record<Auth, string> = {
  none: 'bg-slate-100 text-slate-600',
  customer: 'bg-[#6B3FD9]/10 text-[#6B3FD9]',
  optional: 'bg-amber-50 text-amber-700',
  webhook: 'bg-rose-50 text-rose-700',
};

function EndpointCard({ ep }: { ep: Endpoint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${methodColor[ep.method]}`}>
          {ep.method}
        </span>
        <code className="text-sm text-slate-800 font-mono break-all">{ep.path}</code>
        <span className={`ml-auto inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${authColor[ep.auth]}`}>
          {authLabel[ep.auth]}
        </span>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed mb-2">{ep.purpose}</p>
      {ep.params && (
        <div className="text-xs mb-1.5">
          <span className="font-semibold text-slate-500">Params/Body </span>
          <code className="text-slate-700 font-mono">{ep.params}</code>
        </div>
      )}
      {ep.response && (
        <div className="text-xs">
          <span className="font-semibold text-slate-500">Response </span>
          <code className="text-slate-700 font-mono break-all">{ep.response}</code>
        </div>
      )}
    </div>
  );
}

export default function DevelopersPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="ExiusCart" width={28} height={28} />
            <span className="text-lg font-bold text-slate-900 tracking-tight">
              <span className="text-[#6B3FD9]">Exius</span>Cart
            </span>
            <span className="text-slate-300 mx-1">/</span>
            <span className="text-sm font-semibold text-slate-500">Developers</span>
          </Link>
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
            Back to site
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 grid lg:grid-cols-[220px_1fr] gap-10">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-0.5 text-sm">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block px-3 py-1.5 rounded-lg text-slate-600 hover:text-[#6B3FD9] hover:bg-[#6B3FD9]/5 transition-colors"
              >
                {s.title}
              </a>
            ))}
          </nav>
        </aside>

        <main>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-3">
            API Reference
          </h1>
          <p className="text-base text-slate-600 max-w-2xl leading-relaxed mb-8">
            Everything a Custom Website storefront needs to call ExiusCart directly — products, checkout, payment,
            customer accounts, and more. No ExiusCart login is required to read this page or to call any endpoint
            marked <span className="font-semibold text-slate-700">No auth</span>.
          </p>

          <div className="rounded-xl border border-slate-200 bg-white p-5 mb-10 space-y-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Base URL</span>
              <code className="text-sm font-mono text-slate-800 bg-slate-100 rounded px-2 py-0.5">{BASE_URL}</code>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Every path below is appended directly to that base URL. Every endpoint is scoped to your store either by
              a <code className="font-mono text-slate-700 bg-slate-100 rounded px-1">{'{shop_slug}'}</code> in the
              path, or by an opaque token (order number + email, a review link, a download code) — never by an
              ExiusCart seller login. CORS is open, so you can call these directly from the browser.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {(Object.keys(authLabel) as Auth[]).map((a) => (
                <span key={a} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${authColor[a]}`}>
                  {authLabel[a]}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              <span className="font-semibold text-[#6B3FD9]">Customer token</span> and{' '}
              <span className="font-semibold text-amber-700">Optional customer token</span> mean a JWT from Customer
              Auth below, sent as <code className="font-mono bg-slate-100 rounded px-1">Authorization: Bearer &lt;token&gt;</code>.{' '}
              <span className="font-semibold text-rose-700">Gateway webhook only</span> means your storefront should
              never call it — it exists purely for PayHere/Stripe to call directly.
            </p>
          </div>

          <div className="space-y-14">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="text-xl font-bold text-slate-900 mb-1.5">{s.title}</h2>
                {s.description && (
                  <p className="text-sm text-slate-600 leading-relaxed mb-4 max-w-3xl">{s.description}</p>
                )}
                <div className="space-y-3">
                  {s.endpoints.map((ep) => (
                    <EndpointCard key={ep.method + ep.path} ep={ep} />
                  ))}
                </div>
                {s.note && (
                  <p className="text-xs text-slate-500 mt-3 leading-relaxed">{s.note}</p>
                )}
              </section>
            ))}
          </div>

          <div className="mt-16 pt-8 border-t border-slate-200 text-sm text-slate-500">
            Questions about integrating? Reach out at{' '}
            <a href="mailto:dropshipping@exiuscart.com" className="text-[#6B3FD9] hover:underline">dropshipping@exiuscart.com</a>.
          </div>
        </main>
      </div>
    </div>
  );
}
