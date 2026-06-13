import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';

const CARD_BG = '#EDEBE6';

const features = [
  {
    id: 'pos',
    label: 'Point of Sale',
    headline: 'Sell in-store and online\nfrom one screen',
    desc: 'Fast checkout, product search, discounts, and receipts. Works on any device — desktop, tablet, or phone.',
    desktop: '/Features/Point%20of%20Sale-desktop.png',
    mobile: '/Features/Point%20of%20Sale-mobile.png',
  },
  {
    id: 'inventory',
    label: 'Inventory Management',
    headline: 'Know your stock\nat all times',
    desc: 'Real-time stock tracking across all channels. Low stock alerts, variants, categories, and bulk imports.',
    desktop: '/Features/Inventory%20Management-desktop.png',
    mobile: '/Features/Inventory%20Management-mobile.png',
  },
  {
    id: 'invoicing',
    label: 'Invoicing',
    headline: 'VAT-compliant invoices,\nautomatically',
    desc: 'AED orders carry 5% UAE VAT. USD orders are 0% export. PDF-ready and FTA-compliant from day one.',
    desktop: '/Features/Invoicing-desktop.png',
    mobile: '/Features/Invoicing-mobile.png',
  },
  {
    id: 'orders',
    label: 'Orders',
    headline: 'Every channel.\nOne dashboard.',
    desc: 'Orders from TheDersi, Shopify, WooCommerce, or your own website — same structure, same statuses.',
    desktop: '/Features/Orders-desktop.png',
    mobile: '/Features/Orders-mobile.png',
  },
  {
    id: 'reports',
    label: 'Reports & Analytics',
    headline: 'Data that tells you\nwhat to do next',
    desc: 'Revenue trends, best-selling products, payment breakdowns, and channel performance.',
    desktop: '/Features/Reportst-desktop.png',
    mobile: '/Features/Reports-mobile.png',
  },
  {
    id: 'hr',
    label: 'HR & Payroll',
    headline: 'Manage your team\nwithout spreadsheets',
    desc: 'Employee records, payroll processing, leave requests, and attendance — all in one place.',
    desktop: '/Features/HR%20%26%20Payroll-desktop.png',
    mobile: '/Features/HR%20%26%20Payroll-mobile.png',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    headline: 'Reach your customers\nwhere they are',
    desc: 'Email campaigns, SMS blasts, and events. Track opens, clicks, and responses from ExiusCart.',
    desktop: '/Features/Marketing-desktop.png',
    mobile: '/Features/Marketing-mobile.png',
  },
  {
    id: 'expenses',
    label: 'Expenses & Purchases',
    headline: 'Track every dirham\ngoing in and out',
    desc: 'Log expenses, manage purchase orders, match against revenue. Know your real profit.',
    desktop: '/Features/Expenses%20and%20purchases-desktop.png',
    mobile: '/Features/Expenses%20and%20purchases-mobile.png',
  },
  {
    id: 'helpdesk',
    label: 'Helpdesk & Appointments',
    headline: 'Support and bookings,\nboth handled here',
    desc: 'Log customer issues, assign to staff. Let customers book appointments. All tracked in one place.',
    desktop: '/Features/Helpdesk%20and%20Appointments-desktop.png',
    mobile: '/Features/Helpdesk%20and%20Appointments-mobile.png',
  },
  {
    id: 'channels',
    label: 'Sales Channels',
    headline: 'Connect once.\nSell everywhere.',
    desc: 'Link TheDersi, Shopify, WooCommerce, or a custom website. Orders sync in real time.',
    desktop: '/Features/Sales%20Channels-desktop.png',
    mobile: '/Features/Sales%20Channels-mobile.png',
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-[#0B1121]">
      <Navbar />

      {/* ── Hero ── */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <span className="inline-block text-xs font-semibold tracking-widest text-[#6B3FD9] bg-[#6B3FD9]/10 px-3 py-1.5 rounded-full mb-8 uppercase">
            10 Feature Areas · One Platform
          </span>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight mb-6">
            Everything your<br />
            <span style={{ color: '#6B3FD9' }}>business needs.</span>
          </h1>
          <p className="text-base md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            From your first sale to your tenth employee — ExiusCart grows with you.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold px-8 py-4 rounded-xl transition-all"
            >
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 text-gray-300 hover:text-white font-medium px-8 py-4 rounded-xl border border-gray-700 hover:border-gray-500 transition-all"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-10 px-6 border-y border-gray-800">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { n: '10+', label: 'Built-in modules' },
            { n: '14 days', label: 'Free trial, no card' },
            { n: 'AED & USD', label: 'Multi-currency' },
            { n: '5% / 0%', label: 'Auto VAT' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-2xl md:text-3xl font-bold text-white mb-1">{s.n}</p>
              <p className="text-xs md:text-sm text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          Paddle-style sticky card stack — works on ALL screen sizes

          CSS mechanism (zero JS):
          • Each card: position sticky; top 0; height 100vh; z-index i+1
          • Card N stays locked at top while Card N+1 RISES from below
            and physically COVERS it — exactly like stacking papers
          • Container = (N+1)×100vh so last card has full dwell time
      ════════════════════════════════════════════════════════════ */}
      <div style={{ height: `${(features.length + 1) * 100}vh` }}>
        {features.map((feat, i) => (
          <div
            key={feat.id}
            className="sticky top-0 h-screen px-3 sm:px-5 lg:px-8"
            style={{
              zIndex: i + 1,
              paddingTop: '64px',
              paddingBottom: '10px',
            }}
          >
            {/* ── Cream card ── */}
            <div
              className="w-full h-full max-w-7xl mx-auto rounded-2xl lg:rounded-3xl overflow-hidden shadow-2xl
                         flex flex-col lg:flex-row"
              style={{ background: CARD_BG }}
            >

              {/* ── Text panel ──
                  Mobile: fixed height strip at top
                  Desktop: left column 38% wide */}
              <div className="
                shrink-0 flex flex-col justify-center
                px-6 py-5 lg:p-10 xl:p-14
                lg:w-[38%]
              ">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-3 lg:mb-5">
                  {String(i + 1).padStart(2, '0')}&nbsp;/&nbsp;{features.length}
                  &nbsp;·&nbsp;{feat.label}
                </span>

                <h2 className="
                  font-bold text-gray-900 leading-[1.15] mb-3 lg:mb-5 whitespace-pre-line
                  text-xl sm:text-2xl lg:text-[2.1rem] xl:text-[2.5rem]
                ">
                  {feat.headline}
                </h2>

                <p className="text-[13px] lg:text-[15px] text-gray-600 leading-relaxed mb-4 lg:mb-8">
                  {feat.desc}
                </p>

                {/* Progress dots */}
                <div className="flex flex-wrap gap-[4px] mb-4 lg:mb-8">
                  {features.map((_, j) => (
                    <div
                      key={j}
                      className="h-[3px] rounded-full"
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
                    className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-900 font-semibold px-4 py-2 lg:px-5 lg:py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 transition-all text-xs lg:text-sm shadow-sm"
                  >
                    Discover {feat.label} <ArrowRight className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                  </Link>
                </div>
              </div>

              {/* ── Screenshot panel ──
                  Mobile: fills remaining vertical space
                  Desktop: right column, flex-1 */}
              <div className="relative overflow-hidden flex-1">
                {/* Desktop screenshot */}
                <div className="absolute inset-0 top-4 left-4 lg:top-8 lg:left-6 right-0 rounded-tl-xl lg:rounded-tl-2xl overflow-hidden shadow-xl">
                  <Image
                    src={feat.desktop}
                    alt={feat.label}
                    fill
                    className="object-cover object-left-top"
                    sizes="(max-width: 1024px) 100vw, 62vw"
                    priority={i < 2}
                  />
                </div>

                {/* Mobile screenshot — hide on small phones, show on lg+ */}
                <div
                  className="hidden lg:block absolute bottom-0 left-0 rounded-t-2xl overflow-hidden shadow-xl"
                  style={{
                    width: '22%',
                    aspectRatio: '9/19',
                    border: `3px solid ${CARD_BG}`,
                  }}
                >
                  <Image
                    src={feat.mobile}
                    alt={`${feat.label} mobile`}
                    fill
                    className="object-cover object-top"
                    sizes="15vw"
                  />
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>

      {/* ── CTA — Paddle homepage style ── */}
      <section className="px-6 py-24 md:py-36" style={{ background: '#0f1117' }}>
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-[#6B3FD9] uppercase tracking-widest mb-6">
              Start for free
            </p>
            <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight mb-6">
              Take the hassle out of<br />
              running your business.
            </h2>
            <p className="text-lg md:text-xl text-gray-500 leading-relaxed mb-10 max-w-xl">
              ExiusCart handles your POS, inventory, invoicing, HR, and more —
              so you can focus on selling. 14 days free, no credit card.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold px-8 py-4 rounded-2xl transition-all text-base"
              >
                Get started free <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 text-gray-300 hover:text-white font-semibold px-8 py-4 rounded-2xl border border-gray-700 hover:border-gray-500 transition-all text-base"
              >
                View pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
