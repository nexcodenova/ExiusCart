import Link from 'next/link';
import Image from 'next/image';
import {
  Search, TrendingUp, LayoutGrid, Link2, Sparkles, ShieldCheck,
  ArrowRight, Flame, Package, DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/components/ui/accordion';
import Navbar from '@/components/layout/Navbar';
import HeroCTAButtons from '@/components/HeroCTAButtons';
import OpenLoginButton from '@/components/OpenLoginButton';

const STEPS = [
  {
    icon: Search,
    title: 'Find products',
    desc: 'Browse a constantly refreshed catalog of trending, ready-to-sell products across every category.',
    img: '/figma-assets/howitworks-step1-find-products.png',
  },
  {
    icon: Link2,
    title: 'Copy the supplier link',
    desc: 'Every product comes with a direct source link — no guesswork on where to fulfill from.',
    img: '/figma-assets/howitworks-step2-create-store.png',
  },
  {
    icon: Package,
    title: 'List & start selling',
    desc: 'Add it to your ExiusCart store in minutes and start taking orders the same day.',
    img: '/figma-assets/howitworks-step3-start-selling.png',
  },
];

const FEATURES = [
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
    icon: Sparkles,
    title: 'Fresh picks, regularly',
    desc: 'The catalog keeps getting new product picks so you’re never stuck browsing stale listings.',
  },
  {
    icon: ShieldCheck,
    title: 'Source links included',
    desc: 'No dead ends — every listing links straight to where you can fulfill it from.',
  },
];

const FAQS = [
  {
    q: 'What is Prodora?',
    a: 'Prodora is a winning-products discovery tool built into ExiusCart. It helps you find trending, ready-to-sell products — complete with supplier links — so you can list them on your own store fast.',
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
    q: 'Can I fulfill these products automatically?',
    a: 'Prodora gives you the supplier source link for each product. Automated fulfillment depends on the supplier — pair it with ExiusCart’s dropshipping integrations for a fully automated flow.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="container pt-14 pb-16 sm:pt-20 sm:pb-20">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            {/* Left column — copy */}
            <div className="max-w-xl">
              <Badge className="mb-6">Powered by ExiusCart</Badge>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.12]">
                Your #1 winning{' '}
                <span className="relative whitespace-nowrap text-primary">
                  product
                  <svg
                    className="absolute left-0 -bottom-1 w-full"
                    height="8"
                    viewBox="0 0 200 8"
                    fill="none"
                    preserveAspectRatio="none"
                  >
                    <path d="M1 5.5C40 2 160 1 199 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>{' '}
                research tool
              </h1>
              <p className="mt-6 text-lg text-muted-foreground">
                Browse trending, ready-to-sell products with supplier links included — then import
                the best products to your ExiusCart store in one click.
              </p>
              <HeroCTAButtons />
              <p className="mt-5 text-sm text-muted-foreground">
                Free for every ExiusCart seller &middot; No credit card required
              </p>
            </div>

            {/* Right column — floating product circle.
                Product images are placeholders from /figma-assets — swap for real Prodora products.
                Prices are illustrative sample data. */}
            <div className="relative hidden lg:block h-[520px]">
              {/* concentric rings */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full bg-primary/[0.03]" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] rounded-full border border-primary/10" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] h-[240px] rounded-full border border-primary/10" />

              {/* center logo badge */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg z-20">
                <Image src="/prodora-logo.png" alt="Prodora" width={32} height={32} className="brightness-0 invert" />
              </div>

              {/* product bubbles */}
              {[
                { img: '/figma-assets/hero-product-4.png', pos: 'top-2 right-16', size: 'w-28 h-28' },
                { img: '/figma-assets/hero-product-5.png', pos: 'top-24 left-4', size: 'w-32 h-32' },
                { img: '/figma-assets/hero-product-1.png', pos: 'bottom-16 left-10', size: 'w-28 h-28' },
                { img: '/figma-assets/hero-product-3.png', pos: 'bottom-6 right-24', size: 'w-24 h-24' },
                { img: '/figma-assets/hero-product-6.png', pos: 'top-8 left-1/2', size: 'w-20 h-20' },
              ].map((p, i) => (
                <div
                  key={i}
                  className={`absolute ${p.pos} ${p.size} rounded-full bg-white border border-border shadow-[0px_8px_30px_-8px_rgba(0,0,0,0.15)] flex items-center justify-center p-3 z-10`}
                >
                  <Image src={p.img} alt="Winning product" width={110} height={110} className="w-full h-full object-contain" />
                </div>
              ))}

              {/* floating price pills */}
              <div className="absolute top-16 right-0 rounded-xl bg-white border border-border shadow-md px-3 py-2 z-20">
                <p className="text-[10px] text-muted-foreground leading-none">Product cost</p>
                <p className="text-sm font-bold text-foreground leading-tight mt-0.5">$8.75</p>
              </div>
              <div className="absolute bottom-28 right-4 rounded-xl bg-white border border-border shadow-md px-3 py-2 z-20">
                <p className="text-[10px] text-muted-foreground leading-none">Selling price</p>
                <p className="text-sm font-bold text-foreground leading-tight mt-0.5">$34.99</p>
              </div>
              <div className="absolute bottom-10 left-0 rounded-xl bg-white border border-border shadow-md px-3 py-2 z-20">
                <p className="text-[10px] text-primary leading-none font-medium">Profit / sale</p>
                <p className="text-sm font-bold text-primary leading-tight mt-0.5">$26.24</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured In — PLACEHOLDER: swap in real logos when available, or remove this section if none exist yet ── */}
      <section className="border-t border-border">
        <div className="container py-10">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">
            As featured in
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-40">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-6 w-24 rounded bg-foreground/20" />
            ))}
          </div>
        </div>
      </section>

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
                  <Image
                    src={step.img}
                    alt={step.title}
                    width={480}
                    height={320}
                    className="w-full h-auto rounded-t-lg border border-b-0 border-border shadow-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
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
