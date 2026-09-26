'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { Gochi_Hand, Poppins } from 'next/font/google';
import { ArrowRight, Check, X, ChevronDown, Store, Users2, Puzzle, Headphones, Rocket, TrendingUp, Building2, BadgeCheck, HelpCircle } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { pricing } from '@/config/pricing';

// A deliberately different hand-drawn font from what competitors use for
// this same "annotation" pattern — same idea (a scribbled note), own look,
// not a lookalike of any specific site.
const handwriting = Gochi_Hand({ subsets: ['latin'], weight: ['400'] });
// Real fonts confirmed by inspecting a competitor's live pricing page
// (Playwright, computed styles) — Poppins for plan names/prices, paired
// with Inter (already the site's base font) for everything else. That
// heading/body pairing is what actually reads as "designed", not either
// font alone.
const poppins = Poppins({ subsets: ['latin'], weight: ['600'] });

type Period = 'monthly' | 'yearly';

// Hand-drawn marker-style callout — a curved arrow + handwritten note, the
// "someone scribbled this on the page" pattern used by Tradelle and similar
// SaaS pricing pages to draw the eye to one specific thing. `flip` mirrors
// the arrow for callouts pointing the other direction. Hidden below `lg`:
// there's no room for a floating annotation once cards stack to one column.
function PencilNote({
  text, className, rotate = -4, flip = false, direction = 'down', wrap = false, wrapWidth = 190, color = '#6B3FD9',
}: { text: string | string[]; className?: string; rotate?: number; flip?: boolean; direction?: 'down' | 'left'; wrap?: boolean; wrapWidth?: number; color?: string }) {
  const lines = Array.isArray(text) ? text : [text];
  // `wrap` trades the single-line layout for a narrow wrapped block — used
  // where the note has no guaranteed open space beside it (e.g. sitting in
  // a grid column with no fixed gutter), so it can't rely on screen width.
  const textEl = (
    <span
      className={`${handwriting.className} text-2xl leading-snug ${wrap ? 'whitespace-normal' : 'whitespace-nowrap'} ${direction === 'down' ? 'text-right' : ''}`}
      style={{ transform: `rotate(${rotate}deg)`, color, ...(wrap ? { maxWidth: `${wrapWidth}px` } : {}) }}
    >
      {lines.map((line, i) => (
        <span key={i} className={wrap ? undefined : 'block'}>{wrap ? `${line} ` : line}</span>
      ))}
    </span>
  );

  // 'down': text sits above, the arrow swoops down from it to point at a
  // target below — `flip` mirrors the swoop to lean right instead of left.
  if (direction === 'down') {
    return (
      <div className={`hidden lg:flex flex-col items-end gap-0.5 pointer-events-none select-none ${className ?? ''}`}>
        {textEl}
        <svg width="56" height="50" viewBox="0 0 46 42" fill="none" className="shrink-0" style={{ color }}>
          {/* `flip` uses hand-mirrored path data (46 - x for every x) instead
              of a CSS transform — scaleX(-1) here was flipping around the
              SVG's default top-left origin, pushing the path into negative
              coordinate space where the viewBox clips it invisible. Real
              coordinates avoid that class of bug entirely. */}
          {flip ? (
            <>
              <path d="M4 4C6 17 15 33 34 39C38 40.3 41.5 40 44 38.3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
              <path d="M37 33.5L44 38.3L41.5 29.8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </>
          ) : (
            <>
              <path d="M42 4C40 17 31 33 12 39C8 40.3 4.5 40 2 38.3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
              <path d="M9 33.5L2 38.3L4.5 29.8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </>
          )}
        </svg>
      </div>
    );
  }

  // 'left': a short horizontal swoosh pointing left, for a note sitting
  // beside its target (same line) rather than above it. `flip` mirrors it
  // to point right instead — for a note sitting to the LEFT of its target
  // (e.g. in a page gutter) that needs to point back into the page.
  return (
    <div className={`hidden lg:flex items-center gap-1.5 pointer-events-none select-none ${flip ? 'flex-row-reverse' : ''} ${className ?? ''}`}>
      <svg width="40" height="24" viewBox="0 0 40 24" fill="none" className={`shrink-0 ${flip ? 'scale-x-[-1] origin-center' : ''}`} style={{ color }}>
        <path d="M38 7C27 8 14 12 4 15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M11 9L4 15L12 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      {textEl}
    </div>
  );
}

// A "?" info icon that shows its explanation on hover (desktop) AND on tap
// (mobile, where :hover doesn't fire reliably) — click toggles it open,
// and a document-level listener closes it on the next tap/click anywhere
// else, so it doesn't get stuck open on touch devices.
function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex group">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="text-gray-400 hover:text-[#6B3FD9] transition-colors"
        aria-label="More info"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      <span
        role="tooltip"
        className={`absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-gray-900 text-white text-[11px] leading-snug px-3 py-2 shadow-lg transition-opacity pointer-events-none ${
          open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        {text}
      </span>
    </span>
  );
}

// Prodora is a real, named product-within-the-product (thousands of
// pre-vetted winning products, one-click import) — it was getting lost as
// plain text in a long checklist next to "Chat support". Pulled out into
// its own render so it reads as a headline feature, not a bullet point.
// The real logo file has a white background baked in (not transparent), so
// it's wrapped in a small white chip rather than dropped directly onto the
// dark cards — reads as an intentional app-icon badge, not a broken image.
function FeatureLine({ text }: { text: string }) {
  if (!text.startsWith('Prodora')) return <>{text}</>;
  const rest = text.replace(/^Prodora\s*—\s*/, '');
  return (
    <span className="inline-flex items-center flex-wrap gap-x-2">
      <span className="inline-flex items-center gap-1.5 font-black text-[1.2em] tracking-tight bg-gradient-to-r from-[#A78BFA] to-[#6B3FD9] bg-clip-text text-transparent">
        <span className="inline-flex w-[1.3em] h-[1.3em] rounded-md bg-white p-[0.15em] shrink-0 shadow-sm">
          <Image src="/prodora-logo.png" alt="" width={20} height={20} className="w-full h-full object-contain" />
        </span>
        Prodora
      </span>
      <span>— {rest}</span>
      <InfoTip text="Prodora is ExiusCart's built-in product research tool — browse thousands of pre-vetted, high-margin winning products with real supplier pricing, and import them straight into your store." />
    </span>
  );
}

// Icon + name + one-line description header, matching the flat-icon-box
// pattern competitors like Tradelle use above each plan's price.
function PlanHeader({ icon: Icon, iconBg, iconColor, name, nameColor, desc }: {
  icon: React.ElementType; iconBg: string; iconColor: string; name: string; nameColor: string; desc: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </span>
      <div>
        <p className={`${poppins.className} text-lg ${nameColor}`}>{name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

// A quantity feature shown as a filled bar, not just a checkmark — makes the
// jump between tiers (500 → 2,000 → Unlimited leads) visible at a glance
// instead of just readable as text, same idea as Tradelle's usage bars. Every
// row still gets its own checkmark first, so it reads as "included, and
// here's how much" rather than the bar alone standing in for inclusion.
function LimitBar({ label, percent, dark }: { label: string; percent: number; dark?: boolean }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1.5">
        <Check className={`w-4 h-4 shrink-0 ${dark ? 'text-blue-400' : 'text-blue-600'}`} strokeWidth={3} />
        <p className={`text-xs ${dark ? 'text-gray-300' : 'text-gray-600'}`}><FeatureLine text={label} /></p>
      </div>
      <div className={`h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-gray-100'}`}>
        <div className="h-full rounded-full bg-[#6B3FD9]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

// A feature that's simply included on every plan — same checkmark row as
// LimitBar's own header, just without a bar underneath (nothing to meter).
function TickRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Check className="w-4 h-4 shrink-0 text-blue-600" strokeWidth={3} />
      <p className="text-xs text-gray-600"><FeatureLine text={label} /></p>
    </div>
  );
}

const faqs = [
  {
    q: 'How does the free trial work?',
    a: 'Launch is free for 7 days — no credit card needed. Growth and Scale start at $1 for your first 7 days instead (no free week), then move to full price. Cancel anytime and you\'re never charged again.',
  },
  {
    q: 'Can I cancel my subscription anytime?',
    a: 'Yes. Cancel from your account settings anytime — during the trial or after. You keep access until the end of your current billing period, and nothing further is ever charged.',
  },
  {
    q: 'What is the difference between monthly and yearly billing?',
    a: 'Yearly billing saves you 25% compared to monthly — 3 months free. You are charged once per year upfront, after your trial ends.',
  },
  {
    q: 'Can I upgrade from Launch to Scale?',
    a: 'Yes — upgrade anytime. You only pay the prorated difference for the remaining billing period.',
  },
  {
    q: 'Is pricing the same everywhere?',
    a: 'Yes — one price worldwide, billed in USD (Launch $14.99/mo, Growth $24.99/mo, Scale $39.99/mo). No region-based pricing or currency switching.',
  },
  {
    q: 'Is VAT invoicing available on the free trial?',
    a: 'Yes — VAT-compliant invoicing is available on all plans including the free trial. Your VAT rate is configured in your account settings.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept bank transfer and local payment methods. Card payments coming soon.',
  },
  {
    q: 'Do you offer refunds?',
    a: 'Yes — we offer a 7-day money-back guarantee if you are not satisfied after upgrading.',
  },
];

// Real sidebar/app sections (Commerce, Sales Channels, AI Commerce, Product
// Studio, MCP & AI Connections, etc.) collapsed into one comparison list so
// the pricing page reads as "how much of each area you unlock" rather than
// dozens of granular bullet points repeated three times. percents = [Launch,
// Growth, Scale] — AI Commerce/Product Studio/MCP are gated off entirely on
// Launch (0%), partial on Growth (50%), full on Scale (100%).
const FEATURE_CATEGORIES: { label: string; percents: [number, number, number] }[] = [
  { label: 'Commerce', percents: [40, 60, 100] },
  { label: 'Sales Channels', percents: [30, 70, 100] },
  { label: 'Prodora — Product Sourcing', percents: [30, 70, 100] },
  { label: 'Dropshipping & Fulfillment', percents: [30, 70, 100] },
  { label: 'Marketing & Automation', percents: [30, 70, 100] },
  { label: 'Finance & Analytics', percents: [30, 70, 100] },
  { label: 'Team & Operations', percents: [30, 70, 100] },
  { label: 'AI Commerce, Product Studio & MCP Connections', percents: [30, 70, 100] },
];

// Full plan-by-plan comparison table — every row here is a real, working
// feature (confirmed against the actual backend/dashboard code, not a
// "Coming Soon" placeholder). true/false render as a check/x circle; a
// string renders as-is (a limit or "Unlimited"). Team & Operations rows are
// false on Launch to match the real gate in ShopSidebar (PREMIUM_GROUPS) —
// Launch genuinely doesn't unlock HR/Services today.
const compareplans = [
  { id: 'launch', name: 'Launch', price: 14.99, highlighted: false },
  { id: 'growth', name: 'Growth', price: 24.99, highlighted: true },
  { id: 'scale', name: 'Scale', price: 39.99, highlighted: false },
];

// A plain row's per-plan cell is either a check/x (boolean) or a short tag
// like "Limited" / "Unlimited" (string) — "Limited" renders as a light-
// orange pill to read as a real but reduced tier, not a full yes/no.
interface CheckRow { label: string; values: (boolean | string)[] }
// showText false: no number/word above the bar at all — used for a row
// where the tiering is purely a "grows with the plan" visual cue with no
// real quantity behind it (Orders, Email marketing, etc.), so a fake-
// looking number like "30" or "60" would misread as a real limit.
interface BarRow { label: string; bars: { text: string; pct: number }[]; showText?: boolean }
type CompareRow = CheckRow | BarRow;

// Default growth curve for a quantity-limit row (33% / 66% / 100%) — a
// visual "grows with the plan" cue, not a literal ratio of the real numbers
// (some jumps, like 1,000 → 10,000 products, are 10x and would make the
// first bar invisible if drawn to true scale). The real number is always
// the label. Pass `percents` to override (e.g. a row using the same 40/70/
// 100 tiering as the plan cards' own category bars).
function barRow(label: string, texts: [string, string, string], percents: [number, number, number] = [33, 66, 100]): BarRow {
  return { label, bars: texts.map((text, i) => ({ text, pct: percents[i] })) };
}

// Same growing-bar visual, no text at all above it — for a row that's
// purely a tier cue (no real countable limit behind the number).
function tierBar(label: string, percents: [number, number, number]): BarRow {
  return { label, bars: percents.map((pct) => ({ text: '', pct })), showText: false };
}

const compareGroups: { title: string; rows: CompareRow[] }[] = [
  {
    title: 'Store & Sales',
    rows: [
      { label: 'Point of Sale', values: [true, true, true] },
      tierBar('Orders (all channels, one dashboard)', [40, 70, 100]),
      { label: 'Wholesale buyer portal', values: [true, true, true] },
      { label: 'Quotations', values: [true, true, true] },
      { label: 'Reservations', values: [true, true, true] },
      { label: 'Multi-branch / multi-location', values: [true, true, true] },
      barRow('Staff accounts', ['3', '6', 'Unlimited']),
    ],
  },
  {
    title: 'Commerce & Catalog',
    rows: [
      barRow('Products', ['1,000', '10,000', 'Unlimited']),
      barRow('Customers (CRM, VIP, segments, tags)', ['5,000', '25,000', 'Unlimited']),
      { label: 'Discount codes', values: [true, true, true] },
      { label: 'Gift cards', values: [true, true, true] },
      { label: 'Reviews & testimonials', values: [true, true, true] },
      { label: 'Inventory + low-stock alerts', values: [true, true, true] },
      { label: 'Purchases & local suppliers', values: [true, true, true] },
      barRow('Product photos per listing', ['6', '10', '15']),
      barRow('Description length', ['350 words', '500 words', '1,000 words']),
      tierBar('Multiple barcode generation', [40, 70, 100]),
    ],
  },
  {
    title: 'Sales Channels',
    rows: [
      { label: 'Shopify, WooCommerce, BigCommerce, Whop, Gumroad, Noon, TheDersi, Custom Website', values: [true, true, true] },
      { label: 'eBay, Daraz sync', values: [false, true, true] },
      { label: 'Etsy, TikTok Shop sync', values: [true, true, true] },
      barRow('Connected channels at once', ['3', '5', 'Unlimited']),
      { label: 'Channel listings, categories & order sync', values: [true, true, true] },
      { label: 'Integrations hub', values: [true, true, true] },
    ],
  },
  {
    title: 'Dropshipping & Fulfillment',
    rows: [
      barRow('Dropship suppliers (CJ, HyperSKU, Printful, AliExpress)', ['1', '3', 'All']),
      { label: 'Auto order fulfillment to supplier', values: [true, true, true] },
      { label: 'Live tracking sync', values: [true, true, true] },
      { label: 'Supplier returns log', values: [true, true, true] },
    ],
  },
  {
    title: 'Prodora — Product Sourcing',
    rows: [
      { label: 'Winning-product research access', values: [true, true, true] },
      barRow('Product imports / month', ['100', '500', 'Unlimited']),
      { label: 'Digital design bundles (via Whop)', values: [true, true, true] },
      { label: 'Standalone Product Research page', values: [true, true, true] },
    ],
  },
  {
    title: 'Marketing',
    rows: [
      tierBar('Email marketing', [30, 60, 100]),
      tierBar('WhatsApp marketing', [30, 60, 100]),
      { label: 'Emails go out under your store name (customer replies reach your inbox)', values: [true, true, true] },
      { label: 'Send all customer emails from your own domain (invoices, quotes and marketing campaigns)', values: [false, false, true] },
      { label: 'Lead management', values: [true, true, true] },
      barRow('Leads / month', ['500', '2,000', 'Unlimited']),
      { label: 'Abandoned cart automation', values: [true, true, true] },
      { label: 'Social media scheduling (Facebook, Instagram, TikTok)', values: [true, true, true] },
      { label: 'Blog', values: [true, true, true] },
      { label: 'Popups & signup forms', values: [true, true, true] },
      { label: 'Events & surveys', values: [true, true, true] },
      { label: 'AI SEO tools', values: [true, true, true] },
      { label: 'AI product videos', values: [false, 'Limited', 'Unlimited'] },
      { label: 'Storefront insights', values: [true, true, true] },
      { label: 'Marketing overview hub, Campaigns, Customer Segments & Ads manager', values: [false, 'Limited', 'Unlimited'] },
    ],
  },
  {
    title: 'Finance & Analytics',
    rows: [
      { label: 'Invoices & recurring invoices', values: [true, true, true] },
      { label: 'Credit notes', values: [true, true, true] },
      { label: 'Expense tracking', values: [true, true, true] },
      { label: 'VAT-ready invoicing', values: [true, true, true] },
      { label: 'P&L, AR aging, profitability reports', values: [true, true, true] },
      { label: 'Channel revenue reports', values: [true, true, true] },
      { label: 'Accounting (balance sheet, cash flow)', values: [true, true, true] },
      { label: 'Multi-currency', values: [true, true, true] },
      { label: 'Loyalty program', values: [true, true, true] },
      { label: 'Wallet / store credit', values: [true, true, true] },
      { label: 'Marketplace earnings tracking', values: [true, true, true] },
      { label: 'Analytics sub-pages (Customer, Product, Channel, Fulfillment)', values: [true, true, true] },
    ],
  },
  {
    title: 'Team & Operations',
    rows: [
      { label: 'HR & Payroll', values: [false, true, true] },
      { label: 'Recruitment', values: [false, true, true] },
      { label: 'Attendance tracking', values: [false, true, true] },
      { label: 'Fleet management', values: [false, true, true] },
      { label: 'Projects & tasks', values: [false, true, true] },
      { label: 'Helpdesk ticketing', values: [false, true, true] },
      { label: 'Appointment booking', values: [false, true, true] },
    ],
  },
  {
    title: 'AI Commerce, Product Studio & MCP Connections',
    rows: [
      { label: 'AI Commerce (Assistant, Listing Generator, Product Creator, Product Images)', values: [false, true, true] },
      { label: 'Product Studio (Brand Assets, Templates, Mockup Studio, Design Studio)', values: [false, true, true] },
      { label: 'MCP & AI Connections', values: [false, true, true] },
    ],
  },
];

export default function PricingPage() {
  const [billing, setBilling] = useState<Period>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const prices = pricing.USD;
  // Always shown as a /month rate, even in Yearly mode (yearly ÷ 12) — the
  // real charge is called out separately below as "Billed as $X/year".
  // Showing the annual total as the giant number instead makes Yearly look
  // MORE expensive than Monthly at a glance, backwards from the point of
  // the toggle. The crossed-out "original" stays the flat monthly list
  // price in both modes, so the yearly discount correctly reads as bigger.
  const launchPrice = (billing === 'monthly' ? prices.launch.monthly : prices.launch.yearly / 12).toFixed(2);
  const growthPrice = (billing === 'monthly' ? prices.growth.monthly : prices.growth.yearly / 12).toFixed(2);
  const scalePrice = (billing === 'monthly' ? prices.scale.monthly : prices.scale.yearly / 12).toFixed(2);
  const launchOriginal = prices.launch.originalMonthly;
  const growthOriginal = prices.growth.originalMonthly;
  const scaleOriginal = prices.scale.originalMonthly;
  const billedYearly = {
    launch: prices.launch.yearly.toFixed(2),
    growth: prices.growth.yearly.toFixed(2),
    scale: prices.scale.yearly.toFixed(2),
  };
  const period = '/month';
  const currSym = '$';

  return (
    <div className="min-h-screen bg-[#F5F3EF]">
      <Navbar />

      {/* ── Hero ── */}
      {/* relative + z-10: the pencil note below overflows past this
          section's own box (absolute positioning doesn't add to parent
          height) — without a stacking context here, the next section's
          solid white cards paint over it since they come later in DOM
          order, even though the note visually sits "above" on screen. */}
      <section className="relative z-10 pt-28 pb-12 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-[#6B3FD9] bg-[#6B3FD9]/10 px-3 py-1.5 rounded-full mb-6">
            Transparent Pricing
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-[1.05] tracking-tight mb-5">
            Plans and <span className="text-[#6B3FD9]">Pricing</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto mb-6 leading-relaxed">
            7-day free trial. 7-day money-back guarantee. Immediate access.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-400 mb-8">
            {['Launch: 7 days free, no card', 'Growth & Scale: $1 for 7 days', 'Cancel anytime'].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#6B3FD9]" /> {t}
              </span>
            ))}
          </div>

          {/* Billing toggle */}
          <div className="relative flex justify-center">
            {/* direction="down": text sits above, arrow swoops down to
                point at the pricing cards below. This didn't render at all
                until the real bug was found — the Hero section had no
                stacking context, so the Pricing Cards section (later in DOM
                order) painted over this note's overflow despite it visually
                sitting "above". Fixed via `relative z-10` on the Hero
                <section> itself, further up this file. */}
            <PencilNote
              text={['One sale a month', 'covers your subscription']}
              rotate={-3}
              direction="down"
              flip
              color="#111827"
              className="absolute right-full top-0 mr-6"
            />
            <div className="relative inline-flex bg-white rounded-2xl p-1 shadow-sm border border-gray-100">
              <button
                onClick={() => setBilling('monthly')}
                className={`px-7 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                  billing === 'monthly'
                    ? 'bg-[#0B1121] text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('yearly')}
                className={`relative px-7 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                  billing === 'yearly'
                    ? 'bg-[#0B1121] text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                Yearly
                {/* Below `lg` the hand-drawn PencilNote below is hidden (no
                    room for a floating annotation once cards stack), so this
                    compact badge carries the same savings message at every
                    size instead of losing it below desktop. Hidden at lg+ so
                    the two never show at once. 25% is exact — yearly = 9x
                    monthly (pay for 9 months, 3 free): 1 - 9/12 = 25%. */}
                <span className="animate-float lg:hidden absolute -top-3.5 -right-3.5 bg-red-500 text-white text-sm font-bold px-2.5 py-1 rounded-full shadow-sm whitespace-nowrap">
                  -25%
                </span>
              </button>
              <PencilNote
                text={['save 25% billing', 'yearly!']}
                rotate={-4}
                direction="left"
                color="#EF4444"
                className="absolute left-full top-1/2 -translate-y-1/2 ml-3"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing cards ── */}
      <section className="pb-16 px-6">
        <div className="max-w-[1280px] mx-auto">
          <div className="relative grid md:grid-cols-3 gap-6 items-start">

            {/* Launch */}
            <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
              <PlanHeader icon={Rocket} iconBg="bg-[#6B3FD9]/10" iconColor="text-[#6B3FD9]" name="Launch" nameColor="text-gray-900" desc="For small stores just getting started" />

              {launchOriginal && (
                <div className="mt-5 flex items-center gap-2">
                  <span className="text-sm text-gray-400 line-through">{currSym}{launchOriginal}{period}</span>
                  <span className="animate-float text-xs font-bold bg-red-100 text-red-700 px-2.5 py-1 rounded-full">
                    {Math.round((1 - Number(launchPrice) / launchOriginal) * 100)}% OFF
                  </span>
                </div>
              )}
              <div className="mt-2 mb-2 flex items-start gap-2">
                <span className="text-xl font-black text-gray-400 mt-3 leading-none">$</span>
                <span className={`${poppins.className} text-[3.8rem] font-semibold text-gray-900 tracking-tight leading-none`}>{launchPrice}</span>
                <span className="text-gray-400 text-sm self-end mb-1">{period}</span>
              </div>
              {billing === 'yearly' && <p className="text-xs text-gray-400 mb-1">Billed as ${billedYearly.launch}/year</p>}
              <p className="text-sm text-gray-400 mb-7">For small stores. Most businesses fit here.</p>

              {/* No payment info at all — real 7-day free trial, card only
                  needed later if they choose to continue past day 7. */}
              <Link
                href={`/register?plan=launch&billing=${billing}`}
                className="block text-center bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 rounded-2xl text-sm transition-all mb-8"
              >
                Try for free
              </Link>

              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                Features you get
              </p>
              <TickRow label="POS & Inventory — included" />
              <TickRow label="Access to 36M+ Products" />
              <TickRow label="Basic Product Research" />
              {/* AI Commerce, Product Studio & MCP Connections omitted on
                  Launch specifically — Growth and Scale both get it, Launch
                  doesn't. */}
              {FEATURE_CATEGORIES.filter((c) => c.label !== 'AI Commerce, Product Studio & MCP Connections').map((c) => (
                <LimitBar key={c.label} label={c.label} percent={c.percents[0]} />
              ))}
              <a href="#compare-all-plans" className="block text-center text-sm font-semibold text-[#6B3FD9] hover:text-[#5a34b8] mt-6">
                Compare all features →
              </a>
            </div>

            {/* Growth — featured, real checkout (Lemon Squeezy variant to be added) */}
            <div className="relative bg-white rounded-3xl border-2 border-[#6B3FD9] p-8 shadow-xl">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[#E6F4FF] text-[#0D70BB] text-xs font-semibold px-3 py-1 rounded whitespace-nowrap">
                <BadgeCheck className="w-3.5 h-3.5" />
                Most Popular
              </div>

              <PlanHeader icon={TrendingUp} iconBg="bg-[#6B3FD9]/10" iconColor="text-[#6B3FD9]" name="Growth" nameColor="text-gray-900" desc="More channels, more suppliers, more room to grow" />

              {growthOriginal && (
                <div className="mt-5 flex items-center gap-2">
                  <span className="text-sm text-gray-400 line-through">{currSym}{growthOriginal}{period}</span>
                  <span className="animate-float text-xs font-bold bg-red-100 text-red-700 px-2.5 py-1 rounded-full">
                    {Math.round((1 - Number(growthPrice) / growthOriginal) * 100)}% OFF
                  </span>
                </div>
              )}
              <div className="mt-2 mb-2 flex items-start gap-2">
                <span className="text-xl font-black text-gray-400 mt-3 leading-none">$</span>
                <span className={`${poppins.className} text-[3.8rem] font-semibold text-gray-900 tracking-tight leading-none`}>{growthPrice}</span>
                <span className="text-gray-400 text-sm self-end mb-1">{period}</span>
              </div>
              {billing === 'yearly' && <p className="text-xs text-gray-400 mb-1">Billed as ${billedYearly.growth}/year</p>}
              <p className="text-sm text-gray-400 mb-1">For stores ready to sell on more channels.</p>
              <p className="text-xs text-gray-400 mb-6">$1 for 7 days, then full price.</p>

              {/* $1 today, no free week (only Launch has one) — card
                  required. Covers the first 7 days, then subscription_
                  lifecycle.py's daily cron switches to full price. */}
              <Link
                href={`/register?plan=growth&billing=${billing}&trial=dollar`}
                className="block text-center bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold py-3 rounded-2xl text-sm transition-all mb-8"
              >
                Try for $1
              </Link>

              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">
                Everything in Launch, and
              </p>
              {FEATURE_CATEGORIES.map((c) => (
                <LimitBar key={c.label} label={c.label} percent={c.percents[1]} />
              ))}
              <a href="#compare-all-plans" className="block text-center text-sm font-semibold text-[#6B3FD9] hover:text-[#5a34b8] mt-6">
                Compare all features →
              </a>
            </div>

            {/* Scale */}
            <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
              <PlanHeader icon={Building2} iconBg="bg-gray-900" iconColor="text-white" name="Scale" nameColor="text-gray-900" desc="Unlimited everything, for growing teams" />

              {scaleOriginal && (
                <div className="mt-5 flex items-center gap-2">
                  <span className="text-sm text-gray-400 line-through">{currSym}{scaleOriginal}{period}</span>
                  <span className="animate-float text-xs font-bold bg-red-100 text-red-700 px-2.5 py-1 rounded-full">
                    {Math.round((1 - Number(scalePrice) / scaleOriginal) * 100)}% OFF
                  </span>
                </div>
              )}
              <div className="mt-2 mb-2 flex items-start gap-2">
                <span className="text-xl font-black text-gray-400 mt-3 leading-none">$</span>
                <span className={`${poppins.className} text-[3.8rem] font-semibold text-gray-900 tracking-tight leading-none`}>{scalePrice}</span>
                <span className="text-gray-400 text-sm self-end mb-1">{period}</span>
              </div>
              {billing === 'yearly' && <p className="text-xs text-gray-400 mb-1">Billed as ${billedYearly.scale}/year</p>}
              <p className="text-sm text-gray-400 mb-1">Unlimited everything. For growing businesses.</p>
              <p className="text-xs text-gray-400 mb-6">$1 for 7 days, then full price.</p>

              {/* $1 today, no free week (only Launch has one) — card
                  required. Covers the first 7 days, then subscription_
                  lifecycle.py's daily cron switches to full price. */}
              <Link
                href={`/register?plan=scale&billing=${billing}&trial=dollar`}
                className="block text-center bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 rounded-2xl text-sm transition-all mb-8"
              >
                Try for $1
              </Link>

              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                Everything in Growth, and
              </p>
              {FEATURE_CATEGORIES.map((c) => (
                <LimitBar key={c.label} label={c.label} percent={c.percents[2]} />
              ))}
              <a href="#compare-all-plans" className="block text-center text-sm font-semibold text-[#6B3FD9] hover:text-[#5a34b8] mt-6">
                Compare all features →
              </a>
            </div>

          </div>

          {/* Enterprise / Marketplace card — Paddle style */}
          <div className="mt-4 rounded-3xl overflow-hidden" style={{ background: '#EDEBE6' }}>
            <div className="p-10 md:p-14 grid md:grid-cols-2 gap-12 items-center">
              {/* Left: heading + description + button */}
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-gray-500 block mb-4">
                  Marketplace &amp; Enterprise
                </span>
                <h3 className="text-4xl md:text-5xl font-bold text-gray-900 leading-[1.1] mb-5 tracking-tight">
                  Custom pricing
                </h3>
                <p className="text-gray-600 text-base leading-relaxed mb-10">
                  Running a marketplace with multiple vendors, or a large enterprise operation?
                  We&apos;ll build a plan around your exact needs — vendors, volume, and integrations.
                </p>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold px-7 py-3.5 rounded-2xl transition-all text-sm"
                >
                  Contact us
                  <span className="w-6 h-6 bg-[#6B3FD9] rounded-lg flex items-center justify-center flex-shrink-0">
                    <ArrowRight className="w-3.5 h-3.5 text-white" />
                  </span>
                </Link>
              </div>

              {/* Right: feature list 2-column */}
              <div className="grid sm:grid-cols-2 gap-5">
                {[
                  { icon: Store,      text: 'Custom pricing for marketplace operators with multiple vendors' },
                  { icon: Users2,     text: 'Send invoices from your own email domain — custom branding end-to-end' },
                  { icon: Puzzle,     text: 'Custom integrations, HR & staff management tailored to your operation' },
                  { icon: Headphones, text: 'Priority support with a dedicated account manager' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-start gap-3">
                    <span className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0 mt-0.5 border border-black/6">
                      <Icon className="w-4 h-4 text-gray-600" />
                    </span>
                    <p className="text-gray-600 text-sm leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trust row */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-gray-400">
            {[
              'No credit card for free trial',
              'Cancel anytime',
              '7-day money-back guarantee',
              'All features from day one',
            ].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#6B3FD9]" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Compare all plans ── */}
      <section id="compare-all-plans" className="py-20 px-6 bg-[#F5F3EF] border-t border-gray-200 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Compare all plans
          </h2>
          <p className="text-gray-500 mb-12">Every real, working feature — plan by plan.</p>

          {/* Feature-name column is a fixed 168px and stuck to the left with
              `sticky left-0` — on a narrow screen only the 3 plan columns
              scroll underneath it, the feature name itself never moves.
              Every row (header included) shares this exact same grid
              template so the sticky column lines up perfectly at every
              row. */}
          <div className="overflow-x-auto">
            <div className="min-w-[560px] pb-1">
              <div className="grid grid-cols-[168px_1fr_1fr_1fr] gap-3 sticky top-0 z-20 bg-[#F5F3EF] pb-4 pt-2">
                <div className="sticky left-0 z-10 bg-[#F5F3EF]" />
                {compareplans.map((p) => (
                  <div key={p.id} className={`text-center rounded-2xl py-3 ${p.highlighted ? 'bg-[#6B3FD9] text-white' : 'bg-white text-gray-900 border border-gray-200'}`}>
                    <p className="font-bold">{p.name}</p>
                    <p className={`text-xs mt-0.5 ${p.highlighted ? 'text-white/80' : 'text-gray-400'}`}>${p.price}/mo</p>
                  </div>
                ))}
              </div>

              {compareGroups.map((group) => (
                <div key={group.title} className="mb-8">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 pl-1 sticky left-0 w-fit">
                    {group.title}
                  </p>
                  {/* No `overflow-hidden` here on purpose — it would create a
                      second scroll context nested inside the outer
                      overflow-x-auto, and a `sticky` label cell locks onto
                      the NEAREST one. Since this card never scrolls itself,
                      the sticky column would compute its position against a
                      box that's frozen at scrollLeft 0, landing far off-
                      screen the moment the real (outer) container scrolls.
                      Rounded corners instead come from rounding the first/
                      last row directly. */}
                  <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 [&>*:first-child]:rounded-t-2xl [&>*:last-child]:rounded-b-2xl">
                    {group.rows.map((row) => (
                      <div key={row.label} className="grid grid-cols-[168px_1fr_1fr_1fr] gap-3 items-center px-4 py-3.5">
                        {/* self-stretch + flex items-center: a plain <p> is
                            only as tall as its own text line (~20px), shorter
                            than the 24px check-circle/bar cells next to it —
                            since the row centers everything vertically, that
                            height gap let a couple of px of the circle peek
                            out above/below this cell's opaque white background
                            even though z-index correctly hid it left-to-right.
                            Stretching this cell to the row's full height
                            closes that gap. */}
                        <p className="self-stretch flex items-center text-sm text-gray-700 pr-2 sticky left-0 z-10 bg-white">{row.label}</p>
                        {'bars' in row
                          ? row.bars.map((b, i) => (
                              <div key={i} className="relative z-0 px-1 flex flex-col justify-center">
                                {row.showText !== false && (
                                  <p className="text-sm font-semibold text-gray-700 text-center mb-1.5">{b.text}</p>
                                )}
                                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                  <div className="h-full rounded-full bg-[#6B3FD9]" style={{ width: `${b.pct}%` }} />
                                </div>
                              </div>
                            ))
                          : row.values.map((v, i) => (
                              <div key={i} className="relative z-0 flex justify-center">
                                {v === true ? (
                                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                    <Check className="w-3.5 h-3.5" />
                                  </span>
                                ) : v === false ? (
                                  <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-300 flex items-center justify-center">
                                    <X className="w-3.5 h-3.5" />
                                  </span>
                                ) : v === 'Limited' ? (
                                  <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-2.5 py-1 rounded-full">
                                    Limited
                                  </span>
                                ) : (
                                  <span className="text-sm font-semibold text-gray-700">{v}</span>
                                )}
                              </div>
                            ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>


      {/* ── FAQ ── */}
      <section className="py-20 px-6 bg-[#F5F3EF]">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-12">
            Frequently asked questions
          </h2>
          <div className="space-y-2">
            {faqs.map((item, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left"
                >
                  <span className="text-gray-900 font-medium text-sm pr-4">{item.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-sm text-gray-500 leading-relaxed border-t border-gray-100 pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA — Paddle-style left-aligned ── */}
      <section className="py-28 md:py-36 px-6 bg-[#0B1121]">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-widest text-[#6B3FD9] mb-6">
              Start for free
            </p>
            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.04] tracking-tight mb-6">
              Ready to run your<br />business smarter?
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-10 max-w-lg">
              7 days free. No credit card. Every feature unlocked from day one —
              POS, invoicing, inventory, HR, appointments and more.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/register?plan=launch&billing=monthly"
                className="inline-flex items-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold px-8 py-4 rounded-2xl transition-all text-base"
              >
                Get started free <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 text-gray-300 hover:text-white font-semibold px-8 py-4 rounded-2xl border border-gray-700 hover:border-gray-500 transition-all text-base"
              >
                Book a demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

