import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight, ShoppingCart, Package, FileText, ShoppingBag,
  BarChart3, Users, Link2, Megaphone, Receipt, Truck,
  HeadphonesIcon, CalendarCheck, Briefcase,
} from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  title: 'Features | ExiusCart — Complete Business Management Platform',
  description: 'POS, Inventory, Invoicing, Orders, Reports, HR & Payroll, Marketing, Expenses, Purchases, Helpdesk, and Appointments — everything in one platform for UAE businesses.',
  openGraph: {
    title: 'ExiusCart Features — Everything Your Business Needs',
    description: 'POS, inventory, invoicing, HR, marketing, helpdesk and more. One platform built for UAE sellers.',
    url: 'https://exiuscart.com/features',
    siteName: 'ExiusCart',
    type: 'website',
  },
};

const features = [
  {
    id: 'pos',
    icon: <ShoppingCart className="w-6 h-6" />,
    color: 'text-[#6B3FD9] bg-[#6B3FD9]/10',
    label: 'Point of Sale',
    headline: 'Sell in-store and online from one screen',
    desc: 'Fast checkout, product search, discounts, and receipts. Works on any device — desktop, tablet, or phone. No dedicated hardware needed.',
    points: ['Fast product search & scan', 'Discounts & custom prices', 'Multiple payment methods', 'Instant receipt generation', 'Daily sales summary'],
  },
  {
    id: 'inventory',
    icon: <Package className="w-6 h-6" />,
    color: 'text-orange-400 bg-orange-500/10',
    label: 'Inventory',
    headline: 'Know your stock at all times',
    desc: 'Real-time stock tracking across all channels. Get alerts before you run out. Manage variants, categories, and bulk imports in minutes.',
    points: ['Real-time stock levels', 'Low stock alerts', 'Product variants & SKUs', 'Category management', 'Bulk CSV import/export'],
  },
  {
    id: 'invoicing',
    icon: <FileText className="w-6 h-6" />,
    color: 'text-emerald-400 bg-emerald-500/10',
    label: 'Invoicing',
    headline: 'VAT-compliant invoices, automatically',
    desc: 'AED orders carry 5% UAE VAT. USD orders are 0% (export rule). Invoices generate automatically — PDF-ready and FTA-compliant.',
    points: ['Auto 5% VAT on AED orders', '0% VAT on USD (export rule)', 'FTA-compliant PDF invoices', 'Custom invoice prefix', 'Send to customer by email'],
  },
  {
    id: 'orders',
    icon: <ShoppingBag className="w-6 h-6" />,
    color: 'text-sky-400 bg-sky-500/10',
    label: 'Orders',
    headline: 'Every channel. One dashboard.',
    desc: 'Orders from TheDersi, Shopify, WooCommerce, or your own website all land in the same place with the same structure and statuses.',
    points: ['Multi-channel order sync', 'TheDersi & Shopify live', 'Order status tracking', 'Customer order history', 'WooCommerce & more coming'],
  },
  {
    id: 'reports',
    icon: <BarChart3 className="w-6 h-6" />,
    color: 'text-violet-400 bg-violet-500/10',
    label: 'Reports',
    headline: 'Data that tells you what to do next',
    desc: 'Revenue trends, best-selling products, payment breakdowns, and channel performance. Filter by date, export to PDF or Excel.',
    points: ['Revenue & profit reports', 'Product performance', 'Channel comparison', 'Payment breakdown', 'PDF & Excel export'],
  },
  {
    id: 'hr',
    icon: <Briefcase className="w-6 h-6" />,
    color: 'text-pink-400 bg-pink-500/10',
    label: 'HR & Payroll',
    headline: 'Manage your team without spreadsheets',
    desc: 'Employee records, payroll processing, leave requests, and attendance tracking — all in one place so you stop managing people with WhatsApp messages.',
    points: ['Employee profiles & records', 'Payroll processing', 'Leave request management', 'Attendance tracking', 'Recruitment & job positions'],
  },
  {
    id: 'marketing',
    icon: <Megaphone className="w-6 h-6" />,
    color: 'text-yellow-400 bg-yellow-500/10',
    label: 'Marketing',
    headline: 'Reach your customers where they are',
    desc: 'Run email campaigns, SMS blasts, and events from your dashboard. Survey your customers. Track opens, clicks, and responses.',
    points: ['Email campaigns', 'SMS campaigns', 'Event management', 'Customer surveys', 'Response tracking'],
  },
  {
    id: 'expenses',
    icon: <Receipt className="w-6 h-6" />,
    color: 'text-red-400 bg-red-500/10',
    label: 'Expenses',
    headline: 'Track every dirham going out',
    desc: 'Log business expenses, categorise them, and match against your revenue. Know your real profit — not just your sales.',
    points: ['Expense logging', 'Category management', 'Receipt attachment', 'Profit vs expense view', 'Export for accounting'],
  },
  {
    id: 'purchases',
    icon: <Truck className="w-6 h-6" />,
    color: 'text-teal-400 bg-teal-500/10',
    label: 'Purchases',
    headline: 'Supplier orders, tracked end to end',
    desc: 'Create purchase orders, track delivery status, and update inventory automatically when stock arrives. Full supplier management included.',
    points: ['Supplier database', 'Purchase order creation', 'Delivery tracking', 'Auto inventory update', 'Purchase history'],
  },
  {
    id: 'helpdesk',
    icon: <HeadphonesIcon className="w-6 h-6" />,
    color: 'text-indigo-400 bg-indigo-500/10',
    label: 'Helpdesk',
    headline: 'Support tickets your whole team can manage',
    desc: 'Log and track customer issues. Assign tickets to staff, set priorities, and close them with a full audit trail. No more lost support messages.',
    points: ['Ticket creation & tracking', 'Staff assignment', 'Priority levels', 'Status updates', 'Full conversation history'],
  },
  {
    id: 'appointments',
    icon: <CalendarCheck className="w-6 h-6" />,
    color: 'text-cyan-400 bg-cyan-500/10',
    label: 'Appointments',
    headline: 'Bookings without the back-and-forth',
    desc: 'Let customers book appointments directly. Manage your calendar, confirm bookings, and send reminders — all from ExiusCart.',
    points: ['Appointment scheduling', 'Calendar management', 'Booking confirmations', 'Staff allocation', 'Reminder notifications'],
  },
  {
    id: 'channels',
    icon: <Link2 className="w-6 h-6" />,
    color: 'text-[#6B3FD9] bg-[#6B3FD9]/10',
    label: 'Sales Channels',
    headline: 'Connect your storefronts',
    desc: 'Link TheDersi, Shopify, WooCommerce, or a custom website. Orders sync in real time — no manual importing, no missed sales.',
    points: ['TheDersi (live)', 'Shopify (available)', 'WooCommerce (soon)', 'Custom website webhook', 'Amazon & Instagram (soon)'],
  },
  {
    id: 'customers',
    icon: <Users className="w-6 h-6" />,
    color: 'text-sky-400 bg-sky-500/10',
    label: 'Customer Management',
    headline: 'Every customer, fully tracked',
    desc: 'Full order history, total spend, and contact details for every customer across every channel. Build real relationships with real data.',
    points: ['Customer profiles', 'Purchase history', 'Lifetime value tracking', 'Cross-channel records', 'Notes & preferences'],
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-[#0B1121]">
      <Navbar />

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#6B3FD9] bg-[#6B3FD9]/10 px-3 py-1.5 rounded-full mb-6">
              13 FEATURES · ONE PLATFORM
            </span>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight mb-6">
              Everything your<br />
              <span className="text-[#6B3FD9]">business needs.</span>
            </h1>
            <p className="text-xl text-gray-400 leading-relaxed max-w-2xl mb-10">
              From your first sale to your tenth employee — ExiusCart grows with you.
              POS, inventory, invoicing, HR, marketing, helpdesk, and more in one dashboard.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/register"
                className="inline-flex items-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold px-7 py-3.5 rounded-xl transition-all">
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/pricing"
                className="inline-flex items-center gap-2 text-gray-300 hover:text-white font-medium px-7 py-3.5 rounded-xl border border-gray-700 hover:border-gray-500 transition-all">
                View Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="py-10 px-4 border-y border-gray-800">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { n: '13', label: 'Built-in modules' },
            { n: '14 days', label: 'Free trial, no card' },
            { n: 'AED & USD', label: 'Multi-currency' },
            { n: '5% / 0%', label: 'Auto VAT (AED / USD)' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-bold text-white mb-1">{s.n}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature nav pills ── */}
      <section className="py-8 px-4 border-b border-gray-800 sticky top-0 bg-[#0B1121]/95 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto flex flex-wrap gap-2">
          {features.map((f) => (
            <a key={f.id} href={`#${f.id}`}
              className="text-xs font-medium text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-[#151F32] border border-transparent hover:border-gray-700 transition-all">
              {f.label}
            </a>
          ))}
        </div>
      </section>

      {/* ── Feature sections ── */}
      {features.map((f, i) => (
        <section
          key={f.id}
          id={f.id}
          className={`py-24 px-4 ${i % 2 === 1 ? 'bg-[#0D1526]' : ''}`}
        >
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Text — alternate sides */}
              <div className={i % 2 === 1 ? 'order-1 lg:order-2' : ''}>
                <div className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-5 ${f.color}`}>
                  {f.icon}
                  <span className="uppercase tracking-wider">{f.label}</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-5">
                  {f.headline}
                </h2>
                <p className="text-gray-400 leading-relaxed mb-8">{f.desc}</p>
                <ul className="space-y-3">
                  {f.points.map((p) => (
                    <li key={p} className="flex items-center gap-3 text-sm text-gray-300">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${f.color.split(' ')[0].replace('text-', 'bg-')}`} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Visual card */}
              <div className={`${i % 2 === 1 ? 'order-2 lg:order-1' : ''}`}>
                <FeatureVisual feature={f} />
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* ── CTA ── */}
      <section className="py-28 px-4 bg-[#0D1526]">
        <div className="max-w-6xl mx-auto">
          <div className="bg-[#151F32] border border-gray-800 rounded-3xl p-12 md:p-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                All 13 modules. One subscription.
              </h2>
              <p className="text-gray-400 max-w-md">
                14 days free. No credit card. Cancel anytime.
                Everything unlocked from day one.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link href="/register"
                className="inline-flex items-center justify-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold px-8 py-4 rounded-xl transition-all whitespace-nowrap">
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/pricing"
                className="inline-flex items-center justify-center gap-2 text-gray-300 hover:text-white font-medium px-8 py-4 rounded-xl border border-gray-700 hover:border-gray-500 transition-all whitespace-nowrap">
                View Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// ── Inline visual per feature ──────────────────────────────────────────────────

function FeatureVisual({ feature }: { feature: typeof features[0] }) {
  const accent = feature.color.split(' ')[0]; // e.g. "text-[#6B3FD9]"
  const bg = feature.color.split(' ')[1];     // e.g. "bg-[#6B3FD9]/10"

  return (
    <div className="bg-[#151F32] border border-gray-800 rounded-2xl p-6 space-y-3">
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg} ${accent}`}>
          {feature.icon}
        </div>
        <div>
          <p className="text-white font-semibold text-sm">{feature.label}</p>
          <p className="text-gray-500 text-xs">ExiusCart</p>
        </div>
        <span className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full ${bg} ${accent}`}>Active</span>
      </div>
      {feature.points.map((p, i) => (
        <div key={p} className="flex items-center gap-3 py-2.5 border-b border-gray-800/60 last:border-0">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${bg} ${accent} shrink-0`}>
            {i + 1}
          </div>
          <span className="text-sm text-gray-300">{p}</span>
          <div className={`ml-auto w-2 h-2 rounded-full ${bg.replace('/10', '')} opacity-70`} />
        </div>
      ))}
    </div>
  );
}
