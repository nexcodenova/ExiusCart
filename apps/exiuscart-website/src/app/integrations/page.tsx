import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, FileText, Printer, BarChart3, CreditCard, Globe, Smartphone, Mail, ShoppingCart, ShoppingBag, Store } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  title: 'Integrations | Printers, Payment Gateways & More | ExiusCart',
  description: 'Connect ExiusCart with thermal printers, payment gateways, email, and more. Seamless integrations to streamline your small business operations.',
  openGraph: {
    title: 'ExiusCart Integrations | Printers, Payments & More',
    description: 'Connect ExiusCart with thermal printers, payment gateways and more tools.',
    url: 'https://exiuscart.com/integrations',
    siteName: 'ExiusCart',
    type: 'website',
  },
};

const AVAILABLE = [
  {
    icon: Printer,
    title: 'Thermal Printers',
    desc: 'Print receipts and invoices directly from ExiusCart to any thermal printer, instantly.',
  },
  {
    icon: FileText,
    title: 'PDF & Excel Export',
    desc: 'Export invoices, reports, and inventory data as PDF or Excel files with one click.',
  },
  {
    icon: BarChart3,
    title: 'Sales Analytics',
    desc: 'Built-in dashboards to track sales, revenue, and business performance in real time.',
  },
  {
    icon: Globe,
    title: 'Multi-Currency',
    desc: 'Support for AED, USD, and more — with automatic region detection and formatting.',
  },
  {
    icon: Mail,
    title: 'Email Notifications',
    desc: 'Send invoices, order updates, and low-stock alerts directly to customers via email.',
  },
];

const COMING_SOON = [
  {
    icon: Smartphone,
    title: 'Mobile App',
    desc: 'Manage your business on the go with the ExiusCart app for iOS and Android.',
  },
  {
    icon: CreditCard,
    title: 'Payment Gateway',
    desc: 'Accept online payments with integrated gateways for seamless checkout.',
  },
  {
    icon: ShoppingCart,
    title: 'Online Store',
    desc: 'Launch your own online store with built-in e-commerce features and product pages.',
  },
];


export default function IntegrationsPage() {
  return (
    <div className="min-h-screen" style={{ background: '#EDEBE6' }}>
      <Navbar />

      {/* Hero */}
      <section className="pt-36 pb-20 px-6 text-center">
        <span className="inline-block text-xs font-bold tracking-widest text-[#6B3FD9] uppercase mb-6">
          Integrations
        </span>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-[1.05] tracking-tight mb-6 max-w-4xl mx-auto">
          Connect the tools<br />
          <span style={{ color: '#6B3FD9' }}>your business already uses.</span>
        </h1>
        <p className="text-base md:text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
          From thermal printers to payment gateways — ExiusCart connects with the
          services you rely on every day, with more on the way.
        </p>
      </section>

      {/* Featured Channel Integrations */}
      <section className="px-6 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700 bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Sales Channel Sync
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-4">

            {/* Shopify */}
            <div className="bg-[#0B1121] rounded-2xl p-8 flex flex-col justify-between min-h-[220px] group hover:ring-2 hover:ring-[#6B3FD9]/40 transition-all">
              <div>
                <div className="w-12 h-12 bg-[#6B3FD9]/20 rounded-xl flex items-center justify-center mb-5">
                  <ShoppingBag className="w-6 h-6 text-[#6B3FD9]" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Shopify</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-5">
                  Connect your Shopify store. Orders sync in real time, stock stays in sync both ways.
                  Add payroll, accounting, loyalty and multi-branch — all without leaving ExiusCart.
                </p>
              </div>
              <Link href="/shopify"
                className="inline-flex items-center gap-2 text-[#6B3FD9] hover:text-white font-semibold text-sm transition-colors">
                Learn more about Shopify integration <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* TheDersi */}
            <div className="bg-white rounded-2xl p-8 border border-black/6 flex flex-col justify-between min-h-[220px] group hover:border-[#6B3FD9]/30 hover:shadow-sm transition-all">
              <div>
                <div className="w-12 h-12 bg-[#6B3FD9]/10 rounded-xl flex items-center justify-center mb-5">
                  <Store className="w-6 h-6 text-[#6B3FD9]" />
                </div>
                <h3 className="text-gray-900 font-bold text-lg mb-2">TheDersi</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-5">
                  ExiusCart is the official backend for TheDersi sellers. Orders sync automatically,
                  stock updates both ways, and cancellations are handled in real time.
                </p>
              </div>
              <Link href="/register"
                className="inline-flex items-center gap-2 text-[#6B3FD9] hover:text-[#5A2EC9] font-semibold text-sm transition-colors">
                Connect your TheDersi store <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* Available Now */}
      <section className="px-6 pb-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700 bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Available Now
            </span>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {AVAILABLE.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-7 border border-black/6 hover:border-[#6B3FD9]/30 hover:shadow-sm transition-all group">
                <div className="w-12 h-12 bg-[#6B3FD9]/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-[#6B3FD9]/15 transition-colors">
                  <Icon className="w-6 h-6 text-[#6B3FD9]" />
                </div>
                <h3 className="text-gray-900 font-bold text-base mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coming Soon */}
      <section className="px-6 pb-24 pt-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#6B3FD9] bg-[#6B3FD9]/10 border border-[#6B3FD9]/20 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6B3FD9] inline-block" />
              Coming Soon
            </span>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {COMING_SOON.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white/60 rounded-2xl p-7 border border-black/6 opacity-80">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-5">
                  <Icon className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="text-gray-700 font-bold text-base mb-2">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* CTA — dark to contrast */}
      <section className="py-20 px-6 bg-[#0B1121]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Everything connected.<br />Ready on day one.
          </h2>
          <p className="text-gray-400 mb-10 text-[15px]">
            Start your free 14-day trial and experience all integrations first-hand.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold px-10 py-4 rounded-xl transition-all"
            >
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 bg-transparent hover:bg-white/5 text-white font-semibold px-10 py-4 rounded-xl transition-all border border-gray-700"
            >
              Talk to Us
            </Link>
          </div>
          <p className="text-gray-600 text-sm mt-5">No credit card required</p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
