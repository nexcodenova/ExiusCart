import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight, ShoppingBag, BarChart3, Users, FileText,
  Package, Link2, Globe, Zap, ShieldCheck, RefreshCw, Layers,
} from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  title: 'Features | ExiusCart — Multi-Channel Commerce Platform',
  description: 'Manage orders from TheDersi, Shopify, and more in one dashboard. VAT-compliant invoicing, inventory, analytics, and customer management built for UAE sellers.',
  openGraph: {
    title: 'ExiusCart Features',
    description: 'Multi-channel order management, smart invoicing, inventory tracking, and sales analytics — all in one platform.',
    url: 'https://exiuscart.com/features',
    siteName: 'ExiusCart',
    type: 'website',
  },
};

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-[#0B1121]">
      <Navbar />

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#6B3FD9] bg-[#6B3FD9]/10 px-3 py-1.5 rounded-full mb-6">
              PLATFORM FEATURES
            </span>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight mb-6">
              One dashboard.<br />
              <span className="text-[#6B3FD9]">Every channel.</span>
            </h1>
            <p className="text-xl text-gray-400 leading-relaxed max-w-2xl mb-10">
              ExiusCart connects your sales channels, automates your invoices,
              and tracks every order — so you focus on selling, not managing software.
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
            { n: '5+', label: 'Sales channels' },
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

      {/* ── Bento feature grid ── */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Built around how you actually sell</h2>
            <p className="text-gray-400 max-w-xl">Every feature connects to the next. Orders flow into invoices, invoices update inventory, inventory feeds your reports.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Wide card */}
            <div className="md:col-span-2 bg-[#151F32] border border-gray-800 rounded-2xl p-8 flex flex-col justify-between min-h-[280px]">
              <div>
                <div className="w-10 h-10 bg-[#6B3FD9]/15 rounded-xl flex items-center justify-center mb-5">
                  <Link2 className="w-5 h-5 text-[#6B3FD9]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Multi-Channel Order Management</h3>
                <p className="text-gray-400 text-sm leading-relaxed max-w-md">
                  Orders from TheDersi, Shopify, or your own store land in one unified dashboard.
                  No more jumping between platforms to see what sold.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 mt-6">
                {['TheDersi', 'Shopify', 'Custom Store', 'Amazon (soon)', 'Instagram (soon)'].map((ch) => (
                  <span key={ch} className="text-xs px-3 py-1 rounded-full bg-[#6B3FD9]/10 text-[#6B3FD9] font-medium">{ch}</span>
                ))}
              </div>
            </div>

            {/* Tall card */}
            <div className="bg-[#151F32] border border-gray-800 rounded-2xl p-8 flex flex-col justify-between min-h-[280px]">
              <div>
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-5">
                  <FileText className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Auto VAT Invoicing</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  5% VAT on AED orders. 0% on USD (export rule). Invoices generate automatically — PDF-ready, FTA-compliant.
                </p>
              </div>
              <div className="mt-6 bg-[#0B1121] rounded-xl p-4 text-xs font-mono space-y-1.5">
                <div className="flex justify-between text-gray-400"><span>Subtotal</span><span>AED 1,000</span></div>
                <div className="flex justify-between text-gray-400"><span>VAT 5%</span><span>AED 50</span></div>
                <div className="flex justify-between text-white font-bold border-t border-gray-700 pt-1.5 mt-1.5"><span>Total</span><span>AED 1,050</span></div>
              </div>
            </div>

            {/* Normal card */}
            <div className="bg-[#151F32] border border-gray-800 rounded-2xl p-8">
              <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center mb-5">
                <Package className="w-5 h-5 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Product & Inventory</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-5">
                Unlimited products on Premium. Variants, categories, bulk import, and real-time stock tracking.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#6B3FD9] rounded-full" />Product variants & SKUs</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#6B3FD9] rounded-full" />Low stock alerts</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#6B3FD9] rounded-full" />Bulk CSV import</li>
              </ul>
            </div>

            {/* Normal card */}
            <div className="bg-[#151F32] border border-gray-800 rounded-2xl p-8">
              <div className="w-10 h-10 bg-sky-500/10 rounded-xl flex items-center justify-center mb-5">
                <Users className="w-5 h-5 text-sky-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Customer Records</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-5">
                Full order history, total spend, and contact details for every customer across all channels.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-sky-400 rounded-full" />Purchase history</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-sky-400 rounded-full" />Lifetime spend value</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-sky-400 rounded-full" />Cross-channel tracking</li>
              </ul>
            </div>

            {/* Wide card */}
            <div className="md:col-span-2 bg-[#151F32] border border-gray-800 rounded-2xl p-8 flex flex-col justify-between min-h-[240px]">
              <div>
                <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center mb-5">
                  <BarChart3 className="w-5 h-5 text-violet-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Reports & Analytics</h3>
                <p className="text-gray-400 text-sm leading-relaxed max-w-md">
                  Revenue by channel, best-selling products, order trends, and payment breakdowns.
                  Filter by date range, export to PDF or Excel.
                </p>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  { label: 'Revenue', val: 'AED 24,500', color: 'text-white' },
                  { label: 'Orders', val: '184', color: 'text-white' },
                  { label: 'Avg. Order', val: 'AED 133', color: 'text-white' },
                ].map((m) => (
                  <div key={m.label} className="bg-[#0B1121] rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                    <p className={`text-base font-bold ${m.color}`}>{m.val}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Channel deep-dive ── */}
      <section className="py-24 px-4 bg-[#0D1526]">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div>
              <span className="text-xs font-semibold text-[#6B3FD9] tracking-widest uppercase mb-4 block">Sales Channels</span>
              <h2 className="text-4xl font-bold text-white leading-tight mb-6">
                Connect once.<br />Sell everywhere.
              </h2>
              <p className="text-gray-400 leading-relaxed mb-8">
                Link your TheDersi marketplace, Shopify store, or any custom website to ExiusCart.
                Every order — regardless of source — appears in your dashboard with the same structure,
                same statuses, same customer record.
              </p>
              <div className="space-y-4">
                {[
                  { name: 'TheDersi', desc: 'Sri Lankan fashion marketplace — live now', color: 'bg-[#6B3FD9]/10 text-[#6B3FD9]', status: 'Live' },
                  { name: 'Shopify', desc: 'Sync products, orders and inventory', color: 'bg-emerald-500/10 text-emerald-400', status: 'Available' },
                  { name: 'Custom Website', desc: 'Webhook + API for any storefront', color: 'bg-sky-500/10 text-sky-400', status: 'Soon' },
                  { name: 'Amazon / Instagram', desc: 'Marketplace & social commerce', color: 'bg-orange-500/10 text-orange-400', status: 'Soon' },
                ].map((ch) => (
                  <div key={ch.name} className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
                    <div>
                      <p className="text-white font-medium text-sm">{ch.name}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{ch.desc}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ch.color}`}>{ch.status}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#151F32] rounded-2xl border border-gray-800 p-6 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Recent Orders</p>
              {[
                { id: '#4821', ch: 'TheDersi', item: 'Navy Linen Shirt', amt: 'AED 145', status: 'Delivered', sc: 'bg-emerald-500/10 text-emerald-400' },
                { id: '#4820', ch: 'Shopify', item: 'Black Polo 2× ', amt: 'AED 290', status: 'Processing', sc: 'bg-blue-500/10 text-blue-400' },
                { id: '#4819', ch: 'TheDersi', item: 'White Kurta', amt: 'AED 95', status: 'Delivered', sc: 'bg-emerald-500/10 text-emerald-400' },
                { id: '#4818', ch: 'Direct', item: 'Slim Fit Chinos', amt: 'AED 220', status: 'Pending', sc: 'bg-orange-500/10 text-orange-400' },
                { id: '#4817', ch: 'TheDersi', item: 'Casual Jacket', amt: 'AED 380', status: 'Delivered', sc: 'bg-emerald-500/10 text-emerald-400' },
              ].map((o) => (
                <div key={o.id} className="flex items-center justify-between py-2.5 border-b border-gray-800/60 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 font-mono w-12">{o.id}</span>
                    <div>
                      <p className="text-sm text-white">{o.item}</p>
                      <p className="text-xs text-gray-500">{o.ch}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">{o.amt}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${o.sc}`}>{o.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Invoicing deep-dive ── */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="bg-[#151F32] rounded-2xl border border-gray-800 p-6 order-2 lg:order-1">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-white font-bold text-lg">Invoice #INV-2847</p>
                  <p className="text-gray-500 text-xs mt-0.5">Auto-generated · Jun 13, 2026</p>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold">Paid</span>
              </div>
              <div className="space-y-2 mb-5">
                {[
                  { item: 'Navy Linen Shirt × 2', price: 'AED 290.00' },
                  { item: 'Black Polo × 1', price: 'AED 145.00' },
                ].map((r) => (
                  <div key={r.item} className="flex justify-between text-sm">
                    <span className="text-gray-400">{r.item}</span>
                    <span className="text-white">{r.price}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-800 pt-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-400"><span>Subtotal</span><span>AED 435.00</span></div>
                <div className="flex justify-between text-sm text-gray-400"><span>VAT 5%</span><span>AED 21.75</span></div>
                <div className="flex justify-between text-base font-bold text-white pt-1"><span>Total</span><span>AED 456.75</span></div>
              </div>
              <div className="mt-5 flex gap-2">
                <button className="flex-1 py-2 text-xs font-semibold bg-[#6B3FD9] text-white rounded-lg">Download PDF</button>
                <button className="flex-1 py-2 text-xs font-semibold bg-[#0B1121] text-gray-400 rounded-lg border border-gray-700">Send to Customer</button>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <span className="text-xs font-semibold text-emerald-400 tracking-widest uppercase mb-4 block">Smart Invoicing</span>
              <h2 className="text-4xl font-bold text-white leading-tight mb-6">
                VAT sorted.<br />Invoices automatic.
              </h2>
              <p className="text-gray-400 leading-relaxed mb-8">
                AED orders carry 5% UAE VAT. USD orders are 0% (export rule).
                ExiusCart applies the right rate automatically — no manual calculation,
                no mistakes on your FTA filing.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'AED orders', val: '5% VAT applied', icon: '🇦🇪' },
                  { label: 'USD orders', val: '0% VAT (export)', icon: '🌍' },
                  { label: 'Invoice format', val: 'FTA-compliant PDF', icon: '📄' },
                  { label: 'Generation', val: 'Automatic on order', icon: '⚡' },
                ].map((f) => (
                  <div key={f.label} className="bg-[#151F32] border border-gray-800 rounded-xl p-4">
                    <p className="text-xl mb-2">{f.icon}</p>
                    <p className="text-xs text-gray-500 mb-0.5">{f.label}</p>
                    <p className="text-sm font-semibold text-white">{f.val}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Secondary features grid ── */}
      <section className="py-24 px-4 bg-[#0D1526]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-3">Everything else you need</h2>
            <p className="text-gray-400 max-w-xl mx-auto text-sm">The details that make the difference between a tool you use and one you love.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-800 rounded-2xl overflow-hidden border border-gray-800">
            {[
              { icon: <ShoppingBag className="w-5 h-5" />, title: 'Staff Accounts', desc: '3 staff on Starter, unlimited on Premium. Each with their own login and permissions.' },
              { icon: <Globe className="w-5 h-5" />, title: 'Multi-Currency', desc: 'AED for UAE sellers, USD for international. Set per store, not per transaction.' },
              { icon: <Zap className="w-5 h-5" />, title: 'Webhook Sync', desc: 'Real-time order sync from connected channels. No manual refresh, no polling.' },
              { icon: <ShieldCheck className="w-5 h-5" />, title: 'Data Security', desc: 'SSL/TLS encryption in transit. Daily backups. Your data is yours — exportable anytime.' },
              { icon: <RefreshCw className="w-5 h-5" />, title: 'Free Updates', desc: 'New features ship to all plans automatically. No upgrade fees for platform improvements.' },
              { icon: <Layers className="w-5 h-5" />, title: 'Affiliate Program', desc: 'Refer other sellers and earn commission. Built-in tracking and payout management.' },
            ].map((f) => (
              <div key={f.title} className="bg-[#0D1526] p-8 hover:bg-[#111b2e] transition-colors">
                <div className="w-9 h-9 bg-[#151F32] border border-gray-800 rounded-lg flex items-center justify-center text-[#6B3FD9] mb-4">
                  {f.icon}
                </div>
                <h3 className="text-white font-semibold mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-28 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-[#151F32] border border-gray-800 rounded-3xl p-12 md:p-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                Ready to see it in action?
              </h2>
              <p className="text-gray-400 max-w-md">
                14 days free. No credit card. Cancel anytime.
                Your store is live in under 5 minutes.
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
