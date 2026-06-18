'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Plus, Minus } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';

const CATEGORIES = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    faqs: [
      {
        q: 'What is ExiusCart?',
        a: 'ExiusCart is an all-in-one business management platform. It combines POS, inventory, VAT invoicing, orders, HR & payroll, marketing, and customer management — so you run your entire business from one dashboard instead of 10 different tools.',
      },
      {
        q: 'How do I get started?',
        a: 'Click "Get Started" and create your account. No credit card needed. You get 14 days of full access instantly — all features unlocked from day one.',
      },
      {
        q: 'Is there a free trial?',
        a: 'Yes — 14 days, completely free. No credit card required. Every feature is unlocked during your trial so you can properly evaluate ExiusCart before committing.',
      },
      {
        q: 'Do I need to install anything?',
        a: 'Nothing. ExiusCart runs entirely in your browser — desktop, tablet, or mobile. No downloads, no IT setup.',
      },
    ],
  },
  {
    id: 'pricing',
    label: 'Pricing & Plans',
    faqs: [
      {
        q: 'How much does ExiusCart cost?',
        a: 'Three plans: Free Trial (14 days, free), Starter (AED 45/month or $12 USD/month), and Premium (AED 99/month or $29 USD/month). We also support LKR, EUR, and INR billing.',
      },
      {
        q: 'What is included in the Starter plan?',
        a: 'Starter includes 3 staff accounts, up to 1,000 products, 20 GB storage, full POS, 500 invoices/month with logo, advanced analytics, TheDersi order sync up to 1,000 orders/month, and priority email support.',
      },
      {
        q: 'What does Premium include that Starter does not?',
        a: 'Premium adds unlimited staff, unlimited products, 75 GB storage, custom invoice branding, multiple branches/locations, unlimited TheDersi order sync, unlimited invoices, and a dedicated account manager with 24/7 priority support.',
      },
      {
        q: 'Can I upgrade or downgrade anytime?',
        a: 'Yes. Upgrade any time and new features are unlocked immediately. Downgrade takes effect at the next billing cycle.',
      },
      {
        q: 'Is there a refund policy?',
        a: 'Yes — 7-day money-back guarantee from the start of your first paid subscription. Contact us and we\'ll process a full refund, no questions asked.',
      },
      {
        q: 'What happens when my trial ends?',
        a: 'Your data stays safe. You can choose a Starter or Premium plan to continue. If you don\'t upgrade, access is paused but nothing is deleted — you have 30 days to export your data.',
      },
    ],
  },
  {
    id: 'features',
    label: 'Features',
    faqs: [
      {
        q: 'Does ExiusCart support VAT invoicing?',
        a: 'Yes. ExiusCart automatically calculates and applies UAE VAT (5%) on invoices. All invoices are FTA-compliant and include your TRN. You can export PDF invoices with your logo.',
      },
      {
        q: 'Can I manage multiple branches or locations?',
        a: 'Multiple branches are available on the Premium plan. Each branch has its own inventory, staff, and reporting. The Starter plan includes 1 branch.',
      },
      {
        q: 'Does ExiusCart have a POS system?',
        a: 'Yes — a full POS built in. Process sales, apply discounts, issue receipts, and manage cash/card payments directly from any device. Works on desktop, tablet, and mobile.',
      },
      {
        q: 'Is HR and payroll included?',
        a: 'Yes. ExiusCart includes employee records, attendance tracking, leave management, and payroll calculation — no separate HR software needed.',
      },
      {
        q: 'Can I run email marketing campaigns?',
        a: 'Yes. ExiusCart has built-in email campaigns, SMS marketing, and Meta Ads lead capture. Starter plan includes up to 500 leads, Premium is unlimited.',
      },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    faqs: [
      {
        q: 'Can I connect my Shopify store?',
        a: 'Yes. ExiusCart syncs directly with Shopify — orders, products, and inventory update in real time. Available on all paid plans.',
      },
      {
        q: 'Can I connect a custom-built website?',
        a: 'Yes. Connect your website in minutes. Every order placed on your site syncs into ExiusCart automatically. ExiusCart then becomes your admin panel — handling inventory, invoicing, reports, staff, and more — so you never need to build a separate backend.',
      },
      {
        q: 'Does ExiusCart work with TheDersi marketplace?',
        a: 'Yes. ExiusCart is the official management platform for TheDersi sellers. Orders from TheDersi sync into ExiusCart automatically. Free sellers get 50 orders/month; paid plans get up to 1,000 (Starter) or unlimited (Premium).',
      },
      {
        q: 'Does ExiusCart work with WooCommerce?',
        a: 'Yes. WooCommerce order sync is supported on all paid plans, the same way Shopify integration works.',
      },
    ],
  },
  {
    id: 'security',
    label: 'Security & Data',
    faqs: [
      {
        q: 'Is my data secure?',
        a: 'Yes. All data is encrypted in transit (SSL/TLS) and at rest. We run daily backups to multiple secure locations. Your business data is never shared or sold.',
      },
      {
        q: 'Who owns my data?',
        a: 'You do. Your business data belongs entirely to you. ExiusCart never uses, sells, or shares your data with third parties.',
      },
      {
        q: 'Can I export my data?',
        a: 'Yes — export products, customers, orders, invoices, and reports in Excel or CSV format at any time. Available on all plans.',
      },
      {
        q: 'What happens if I cancel?',
        a: 'Your data remains in read-only mode for 30 days after cancellation. During this time you can export everything. After 30 days, data is securely deleted unless you request an extension.',
      },
    ],
  },
  {
    id: 'support',
    label: 'Support',
    faqs: [
      {
        q: 'How do I get support?',
        a: 'All plans include chat and email support. Premium plan includes priority support with a dedicated account manager and 24/7 availability.',
      },
      {
        q: 'Is there onboarding help?',
        a: 'Yes. Every new account gets a free onboarding walkthrough. Premium users get a dedicated onboarding session with a real person from our team.',
      },
      {
        q: 'What are your support hours?',
        a: 'Standard support is available Sunday to Thursday, 9 AM – 6 PM UAE time. Premium plan includes 24/7 priority support.',
      },
    ],
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between gap-6 py-6 text-left group"
      >
        <span className="text-gray-900 font-semibold text-base md:text-lg leading-snug group-hover:text-[#6B3FD9] transition-colors">
          {q}
        </span>
        <span className="shrink-0 mt-0.5">
          {open
            ? <Minus className="w-5 h-5 text-[#6B3FD9]" />
            : <Plus className="w-5 h-5 text-gray-400 group-hover:text-[#6B3FD9] transition-colors" />}
        </span>
      </button>
      {open && (
        <p className="text-gray-500 leading-relaxed pb-6 text-[15px] max-w-3xl">
          {a}
        </p>
      )}
    </div>
  );
}

export default function FAQPage() {
  const [active, setActive] = useState(CATEGORIES[0].id);
  const current = CATEGORIES.find(c => c.id === active)!;

  return (
    <div className="min-h-screen bg-[#0B1121]">
      <Navbar />

      {/* Hero — dark */}
      <section className="pt-32 pb-20 px-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6B3FD9] mb-5">
          Help centre
        </p>
        <h1 className="text-5xl md:text-6xl lg:text-[4.5rem] font-black text-white leading-[1.03] tracking-tight mb-6">
          Questions?<br />We have answers.
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Everything you need to know about ExiusCart — plans, features, integrations, and support.
        </p>
      </section>

      {/* FAQ — cream */}
      <section className="bg-[#F5F3EF] px-6 py-20">
        <div className="max-w-4xl mx-auto">

          {/* Category pills */}
          <div className="flex flex-wrap gap-2 mb-14">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActive(c.id)}
                className={`px-5 py-2 rounded-full text-sm font-semibold border transition-all ${
                  active === c.id
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Section heading */}
          <div className="mb-4">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">
              {current.label}
            </h2>
          </div>

          {/* Accordion */}
          <div className="mt-8">
            {current.faqs.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>

        </div>
      </section>

      {/* Still have questions — Paddle card style */}
      <section className="bg-[#F5F3EF] px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#0B1121] rounded-3xl p-10 md:p-14 grid md:grid-cols-2 gap-10 items-center relative overflow-hidden">
            {/* Grid line decorations */}
            <div className="absolute inset-0 pointer-events-none hidden md:block">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/5" />
              <div className="absolute top-1/2 left-0 right-0 h-px bg-white/5" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#6B3FD9] shadow-[0_0_12px_#6B3FD9]" />
            </div>
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6B3FD9] mb-4">
                Still unsure?
              </p>
              <h3 className="text-3xl md:text-4xl font-black text-white leading-tight mb-4">
                Talk to a real person.
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Our team responds fast. Whether you have a question about pricing, integrations, or want a walkthrough — we're here.
              </p>
            </div>
            <div className="relative flex flex-col gap-3">
              <Link
                href="/contact"
                className="flex items-center justify-between gap-4 bg-white text-gray-900 font-semibold px-6 py-4 rounded-2xl hover:bg-gray-100 transition-all"
              >
                <span>Contact support</span>
                <ArrowRight className="w-5 h-5 shrink-0" />
              </Link>
              <Link
                href="/register"
                className="flex items-center justify-between gap-4 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold px-6 py-4 rounded-2xl transition-all"
              >
                <span>Start free trial</span>
                <ArrowRight className="w-5 h-5 shrink-0" />
              </Link>
              <p className="text-center text-xs text-gray-600 mt-1">14 days free · No credit card required</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
