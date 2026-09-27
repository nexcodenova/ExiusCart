import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import {
  Search, TrendingUp, LayoutGrid, Link2, Sparkles, ShieldCheck,
  ArrowRight, Flame, Package, DollarSign, PackagePlus, Truck, RefreshCw, PackageCheck,
} from 'lucide-react';

// Deliberately only `alternates` here — every other field (title, description,
// openGraph, twitter) inherits from the root layout untouched, since this
// object doesn't redeclare them. See layout.tsx's note on why redeclaring
// openGraph here would silently replace the whole thing instead of merging.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

// Real fulfillment flow, not illustrative — matches how the CJ/AliExpress/
// Printful dropship pipeline actually works once a product is imported
// from Prodora: ExiusCart auto-places the order with whichever supplier
// the seller connected, then syncs tracking/status back automatically.
const FULFILLMENT_STEPS = [
  { icon: PackagePlus, title: 'Import', desc: 'One click sends the product into your ExiusCart store, ready to sell.' },
  { icon: Truck, title: 'Auto-fulfillment', desc: 'A customer orders — ExiusCart places it with your connected supplier automatically.' },
  { icon: RefreshCw, title: 'Status sync', desc: 'Tracking number and delivery status sync back with no manual follow-up.' },
  { icon: PackageCheck, title: 'Delivered', desc: "Your customer gets their order. You never touch the product." },
];
import { Button } from '@/components/ui/button';
import SellerReviews from '@/components/SellerReviews';
import { Badge } from '@/components/ui/badge';
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/components/ui/accordion';
import Navbar from '@/components/layout/Navbar';
import HeroPaths from '@/components/HeroPaths';
import OpenLoginButton from '@/components/OpenLoginButton';
import { IntegrationsGrid } from '@/components/ui/integrations-grid';
import AiHeroPreview from '@/components/AiHeroPreview';
import ProdoraAiSection from '@/components/ProdoraAiSection';

// The pictures live in /public/how-it-works. Step 3 has no picture: it shows
// the real order flow instead (see ORDER_FLOW).
const STEPS = [
  {
    title: 'Find products',
    desc: 'Browse trending, ready-to-sell products with the supplier cost and your profit shown up front.',
    img: { src: '/how-it-works/find-products.png', w: 1536, h: 1024 },
  },
  {
    title: 'Import in one click',
    desc: 'One click adds the product to your ExiusCart store, with images, price and description ready to sell.',
    img: { src: '/how-it-works/how-it-works.png', w: 1672, h: 941 },
  },
  {
    title: 'Orders fulfil themselves',
    desc: 'A customer orders and ExiusCart places it with your connected supplier and syncs the tracking back. You never touch the product.',
    img: null,
  },
];

const ORDER_FLOW = [
  { icon: PackagePlus, label: 'Customer places an order' },
  { icon: Truck, label: 'Sent to your supplier automatically' },
  { icon: RefreshCw, label: 'Tracking syncs back to your store' },
  { icon: PackageCheck, label: 'Delivered to your customer' },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Prodora AI',
    desc: 'Ask for products in plain words. Every result comes with real scores and a verdict, then launch it in a click. Growth and Scale.',
  },
  {
    icon: Flame,
    title: 'Trending Now',
    desc: 'See what’s actually gaining momentum right now, not last season’s picks.',
  },
  {
    icon: LayoutGrid,
    title: 'Browse by category',
    desc: 'Filter down to exactly the niche you sell in instead of scrolling everything.',
  },
  {
    icon: Search,
    title: 'Instant search',
    desc: 'Find a specific product idea in seconds with fast, live search.',
  },
  {
    icon: DollarSign,
    title: 'Free for ExiusCart sellers',
    desc: 'No separate subscription — Prodora is bundled with your ExiusCart account.',
  },
  {
    icon: ShieldCheck,
    title: 'Profit shown up front',
    desc: 'Supplier cost, selling price and your profit on every product, before you import it.',
  },
];

const FAQS = [
  {
    q: 'What is Prodora AI?',
    a: 'Prodora AI is a product finder built for dropshipping. You describe what you want to sell in plain words, for example "kitchen gadgets under $25", and it returns matching products with real margin, competition and shipping scores and a clear verdict. Then Launch with ExiusCart brings the product into your store as a private draft, priced from the market, with a title and description written for it.',
  },
  {
    q: 'Which plans include Prodora AI, and what does it cost?',
    a: 'Prodora AI is included with the Growth and Scale plans, with no extra fee. Product research on Prodora itself is free with every ExiusCart plan.',
  },
  {
    q: 'How is Prodora AI different from asking a general chatbot?',
    a: 'A general chatbot can only talk. Prodora AI searches our catalogue of real products with real supplier costs, works out the scores from real market prices, and connects straight to your ExiusCart store. If we cannot measure something, such as TikTok potential, it says Not measured instead of inventing a number.',
  },
  {
    q: 'What is Prodora?',
    a: 'Prodora is a winning-products discovery tool built into ExiusCart. It helps you find trending, ready-to-sell products, with the supplier cost and your profit shown up front, so you can import them into your own store in one click.',
  },
  {
    q: 'Do I need a separate account for Prodora?',
    a: 'No. Prodora is bundled with your existing ExiusCart account — there’s nothing extra to sign up for.',
  },
  {
    q: 'How often are new products added?',
    a: 'The catalog is refreshed regularly with new trending picks across categories, so there’s always something new to discover.',
  },
  {
    q: 'Are orders fulfilled automatically?',
    a: 'Yes. Import a product, connect your supplier in ExiusCart, and each customer order is placed with the supplier automatically. Tracking and delivery status sync back to your store, so there is nothing to copy or paste.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ── Hero: leads with Prodora AI, with an honest EXAMPLE of what an answer looks like ── */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-gradient-to-b from-primary/[0.08] via-primary/[0.03] to-transparent" />
        <div className="container pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pt-20">
          <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
            <div className="min-w-0 text-center lg:text-left">
              <Badge className="mb-6 gap-1.5"><Sparkles className="h-3.5 w-3.5" /> New: Prodora AI</Badge>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                Your #1 winning <span className="text-primary">product research</span> &amp; auto-fulfillment tool
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground lg:mx-0">
                Browse trending products with the supplier cost and your profit shown up front, or just ask Prodora AI
                in plain words. Either way, launch it in your ExiusCart store in one click and sell everywhere.
              </p>
              <HeroPaths />
              <p className="mt-5 text-sm text-muted-foreground">
                Product research is free on every ExiusCart plan &middot; Prodora AI comes with Growth and Scale
              </p>
            </div>
            <AiHeroPreview />
          </div>
        </div>
      </section>

      <ProdoraAiSection />

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="border-t border-border bg-card">
        <div className="container py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground">How it works</h2>
            <p className="mt-3 text-muted-foreground">From discovery to your first sale, in three steps.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="rounded-lg border border-border bg-black/[0.02] overflow-hidden flex flex-col"
              >
                <div className="p-8 pb-5">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mb-4 text-xl font-bold">
                    {i + 1}
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">{step.title}</h3>
                  <p className="text-[15px] leading-relaxed text-muted-foreground">{step.desc}</p>
                </div>
                <div className="mt-auto px-8 pt-2">
                  {/* Same 3:2 frame for every step, so the three cards line up. */}
                  <div className="relative aspect-[3/2] overflow-hidden rounded-t-lg border border-b-0 border-border bg-white shadow-sm">
                    {step.img ? (
                      <Image
                        src={step.img.src}
                        alt={step.title}
                        width={step.img.w}
                        height={step.img.h}
                        sizes="(max-width: 640px) 90vw, 420px"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ol className="flex h-full flex-col justify-center gap-2 px-5">
                        {ORDER_FLOW.map((f) => (
                          <li key={f.label} className="flex items-center gap-2.5 rounded-lg bg-primary/5 px-3 py-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <f.icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="text-[13px] font-semibold leading-tight text-foreground">{f.label}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Order automation — what happens after a sale. Icon-based, not
          fake screenshots: no real UI capture of this flow exists yet, so
          this stays honest about what it is rather than fabricating one. ── */}
      <section className="container py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground">Fulfillment runs itself</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Once a product's imported, ExiusCart handles the rest — from order to delivery.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FULFILLMENT_STEPS.map((step, i) => (
            <div key={step.title} className="relative rounded-2xl border border-border bg-card p-6">
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <step.icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-foreground mb-1.5">{i + 1}. {step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              {i < FULFILLMENT_STEPS.length - 1 && (
                <ArrowRight className="hidden lg:block absolute top-1/2 -right-3 -translate-y-1/2 w-5 h-5 text-border" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Every channel, one hub — copied from exiuscart.com's homepage
          on request (2026-08-31), same IntegrationsGrid component/images,
          reworded for Prodora's own side: the point here is showing what
          you plug into once you list through Prodora — ExiusCart itself,
          then every channel it reaches. ── */}
      <section className="bg-[#F5F3EF]">
        <div className="hidden sm:block pt-20 lg:pt-24 pb-10 px-6 text-center max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6B3FD9] mb-5">
            Connected everywhere
          </p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 leading-[1.05] tracking-tight mb-6">
            Source here,<br />sell anywhere using ExiusCart.
          </h2>
          <p className="text-gray-500 text-lg leading-relaxed">
            Prodora and ExiusCart at the center — every marketplace and channel around them stays in sync automatically.
          </p>
        </div>

        <IntegrationsGrid />
      </section>

      {/* ── Feature grid ─────────────────────────────────────────────── */}
      <section className="container py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground">
            Everything you need to find winners
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Built for ExiusCart sellers who want to move fast without guessing.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(f => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-6 hover:shadow-md hover:border-primary/30 transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-foreground mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <SellerReviews />

      {/* ── Pricing (simple, honest — free) ──────────────────────────── */}
      <section id="pricing" className="border-t border-border bg-card">
        <div className="container py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground">Pricing</h2>
            <p className="mt-3 text-muted-foreground">Simple, because it’s already included.</p>
          </div>
          <div className="mx-auto max-w-sm rounded-2xl border-2 border-primary bg-background p-8 text-center shadow-sm">
            <TrendingUp className="w-8 h-8 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold text-foreground">Prodora</h3>
            <p className="mt-2 text-4xl font-extrabold text-foreground">
              Free
              <span className="text-base font-medium text-muted-foreground"> with ExiusCart</span>
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Every ExiusCart seller gets full access to Prodora at no extra cost.
            </p>
            <OpenLoginButton size="lg" className="mt-6 w-full">Get Started Free</OpenLoginButton>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="container py-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground">Frequently asked questions</h2>
        </div>
        <div className="mx-auto max-w-2xl">
          <Accordion type="single" collapsible>
            {FAQS.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger>{f.q}</AccordionTrigger>
                <AccordionContent>{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── CTA band ─────────────────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="container py-16">
          <div className="rounded-3xl bg-gradient-to-br from-primary to-sky-400 px-6 py-14 sm:py-16 text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Ready to find your next winning product?
            </h2>
            <p className="mt-3 text-sky-50 max-w-md mx-auto">
              It’s already included in your ExiusCart account — start browsing now.
            </p>
            <OpenLoginButton size="lg" variant="secondary" className="mt-7">
              Browse Products <ArrowRight className="w-4 h-4" />
            </OpenLoginButton>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="container py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Image src="/prodora-logo.png" alt="Prodora" width={22} height={22} />
            <span className="font-semibold text-foreground">Prodora by ExiusCart</span>
          </div>
          <p>&copy; {new Date().getFullYear()} Fairam Private Limited. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
