import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, FileText, Printer, BarChart3, CreditCard, Globe, Smartphone, Mail, ShoppingCart, ShoppingBag, Store, Package, Users, Zap, Layout, TrendingUp, Building2, Receipt } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  title: 'Integrations | Sales Channels, Printers & More | ExiusCart',
  description: 'Connect ExiusCart with Shopify, TikTok Shop, eBay, Amazon, Facebook and more. Seamless integrations to run your entire business from one place.',
  openGraph: {
    title: 'ExiusCart Integrations | Sales Channels & More',
    description: 'Connect ExiusCart with Shopify, TikTok Shop, eBay, Amazon, Facebook and more tools.',
    url: 'https://exiuscart.com/integrations',
    siteName: 'ExiusCart',
    type: 'website',
  },
};

const CHANNELS_SECONDARY = [
  {
    label: 'TikTok Shop',
    desc: 'Sync orders and inventory with your TikTok Shop in real time.',
    color: '#010101',
    bg: '#f0f0f0',
    svg: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/>
      </svg>
    ),
  },
  {
    label: 'eBay',
    desc: 'List products and manage eBay orders alongside all your other channels.',
    color: '#e53238',
    bg: '#fff5f5',
    svg: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M2.052 12.001c0-1.662.633-2.922 1.893-3.778 1.258-.856 3.045-1.283 5.363-1.283 1.065 0 2.053.082 2.965.247V6.83c0-.638-.197-1.119-.592-1.442-.394-.322-.978-.483-1.749-.483-.705 0-1.268.147-1.688.44-.421.293-.677.74-.767 1.34H4.73c.05-1.108.5-1.97 1.352-2.585.851-.616 2.039-.924 3.563-.924 1.554 0 2.74.328 3.558.983.817.655 1.226 1.646 1.226 2.972v6.577h-2.6v-1.275c-.386.472-.878.835-1.476 1.088-.598.253-1.294.38-2.088.38-1.247 0-2.24-.314-2.978-.942-.738-.628-1.107-1.45-1.107-2.47zm3.07-.183c0 .537.183.96.55 1.27.366.31.882.465 1.546.465.91 0 1.62-.246 2.129-.737.508-.491.762-1.177.762-2.057v-.57a9.36 9.36 0 0 0-2.224-.253c-.877 0-1.553.172-2.028.517-.475.344-.713.815-.735 1.365zm8.59 1.916h2.674c.04.512.238.91.596 1.195.357.285.84.427 1.447.427.594 0 1.06-.12 1.399-.361.338-.241.508-.564.508-.97 0-.313-.11-.565-.33-.756-.22-.191-.617-.359-1.19-.502l-1.587-.38c-1.023-.244-1.784-.612-2.284-1.105-.5-.492-.749-1.1-.749-1.823 0-.92.352-1.65 1.058-2.19.705-.54 1.668-.81 2.888-.81 1.162 0 2.086.274 2.77.821.684.548 1.063 1.3 1.137 2.256h-2.59c-.04-.437-.209-.776-.508-1.017-.3-.241-.71-.361-1.232-.361-.5 0-.89.107-1.172.32-.281.214-.422.51-.422.887 0 .286.1.52.3.702.2.181.538.337 1.016.468l1.643.427c1.015.263 1.773.641 2.273 1.133.5.492.75 1.117.75 1.874 0 .964-.374 1.723-1.122 2.277-.748.554-1.758.831-3.03.831-1.252 0-2.243-.294-2.973-.883-.73-.588-1.118-1.397-1.165-2.426h.014z"/>
      </svg>
    ),
  },
  {
    label: 'Amazon',
    desc: 'Connect your Amazon seller account — orders, stock, and fulfilment in one place.',
    color: '#FF9900',
    bg: '#fffbf0',
    svg: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M13.958 10.09c0 1.232.029 2.256-.591 3.351-.502.891-1.301 1.438-2.186 1.438-1.214 0-1.922-.924-1.922-2.292 0-2.692 2.415-3.182 4.7-3.182v.685zm3.186 7.705a.656.656 0 0 1-.742.073c-1.044-.869-1.231-1.271-1.805-2.098-1.726 1.761-2.948 2.287-5.187 2.287-2.649 0-4.711-1.635-4.711-4.908 0-2.557 1.387-4.297 3.359-5.148 1.712-.754 4.104-.891 5.932-1.098v-.41c0-.753.058-1.642-.383-2.294-.382-.581-1.124-.822-1.775-.822-1.205 0-2.277.618-2.54 1.897-.054.285-.262.567-.549.582l-3.073-.333c-.259-.057-.548-.266-.472-.66C5.481.99 8.088 0 10.421 0c1.193 0 2.751.317 3.692 1.22 1.193 1.117 1.079 2.608 1.079 4.232v3.83c0 1.151.478 1.657.927 2.278.159.223.194.49-.01.656l-2.965 2.579zm4.957 1.835c-2.726 2.023-6.683 3.098-10.09 3.098-4.774 0-9.073-1.765-12.323-4.702-.255-.23-.027-.544.279-.365 3.508 2.042 7.845 3.272 12.325 3.272 3.022 0 6.346-.627 9.405-1.926.462-.196.85.302.404.623zm1.151-1.312c-.348-.447-2.301-.212-3.181-.107-.267.032-.308-.2-.067-.368 1.558-1.095 4.115-.778 4.414-.412.3.366-.079 2.927-1.537 4.149-.224.188-.437.088-.338-.161.328-.818 1.057-2.652.709-3.101z"/>
      </svg>
    ),
  },
  {
    label: 'Facebook & Instagram',
    desc: 'Sell on Facebook Shops and Instagram Shopping. Inventory and orders synced automatically.',
    color: '#1877F2',
    bg: '#f0f6ff',
    svg: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    label: 'WooCommerce',
    desc: 'Sync your WooCommerce store — orders, products, and stock managed centrally.',
    color: '#7F54B3',
    bg: '#f7f4ff',
    svg: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M2.047 0C.919 0 0 .917 0 2.044v14.312c0 1.127.919 2.044 2.047 2.044h7.905l3.015 3.577 3.015-3.577H21.953C23.081 18.4 24 17.483 24 16.356V2.044C24 .917 23.081 0 21.953 0H2.047zm1.388 4.023h15.131c.465 0 .76.322.76.757a.752.752 0 0 1-.76.756H3.435a.752.752 0 0 1-.76-.756c0-.435.295-.757.76-.757zm0 3.575h15.131c.465 0 .76.322.76.757a.752.752 0 0 1-.76.757H3.435a.752.752 0 0 1-.76-.757c0-.435.295-.757.76-.757zm0 3.576h9.41c.465 0 .76.322.76.756a.752.752 0 0 1-.76.757H3.435a.752.752 0 0 1-.76-.757c0-.434.295-.756.76-.756z"/>
      </svg>
    ),
  },
  {
    label: 'Custom Website',
    desc: 'Your own branded storefront powered by ExiusCart — no third-party platform needed.',
    color: '#6B3FD9',
    bg: '#f3efff',
    svg: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>
    ),
  },
];

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
    desc: 'Support for AED, USD, LKR and more — with automatic region detection and formatting.',
  },
  {
    icon: Mail,
    title: 'Email Notifications',
    desc: 'Send invoices, order updates, and low-stock alerts directly to customers via email.',
  },
  {
    icon: TrendingUp,
    title: 'Google Ads Lead Capture',
    desc: 'Leads from Google Ads auto-land in ExiusCart. Follow up, track, and convert — all in one place.',
  },
  {
    icon: Package,
    title: 'Inventory Management',
    desc: 'Real-time stock tracking across all your channels. Low-stock alerts, bulk updates, and full history.',
  },
  {
    icon: Receipt,
    title: 'Invoicing & POS',
    desc: 'Create professional invoices in seconds and run a full point-of-sale directly from ExiusCart.',
  },
  {
    icon: Users,
    title: 'Customer Management',
    desc: 'Unified customer profiles with order history, contact details, and lead tracking built in.',
  },
  {
    icon: Building2,
    title: 'Multi-Branch Support',
    desc: 'Run multiple store branches from one account. Staff, stock, and sales separated per location.',
  },
  {
    icon: Zap,
    title: 'Real-Time Order Sync',
    desc: 'Orders from every connected channel land in ExiusCart instantly — one inbox for everything.',
  },
  {
    icon: Layout,
    title: 'Unified Dashboard',
    desc: 'Revenue, orders, stock, and leads in one clean dashboard. No jumping between apps.',
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
    title: 'Amazon Ads',
    desc: 'Auto-capture leads from Amazon Sponsored Products and manage them in ExiusCart.',
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
          Every channel.<br />
          <span style={{ color: '#6B3FD9' }}>One place.</span>
        </h1>
        <p className="text-base md:text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
          Connect Shopify, TikTok Shop, eBay, Amazon, Facebook, and more — all syncing in real time
          with your ExiusCart inventory, orders, and reports.
        </p>
      </section>

      {/* Featured Channel Integrations */}
      <section className="px-6 pb-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700 bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Sales Channel Sync
            </span>
          </div>
          {/* Featured three */}
          <div className="grid md:grid-cols-3 gap-4 mb-4">

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
              <Link href="https://www.thedersi.lk/sell" target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 text-[#6B3FD9] hover:text-[#5A2EC9] font-semibold text-sm transition-colors">
                Become a TheDersi seller <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Daraz */}
            <div className="bg-white rounded-2xl p-8 border border-black/6 flex flex-col justify-between min-h-[220px] group hover:border-orange-300 hover:shadow-sm transition-all">
              <div>
                <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center mb-5">
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#F85606">
                    <path d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-1 11.5c0 .83-.67 1.5-1.5 1.5h-11C5.67 17 5 16.33 5 15.5v-7C5 7.67 5.67 7 6.5 7h11c.83 0 1.5.67 1.5 1.5v7zm-5.5-5H12v-1.5c0-.28-.22-.5-.5-.5s-.5.22-.5.5v4c0 .28.22.5.5.5s.5-.22.5-.5V13h1.5c.83 0 1.5-.67 1.5-1.5S14.33 10 13.5 10zm0 2H12v-1h1.5c.28 0 .5.22.5.5s-.22.5-.5.5z"/>
                  </svg>
                </div>
                <h3 className="text-gray-900 font-bold text-lg mb-2">Daraz</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-5">
                  Sri Lanka's #1 marketplace, now connected to ExiusCart. Orders sync automatically,
                  stock deducts in real time, and fulfilment updates push back to Daraz instantly.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-full w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
                Available on paid plans
              </span>
            </div>

          </div>

          {/* Secondary channels grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {CHANNELS_SECONDARY.map(({ label, desc, color, bg, svg }) => (
              <div key={label}
                className="bg-white rounded-2xl p-5 border border-black/6 hover:border-[#6B3FD9]/30 hover:shadow-sm transition-all group flex flex-col items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: bg, color }}>
                  {svg}
                </div>
                <div>
                  <p className="text-gray-900 font-bold text-sm mb-0.5">{label}</p>
                  <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Available Now */}
      <section className="px-6 pb-6 pt-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700 bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Available Now
            </span>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {AVAILABLE.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-6 border border-black/6 hover:border-[#6B3FD9]/30 hover:shadow-sm transition-all group">
                <div className="w-10 h-10 bg-[#6B3FD9]/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#6B3FD9]/15 transition-colors">
                  <Icon className="w-5 h-5 text-[#6B3FD9]" />
                </div>
                <h3 className="text-gray-900 font-bold text-sm mb-1.5">{title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
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


      {/* CTA */}
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
