import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Check, Star, Quote, ShoppingCart, Boxes, FileText, Package, BarChart3, Users, Megaphone, Wallet, Truck, Headphones, Calendar, Shield } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { PricingPreview } from '@/components/ui/pricing-preview';
import { PromoBanner } from '@/components/ui/promo-banner';
import { LiveStats } from '@/components/ui/live-stats';

export const metadata: Metadata = {
  title: 'ExiusCart - Smart Business Management for Small Shops | POS, Invoicing & Inventory',
  description: 'All-in-one business solution for UAE shops. Create VAT invoices, track inventory, manage orders. Affordable pricing starting from AED 45/month.',
  openGraph: {
    title: 'ExiusCart - Smart Business Management for Small Shops',
    description: 'All-in-one business solution for UAE shops. POS, invoicing, inventory & order management.',
    url: 'https://exiuscart.com',
    siteName: 'ExiusCart',
    type: 'website',
  },
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0B1121]">
      <Navbar />

      {/* Hero Section — desktop uses landscape, mobile uses portrait image */}
      <section
        className="relative w-full flex"
        style={{
          marginTop: '64px',
          height: 'calc(100vh - 64px)',
          backgroundColor: '#04060f',
        }}
      >
        {/* Desktop background (lg+) */}
        <div className="absolute inset-0 hidden lg:block" style={{
          backgroundImage: 'url(/hero-blank.png)',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center center',
          backgroundSize: 'cover',
        }} />
        {/* Mobile background */}
        <div className="absolute inset-0 lg:hidden" style={{
          backgroundImage: 'url(/hero-mobile.png)',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center top',
          backgroundSize: 'cover',
        }} />

        {/* Desktop gradient overlay */}
        <div className="absolute inset-0 hidden lg:block" style={{ background: 'linear-gradient(90deg, rgba(4,6,15,0.93) 36%, rgba(4,6,15,0.15) 65%, transparent 100%)' }} />
        {/* Mobile gradient overlay */}
        <div className="absolute inset-0 lg:hidden" style={{ background: 'linear-gradient(180deg, rgba(4,6,15,0.92) 45%, rgba(4,6,15,0.2) 75%, transparent 100%)' }} />

        {/* Desktop text */}
        <div className="relative z-10 hidden lg:flex flex-col justify-center px-16 max-w-lg">
          <p className="text-white/50 text-sm font-medium tracking-widest uppercase mb-3">All-in-One</p>
          <h1 className="text-5xl xl:text-[3.25rem] font-bold leading-[1.1] mb-5">
            <span className="text-[#7B4FE9]">Business<br />Management</span>
            <br /><span className="text-white">Platform</span>
          </h1>
          <p className="text-gray-400 text-base leading-relaxed mb-8 max-w-sm">
            Invoicing, inventory, orders, marketing &amp; more — all in one place. Built for UAE &amp; worldwide small and medium businesses.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center justify-between gap-4 text-white font-bold px-6 py-4 rounded-xl transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-900/40 mb-4 self-start"
            style={{
              minWidth: '230px',
              background: 'linear-gradient(135deg, #7B4FE9 0%, #5A2EC9 60%, #4A1FB8 100%)',
              boxShadow: '0 4px 24px rgba(107,63,217,0.4)',
            }}
          >
            <span className="text-base">Start Free Trial</span>
            <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 border border-white/20">
              <ArrowRight className="w-5 h-5" />
            </span>
          </Link>
          <p className="text-gray-500 text-sm flex items-center gap-2">
            <span className="text-[#7B4FE9]">⊕</span>
            No credit card required &nbsp;•&nbsp; Cancel anytime
          </p>
        </div>

        {/* Mobile hero */}
        <div className="relative z-10 lg:hidden flex flex-col w-full pt-6 px-5">
          <div className="inline-flex items-center gap-2 self-start mb-6 px-4 py-2 rounded-full border border-[#7B4FE9]/50 bg-[#7B4FE9]/10">
            <span className="text-yellow-400 text-sm">★</span>
            <span className="text-white/80 text-sm font-medium">All-in-One Business Management</span>
          </div>
          <h1 className="text-[2.6rem] font-extrabold leading-[1.05] mb-4">
            <span className="text-white">Everything</span>
            <br />
            <span style={{ background: 'linear-gradient(90deg, #7B4FE9, #60A5FA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Your Business</span>
            <br />
            <span className="text-white">Needs,</span>
            <br />
            <span style={{ background: 'linear-gradient(90deg, #7B4FE9, #60A5FA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>In One Place.</span>
          </h1>
          <div className="h-[3px] w-48 rounded-full mb-5" style={{ background: 'linear-gradient(90deg, #7B4FE9, #60A5FA)' }} />
          <p className="text-gray-400 text-base leading-relaxed mb-7">
            Manage invoicing, inventory, orders,<br />marketing &amp; more — all in one platform.
          </p>
          <Link
            href="/register"
            className="flex items-center justify-between w-full text-white font-bold px-4 py-3.5 rounded-2xl mb-4 transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #6B3FD9 0%, #5A2EC9 100%)',
              boxShadow: '0 8px 32px rgba(107,63,217,0.5)',
            }}
          >
            <span className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-[#6B3FD9]" />
            </span>
            <span className="text-lg font-bold flex-1 text-center">Start Free Trial</span>
            <span className="w-10 h-10 rounded-full bg-white/20 border border-white/30 flex items-center justify-center flex-shrink-0">
              <ArrowRight className="w-5 h-5" />
            </span>
          </Link>
          <div className="flex items-center gap-2 mb-8">
            <span className="w-6 h-6 rounded-full bg-[#7B4FE9]/20 border border-[#7B4FE9]/40 flex items-center justify-center text-xs">✓</span>
            <span className="text-gray-400 text-sm">No credit card required &nbsp;•&nbsp; Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* Services App Icons Bar */}
      <section className="py-8 px-4 border-y border-gray-800/50 overflow-x-auto">
        <div className="flex items-center gap-6 min-w-max mx-auto px-2 justify-center">
          {[
            { icon: ShoppingCart, label: 'Point of Sale',  bg: 'bg-[#6B3FD9]' },
            { icon: Boxes,        label: 'Inventory',      bg: 'bg-[#16A34A]' },
            { icon: FileText,     label: 'Invoicing',      bg: 'bg-[#EA580C]' },
            { icon: Package,      label: 'Orders',         bg: 'bg-[#2563EB]' },
            { icon: BarChart3,    label: 'Reports',        bg: 'bg-[#0D9488]' },
            { icon: Users,        label: 'HR & Payroll',   bg: 'bg-[#DB2777]' },
            { icon: Megaphone,    label: 'Marketing',      bg: 'bg-[#D97706]' },
            { icon: Wallet,       label: 'Expenses',       bg: 'bg-[#7C3AED]' },
            { icon: Truck,        label: 'Purchases',      bg: 'bg-[#0369A1]' },
            { icon: Headphones,   label: 'Helpdesk',       bg: 'bg-[#059669]' },
            { icon: Calendar,     label: 'Appointments',   bg: 'bg-[#9333EA]' },
          ].map(({ icon: Icon, label, bg }) => (
            <div key={label} className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className={`w-12 h-12 ${bg} rounded-2xl flex items-center justify-center shadow-lg`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-gray-400 text-xs font-medium whitespace-nowrap">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features — Paddle-style cream section ── */}
      <section className="py-24 lg:py-32 px-6 bg-[#F5F3EF]">
        <div className="max-w-7xl mx-auto">

          {/* Split header: big title left · desc + CTA right */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-10 mb-16">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6B3FD9] mb-5">
                10+ built-in modules
              </p>
              <h2 className="text-5xl md:text-6xl lg:text-[4.5rem] font-black text-gray-900 leading-[1.03] tracking-tight">
                Every tool your<br className="hidden sm:block" /> business needs.
              </h2>
            </div>
            <div className="lg:max-w-sm">
              <p className="text-gray-500 text-lg leading-relaxed mb-7">
                Stop switching between 10 apps. ExiusCart handles your POS, invoicing,
                HR, marketing, and more — all in one platform built for real businesses.
              </p>
              <Link
                href="/features"
                className="inline-flex items-center gap-2 font-semibold text-gray-900 hover:text-[#6B3FD9] transition-colors group text-base"
              >
                Explore all features
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          {/* 12-feature grid — gap-px divider style */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-200 rounded-3xl overflow-hidden shadow-sm">
            {([
              { Icon: ShoppingCart, color: '#6B3FD9', name: 'Point of Sale',        desc: 'Fast checkout on any device. Products, discounts, receipts in seconds.' },
              { Icon: Boxes,        color: '#16A34A', name: 'Inventory',             desc: 'Real-time stock tracking, low-stock alerts, variants, and bulk import.' },
              { Icon: FileText,     color: '#EA580C', name: 'Invoicing',             desc: 'VAT-compliant PDF invoices. AED 5% or USD 0% export — auto-applied.' },
              { Icon: Package,      color: '#2563EB', name: 'Orders',                desc: 'All channels in one dashboard — Shopify, WooCommerce, or your own site.' },
              { Icon: BarChart3,    color: '#0D9488', name: 'Reports & Analytics',   desc: 'Revenue trends, best sellers, payment breakdowns, channel performance.' },
              { Icon: Calendar,     color: '#9333EA', name: 'Appointments',          desc: 'Let customers book slots. Full calendar view for your whole team.' },
              { Icon: Users,        color: '#DB2777', name: 'HR & Payroll',          desc: 'Employee records, payroll, leave requests, attendance — no spreadsheets.' },
              { Icon: Megaphone,    color: '#D97706', name: 'Marketing',             desc: 'Email campaigns, SMS blasts, Meta Ads lead capture and source tracking.' },
              { Icon: Wallet,       color: '#7C3AED', name: 'Expenses',              desc: 'Log business expenses and purchase orders. Know your real profit.' },
              { Icon: Headphones,   color: '#059669', name: 'Helpdesk',              desc: 'Log customer issues, assign to staff, set priorities, resolve fast.' },
              { Icon: Truck,        color: '#0369A1', name: 'Sales Channels',        desc: 'TheDersi, Shopify, WooCommerce, or custom site — orders sync live.' },
              { Icon: Shield,       color: '#6B3FD9', name: 'Multi-currency',        desc: 'AED and USD with automatic VAT handling and correct invoicing.' },
            ] as const).map(({ Icon, color, name, desc }) => (
              <div key={name} className="bg-[#F5F3EF] hover:bg-white p-8 transition-colors duration-200 group">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: color + '18', border: `1px solid ${color}30` }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <h3 className="font-bold text-gray-900 text-base mb-2 group-hover:text-[#6B3FD9] transition-colors">
                  {name}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── Why ExiusCart — dark feature + pricing split ── */}
      <section className="py-24 px-6 bg-[#0B1121]">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 xl:gap-24 items-center">

            {/* Left */}
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6B3FD9] mb-5">
                Built for worldwide businesses
              </p>
              <h2 className="text-4xl md:text-5xl font-black text-white leading-[1.08] tracking-tight mb-5">
                One platform.<br />Every business need.
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed mb-10 max-w-md">
                From your first sale to your tenth employee — stop switching between apps.
                ExiusCart replaces 10 separate tools with one connected platform.
              </p>

              {/* 6 feature highlights — 2-col grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  { Icon: ShoppingCart, color: '#6B3FD9', title: 'POS & Invoicing',      desc: 'VAT-compliant checkout on any device, AED or USD' },
                  { Icon: Boxes,        color: '#16A34A', title: 'Inventory',             desc: 'Real-time stock, low-stock alerts, bulk import' },
                  { Icon: Calendar,     color: '#9333EA', title: 'Appointments',          desc: 'Customer booking slots & full calendar for your team' },
                  { Icon: Users,        color: '#DB2777', title: 'HR & Payroll',          desc: 'Team, attendance, leave and payroll in one place' },
                  { Icon: Package,      color: '#2563EB', title: 'Sales Channels',        desc: 'Shopify, WooCommerce, TheDersi & custom sites' },
                  { Icon: BarChart3,    color: '#0D9488', title: 'Reports & Analytics',   desc: 'Revenue, best sellers, channel performance & export' },
                ] as const).map(({ Icon, color, title, desc }) => (
                  <div
                    key={title}
                    className="flex items-start gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/10 transition-all duration-200"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: color + '1a', border: `1px solid ${color}35` }}
                    >
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm mb-0.5">{title}</p>
                      <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Pricing Preview */}
            <PricingPreview />
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Trusted by Businesses Worldwide
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Real businesses running on ExiusCart — more success stories coming soon
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <TestimonialCard
              name="TheDersi"
              business="Sri Lankan Fashion Marketplace"
              location="Sri Lanka · #1 Fashion Platform"
              rating={5}
              text="TheDersi is Sri Lanka's leading fashion marketplace. Our sellers rely on ExiusCart to manage their products, inventory, and orders — all in one place. It has made running a multi-seller marketplace seamless and efficient."
              featured
            />
            <TestimonialCard
              name="North Veltrix"
              business="Premium Hoodie & Streetwear Brand"
              location="Shopify Store · Trending Brand"
              rating={5}
              text="Switched to ExiusCart and our inventory management became a breeze. We track every hoodie drop, manage stock across variants, and process orders faster than ever. It's exactly what a growing streetwear brand needs."
              featured
            />
          </div>

          <LiveStats />
        </div>
      </section>

      {/* CTA Section — Paddle cream style */}
      <section className="px-4 sm:px-8 py-6 bg-[#0B1121]">
        <div
          className="max-w-7xl mx-auto rounded-3xl px-10 py-20 lg:px-20 lg:py-24"
          style={{ background: '#EDEBE6' }}
        >
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-widest text-[#6B3FD9] mb-6 block">
              Start for free
            </span>
            <h2 className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold text-gray-900 leading-[1.08] tracking-tight mb-6">
              Take the hassle out of<br />running your business.
            </h2>
            <p className="text-gray-500 text-lg leading-relaxed mb-10">
              ExiusCart handles your POS, inventory, invoicing, HR, and more — so you
              can focus on selling. 14 days free, no credit card.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold px-8 py-4 rounded-xl transition-all text-base"
              >
                Get started free <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 font-semibold px-8 py-4 rounded-xl border border-gray-300 hover:border-gray-400 transition-all text-base bg-transparent"
              >
                View pricing
              </Link>
            </div>
            <p className="text-gray-400 text-sm mt-6">
              14-day free trial · No credit card required · Cancel anytime
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function TrustItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3">
      <Check className="w-5 h-5 text-[#6B3FD9] flex-shrink-0" />
      <div>
        <span className="text-white font-medium">{title}</span>
        <span className="text-gray-500 text-sm ml-2">{desc}</span>
      </div>
    </div>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="group">
      <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
      <p className="text-gray-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function BenefitRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <Check className="w-5 h-5 text-[#6B3FD9] flex-shrink-0" />
      <span className="text-gray-300">{text}</span>
    </div>
  );
}

function TestimonialCard({
  name,
  business,
  location,
  rating,
  text,
  featured,
}: {
  name: string;
  business: string;
  location: string;
  rating: number;
  text: string;
  featured?: boolean;
}) {
  return (
    <div className={`bg-[#151F32] rounded-2xl border p-6 relative ${featured ? 'border-[#6B3FD9]/40 shadow-lg shadow-[#6B3FD9]/10' : 'border-gray-800'}`}>
      <Quote className="absolute top-6 right-6 w-8 h-8 text-[#6B3FD9]/20" />

      {featured && (
        <div className="inline-flex items-center gap-1.5 bg-[#7B4FE9]/10 border border-[#7B4FE9]/30 text-[#7B4FE9] text-xs font-bold px-3 py-1 rounded-full mb-4">
          ✓ Verified Customer
        </div>
      )}

      {/* Rating */}
      <div className="flex gap-1 mb-4">
        {[...Array(rating)].map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-[#6B3FD9] text-[#6B3FD9]" />
        ))}
      </div>

      {/* Review Text */}
      <p className="text-gray-300 leading-relaxed mb-6">{text}</p>

      {/* Author */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#6B3FD9]/20 flex items-center justify-center">
          <span className="text-[#6B3FD9] font-semibold text-sm">
            {name.split(' ').map(n => n[0]).join('')}
          </span>
        </div>
        <div>
          <p className="text-white font-medium text-sm">{name}</p>
          <p className="text-gray-500 text-xs">{business} • {location}</p>
        </div>
      </div>
    </div>
  );
}

