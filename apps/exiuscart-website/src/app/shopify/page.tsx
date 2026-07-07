import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Check, X, RefreshCw, Package, ShoppingCart, BarChart3, Users, DollarSign, Star, Building2, Zap } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  title: 'Shopify Backend & Operations Management | ExiusCart',
  description: 'Connect your Shopify store to ExiusCart. Manage payroll, accounting, loyalty, multi-branch, and inventory — all synced with your Shopify orders. Save hundreds per month.',
  openGraph: {
    title: 'ExiusCart for Shopify Sellers — The Backend Shopify Forgot to Build',
    description: 'Keep your Shopify store. Add ExiusCart as your business brain behind it. Payroll, accounting, loyalty, multi-branch — all synced automatically.',
    url: 'https://exiuscart.com/shopify',
    siteName: 'ExiusCart',
    type: 'website',
  },
};

const SAVINGS = [
  { tool: 'Klaviyo (email marketing)',     price: '$45/mo',  exiuscart: '✓ Included' },
  { tool: 'Smile.io (loyalty program)',    price: '$50/mo',  exiuscart: '✓ Included' },
  { tool: 'QuickBooks (accounting)',       price: '$30/mo',  exiuscart: '✓ Included' },
  { tool: 'Gusto / Payroll tool',         price: '$40/mo',  exiuscart: '✓ Included' },
  { tool: 'Shopify multi-location (plan upgrade)', price: '$66/mo extra', exiuscart: '✓ Included' },
];

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Connect your Shopify store',
    desc: 'Enter your Shopify domain and API token in ExiusCart Channels. Takes 60 seconds.',
  },
  {
    step: '2',
    title: 'Orders sync automatically',
    desc: 'Every Shopify order appears in ExiusCart instantly via webhook — no manual import.',
  },
  {
    step: '3',
    title: 'Stock stays in sync',
    desc: 'When you update stock in ExiusCart, Shopify inventory updates automatically. No overselling.',
  },
  {
    step: '4',
    title: 'Run your whole business from ExiusCart',
    desc: 'Payroll, accounting, loyalty, multi-branch — manage everything from one dashboard.',
  },
];

const FEATURES = [
  { icon: RefreshCw,   title: 'Real-Time Order Sync',   desc: 'New Shopify orders appear in ExiusCart within seconds via webhook. No polling, no delays.' },
  { icon: Package,     title: 'Inventory Sync',          desc: 'Stock levels sync both ways. Sell on Shopify — ExiusCart updates. Update in ExiusCart — Shopify updates.' },
  { icon: BarChart3,   title: 'P&L & Accounting',        desc: 'All Shopify revenue flows into your ExiusCart P&L, Balance Sheet, and Cash Flow automatically.' },
  { icon: Users,       title: 'HR & Payroll',            desc: 'Pay your staff, track attendance, manage leave — all inside ExiusCart. No separate HR tool.' },
  { icon: Star,        title: 'Loyalty Program',         desc: 'Your Shopify customers earn loyalty points automatically. No Smile.io subscription needed.' },
  { icon: Building2,   title: 'Multi-Branch Management', desc: 'Run multiple locations from one ExiusCart account. Each branch has its own stock and staff.' },
  { icon: DollarSign,  title: 'Expenses & Purchases',    desc: 'Log business expenses and supplier POs. See your real profit after all costs.' },
  { icon: ShoppingCart,'title': 'TheDersi + Shopify Together', desc: 'Sell on both TheDersi and Shopify. All orders in one place. Stock shared and in sync.' },
];

export default function ShopifyPage() {
  return (
    <div className="min-h-screen bg-[#F5F3EF]">
      <Navbar />

      {/* ── Hero ── */}
      <section className="pt-28 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#6B3FD9] bg-[#6B3FD9]/10 px-3 py-1.5 rounded-full">
              <Zap className="w-3 h-3" /> Shopify Integration
            </span>
            <span className="text-xs text-gray-400">Works with any Shopify plan</span>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-[1.05] tracking-tight mb-6 max-w-4xl">
            The backend Shopify<br />
            <span className="text-[#6B3FD9]">forgot to build.</span>
          </h1>

          <p className="text-xl text-gray-500 max-w-2xl mb-10 leading-relaxed">
            Keep your Shopify store. Connect ExiusCart as your business brain behind it.
            Payroll, accounting, loyalty, multi-branch — all synced with your Shopify orders automatically.
          </p>

          <div className="flex flex-wrap gap-4 mb-16">
            <Link href="/register"
              className="inline-flex items-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold px-7 py-3.5 rounded-2xl transition-all text-sm">
              Start free — connect Shopify in 60 seconds <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/pricing"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 font-semibold px-7 py-3.5 rounded-2xl border border-gray-200 hover:border-gray-400 transition-all text-sm bg-white">
              See pricing
            </Link>
          </div>

          {/* Cost comparison */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">

              {/* Without ExiusCart */}
              <div className="p-8">
                <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-5">Without ExiusCart</p>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shopify Basic</span>
                    <span className="font-semibold text-gray-900">$39/mo</span>
                  </div>
                  {SAVINGS.map((s) => (
                    <div key={s.tool} className="flex justify-between text-sm">
                      <span className="text-gray-500">{s.tool}</span>
                      <span className="font-semibold text-red-500">{s.price}</span>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-gray-100 flex justify-between">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="font-black text-red-500 text-lg">~$270/mo</span>
                  </div>
                </div>
              </div>

              {/* With ExiusCart */}
              <div className="p-8 bg-[#6B3FD9]/5">
                <p className="text-xs font-bold uppercase tracking-widest text-[#6B3FD9] mb-5">With ExiusCart</p>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shopify Basic</span>
                    <span className="font-semibold text-gray-900">$39/mo</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">ExiusCart Starter (replaces all apps)</span>
                    <span className="font-semibold text-[#6B3FD9]">AED 45/mo</span>
                  </div>
                  {SAVINGS.map((s) => (
                    <div key={s.tool} className="flex justify-between text-sm">
                      <span className="text-gray-400 line-through">{s.tool}</span>
                      <span className="font-semibold text-green-600 text-xs">{s.exiuscart}</span>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-[#6B3FD9]/20 flex justify-between">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="font-black text-[#6B3FD9] text-lg">~$51/mo</span>
                  </div>
                </div>
                <p className="text-sm font-bold text-green-600">You save ~$219 every month</p>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 px-6 bg-[#0B1121]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">How it works</h2>
          <p className="text-gray-500 mb-12">Set up in under 5 minutes. No developer needed.</p>
          <div className="grid md:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((s) => (
              <div key={s.step} className="relative">
                <div className="w-10 h-10 rounded-xl bg-[#6B3FD9] flex items-center justify-center text-white font-black text-sm mb-4">
                  {s.step}
                </div>
                <h3 className="font-bold text-white mb-2 text-sm">{s.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Everything your Shopify store needs behind the scenes
          </h2>
          <p className="text-gray-500 mb-12 max-w-xl">All synced to your Shopify orders automatically. No manual work.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#6B3FD9]/10 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-[#6B3FD9]" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm mb-2">{f.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Shopify vs ExiusCart table ── */}
      <section className="py-16 px-6 bg-[#F5F3EF] border-t border-gray-200">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">What each handles</h2>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Feature</th>
                  <th className="px-6 py-3 text-xs font-bold text-green-700 uppercase tracking-wide text-center">Shopify</th>
                  <th className="px-6 py-3 text-xs font-bold text-[#6B3FD9] uppercase tracking-wide text-center">ExiusCart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  ['Customer-facing storefront',  true,  false],
                  ['Online payment processing',   true,  false],
                  ['Product listings & SEO',      true,  false],
                  ['Order management',            true,  true ],
                  ['Basic inventory',             true,  true ],
                  ['Payroll & HR',                false, true ],
                  ['P&L & Balance Sheet',         false, true ],
                  ['Loyalty program',             false, true ],
                  ['Multi-branch management',     false, true ],
                  ['Supplier purchase orders',    false, true ],
                  ['Expense tracking',            false, true ],
                  ['TheDersi integration',        false, true ],
                  ['Email & SMS marketing',       false, true ],
                  ['Helpdesk & Appointments',     false, true ],
                ].map(([feature, shopify, exius]) => (
                  <tr key={String(feature)} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-700">{feature as string}</td>
                    <td className="px-6 py-3 text-center">
                      {shopify ? <Check className="w-4 h-4 text-green-500 mx-auto" /> : <X className="w-4 h-4 text-gray-200 mx-auto" />}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {exius ? <Check className="w-4 h-4 text-[#6B3FD9] mx-auto" /> : <X className="w-4 h-4 text-gray-200 mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6 bg-[#0B1121]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-5">
            Ready to stop overpaying<br />for Shopify apps?
          </h2>
          <p className="text-gray-500 mb-10 text-lg">
            14-day free trial. Connect your Shopify store in 60 seconds. No credit card required.
          </p>
          <Link href="/register"
            className="inline-flex items-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold px-8 py-4 rounded-2xl transition-all text-base">
            Start free trial <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
