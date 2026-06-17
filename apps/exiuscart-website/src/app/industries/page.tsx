'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';

const CARD_BG = '#EDEBE6';

const SHOPIFY_TABS = [
  {
    id: 'shopify',
    label: 'Shopify',
    headline: 'Back-office for your\nShopify store',
    desc: "Already selling on Shopify? ExiusCart gives you the back-office layer Shopify doesn't — inventory control, staff management, VAT invoicing, and detailed reports all in one place.",
    features: ['Sync and manage Shopify orders', 'Real-time inventory tracking', 'VAT-compliant invoicing', 'Staff roles & permissions', 'Sales reports & analytics'],
  },
  {
    id: 'custom',
    label: 'Custom Website',
    headline: 'Back-office for your\nown website',
    desc: "Running your own custom-built store? ExiusCart connects your online orders with a powerful back-office — manage products, orders, customers, and finances from one dashboard.",
    features: ['Centralized order management', 'Product & inventory control', 'Customer database & history', 'Automated invoicing & receipts', 'Revenue & profit reports'],
  },
];

const OTHER_INDUSTRIES = [
  {
    id: 'retail',
    label: 'Physical Retail Shop',
    headline: 'The POS built for\nwalk-in stores',
    desc: 'Fast checkout, inventory management, and VAT-compliant invoicing for any physical retail store — from a single counter to multiple branches.',
    features: ['POS & fast checkout', 'Real-time inventory', 'VAT invoicing', 'Multiple payment methods', 'Multi-branch support'],
    image: '/Industry/Physical Retail Shop.png',
  },
  {
    id: 'fashion',
    label: 'Fashion & Clothing',
    headline: 'Variants, loyalty, and\nstyle — all managed',
    desc: 'Handle size and color variants, track customer preferences, run loyalty programs, and manage returns for boutiques and clothing stores.',
    features: ['Size & color variants', 'Customer loyalty programs', 'Style catalog management', 'Return & exchange tracking', 'Sales per product/variant'],
    image: '/Industry/Fashion & Clothing.png',
  },
  {
    id: 'electronics',
    label: 'Electronics & Mobile',
    headline: 'Serial tracking,\nwarranties, repairs',
    desc: 'Track IMEI and serial numbers, manage warranties, log repair jobs, and handle accessories inventory for mobile and electronics shops.',
    features: ['Serial/IMEI tracking', 'Warranty management', 'Repair job tracking', 'Accessories inventory', 'Supplier purchase orders'],
    image: '/Industry/Electronics & Mobile.png',
  },
  {
    id: 'grocery',
    label: 'Grocery & Supermarket',
    headline: 'Fast checkout and\nsmart stock alerts',
    desc: 'Barcode scanning, expiry date tracking, and automated stock alerts designed for grocery stores, mini marts, and supermarkets.',
    features: ['Barcode scanning', 'Expiry date tracking', 'Low stock alerts', 'Supplier management', 'Weight-based pricing'],
    image: '/Industry/Grocery Supermarket.png',
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    headline: 'Expiry dates and\nbatch tracking handled',
    desc: 'Manage batch numbers, track expiry dates, get low-stock alerts, and handle controlled items for pharmacies and medical stores.',
    features: ['Batch number tracking', 'Expiry date management', 'Low stock alerts', 'Controlled item handling', 'Supplier purchase orders'],
    image: '/Industry/Pharmacy.png',
  },
  {
    id: 'hardware',
    label: 'Hardware Store',
    headline: 'Bulk pricing and\ncontractor accounts',
    desc: 'Bulk pricing tiers, contractor account management, large-SKU inventory, and purchase orders for hardware and building material stores.',
    features: ['Bulk pricing tiers', 'Contractor accounts', 'Large SKU inventory', 'Purchase orders', 'Supplier management'],
    image: '/Industry/Hardware.png',
  },
];

function SectionLabel({ num, tag }: { num: string; tag: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-7 h-7 rounded-lg bg-[#6B3FD9]/15 border border-[#6B3FD9]/30 flex items-center justify-center text-[11px] font-bold text-[#6B3FD9] tabular-nums">
        {num}
      </span>
      <span className="text-xs font-semibold uppercase tracking-widest text-[#6B3FD9]">{tag}</span>
    </div>
  );
}

export default function IndustriesPage() {
  const [activeTab, setActiveTab] = useState('shopify');
  const tab = SHOPIFY_TABS.find(t => t.id === activeTab)!;

  return (
    <div className="min-h-screen bg-[#0B1121]">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 text-center">
        <span className="inline-block text-xs font-semibold tracking-widest text-[#6B3FD9] bg-[#6B3FD9]/10 px-3 py-1.5 rounded-full mb-8 uppercase">
          8 Industries · One Platform
        </span>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight mb-6">
          Built for your<br />
          <span style={{ color: '#6B3FD9' }}>type of business.</span>
        </h1>
        <p className="text-base md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          One platform. Any niche. ExiusCart adapts to how your business actually works.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold px-8 py-4 rounded-xl transition-all"
        >
          Start Free Trial <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* ── Section 1: Online Marketplace ── */}
      <section className="px-4 sm:px-8 pb-6">
        <div className="max-w-7xl mx-auto">
          {/* Section title */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <SectionLabel num="01" tag="Online Marketplace" />
              <h2 className="mt-3 text-2xl md:text-3xl lg:text-[2.2rem] font-bold text-white leading-tight">
                Sell online with full<br className="hidden sm:block" /> multi-vendor control
              </h2>
            </div>
            <p className="text-gray-400 text-sm max-w-xs leading-relaxed sm:text-right shrink-0">
              One dashboard. Every seller, order,<br className="hidden sm:block" /> and invoice — managed together.
            </p>
          </div>
          {/* Card */}
          <div className="rounded-3xl overflow-hidden grid lg:grid-cols-2" style={{ background: CARD_BG }}>
            <div className="flex flex-col justify-center px-8 py-12 lg:px-14 lg:py-16">
              <h3 className="font-bold text-gray-900 leading-[1.15] mb-5 text-2xl lg:text-[2.2rem] whitespace-pre-line">
                {'Run your marketplace\nthe right way'}
              </h3>
              <p className="text-[15px] text-gray-600 leading-relaxed mb-6">
                Managing multiple vendors, syncing orders, and keeping every seller&apos;s inventory accurate is complex. ExiusCart gives marketplace operators one dashboard to control it all.
              </p>
              <ul className="space-y-2 mb-8">
                {['Multi-vendor seller management', 'Order sync across all sellers', 'Per-seller inventory tracking', 'Automated invoicing & receipts', 'Revenue reporting per seller'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-gray-700 text-[13px]">
                    <Check className="w-3.5 h-3.5 text-[#6B3FD9] flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-900 font-semibold px-5 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 transition-all text-sm shadow-sm self-start"
              >
                Get Started <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="relative min-h-[280px] lg:min-h-0">
              <Image
                src="/Industry/Online Market place.png"
                alt="Online Marketplace"
                fill
                className="object-cover object-center"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Shopify & Custom Website ── */}
      <section className="px-4 sm:px-8 pb-6 pt-12">
        <div className="max-w-7xl mx-auto">
          {/* Section title */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <SectionLabel num="02" tag="Shopify & Custom Website" />
              <h2 className="mt-3 text-2xl md:text-3xl lg:text-[2.2rem] font-bold text-white leading-tight">
                Your website, backed by<br className="hidden sm:block" /> a powerful operations layer
              </h2>
            </div>
            <p className="text-gray-400 text-sm max-w-xs leading-relaxed sm:text-right shrink-0">
              Whether you&apos;re on Shopify or built<br className="hidden sm:block" /> custom — ExiusCart runs the back end.
            </p>
          </div>
          {/* Card */}
          <div className="rounded-3xl overflow-hidden grid lg:grid-cols-2" style={{ background: CARD_BG }}>
            <div className="flex flex-col justify-center px-8 py-12 lg:px-14 lg:py-16">
              {/* Tab switcher */}
              <div className="inline-flex bg-black/10 border border-black/10 rounded-lg p-0.5 mb-6 self-start">
                {SHOPIFY_TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      activeTab === t.id
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <h3 className="font-bold text-gray-900 leading-[1.15] mb-5 text-2xl lg:text-[2.2rem] whitespace-pre-line">
                {tab.headline}
              </h3>
              <p className="text-[15px] text-gray-600 leading-relaxed mb-6">{tab.desc}</p>
              <ul className="space-y-2 mb-8">
                {tab.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-gray-700 text-[13px]">
                    <Check className="w-3.5 h-3.5 text-[#6B3FD9] flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-900 font-semibold px-5 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 transition-all text-sm shadow-sm self-start"
              >
                Get Started <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="relative min-h-[280px] lg:min-h-0">
              <Image
                src="/Industry/Shopify and Custom Website.png"
                alt="Shopify & Custom Website"
                fill
                className="object-cover object-center"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: Sticky card stack ── */}
      <div className="pt-12">
        {/* Section title — outside the sticky container so it scrolls away */}
        <div className="px-4 sm:px-8 pb-8">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <SectionLabel num="03" tag="More Industries" />
              <h2 className="mt-3 text-2xl md:text-3xl lg:text-[2.2rem] font-bold text-white leading-tight">
                Works for every kind<br className="hidden sm:block" /> of physical business
              </h2>
            </div>
            <p className="text-gray-400 text-sm max-w-xs leading-relaxed sm:text-right shrink-0">
              Retail, pharmacy, grocery, hardware<br className="hidden sm:block" /> — ExiusCart handles them all.
            </p>
          </div>
        </div>

        <div style={{ height: `${(OTHER_INDUSTRIES.length + 1) * 100}vh` }}>
          {OTHER_INDUSTRIES.map((ind, i) => (
            <div
              key={ind.id}
              className="sticky top-0 h-screen px-3 sm:px-5 lg:px-8"
              style={{ zIndex: i + 1, paddingTop: '64px', paddingBottom: '10px' }}
            >
              <div
                className="w-full h-full max-w-7xl mx-auto rounded-2xl lg:rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row"
                style={{ background: CARD_BG }}
              >
                {/* Text panel */}
                <div className="shrink-0 flex flex-col justify-center px-6 py-5 lg:p-10 xl:p-14 lg:w-[40%]">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-3 lg:mb-4">
                    {String(i + 1).padStart(2, '0')}&nbsp;/&nbsp;{OTHER_INDUSTRIES.length}
                    &nbsp;·&nbsp;{ind.label}
                  </span>

                  <h2 className="font-bold text-gray-900 leading-[1.15] mb-3 lg:mb-5 whitespace-pre-line text-xl sm:text-2xl lg:text-[2.1rem] xl:text-[2.4rem]">
                    {ind.headline}
                  </h2>

                  <p className="text-[13px] lg:text-[15px] text-gray-600 leading-relaxed mb-4 lg:mb-6">
                    {ind.desc}
                  </p>

                  <ul className="space-y-2 mb-5 lg:mb-8">
                    {ind.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-gray-700 text-[13px]">
                        <Check className="w-3.5 h-3.5 text-[#6B3FD9] flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* Progress dots */}
                  <div className="flex flex-wrap gap-1 mb-5 lg:mb-8">
                    {OTHER_INDUSTRIES.map((_, j) => (
                      <div
                        key={j}
                        className="h-[3px] rounded-full transition-all"
                        style={{
                          width: j === i ? '24px' : '5px',
                          background: j === i ? '#111827' : '#ccc9c0',
                        }}
                      />
                    ))}
                  </div>

                  <div>
                    <Link
                      href="/register"
                      className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-900 font-semibold px-5 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 transition-all text-sm shadow-sm"
                    >
                      Get Started <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Image panel */}
                <div className="relative overflow-hidden flex-1">
                  <Image
                    src={ind.image}
                    alt={ind.label}
                    fill
                    className="object-cover object-center"
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    priority={i === 0}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <section className="py-20 px-4 bg-[#0B1121]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Whatever your business — ExiusCart fits.
          </h2>
          <p className="text-gray-400 mb-10">Start your free 14-day trial. No credit card required.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold px-8 py-4 rounded-xl transition-all">
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/contact" className="inline-flex items-center justify-center gap-2 bg-transparent hover:bg-white/5 text-white font-semibold px-8 py-4 rounded-xl transition-all border border-gray-700">
              Talk to Us
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
