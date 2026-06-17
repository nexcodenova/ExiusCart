import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Target, Rocket, Globe, Zap, ShieldCheck, Heart, Building2, TrendingUp, Code } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  title: 'About ExiusCart | Our Story & Mission | NexCodeNova',
  description: 'ExiusCart is built by NexCodeNova — a tech company on a mission to empower small businesses across the UAE and beyond with affordable, powerful tools.',
  openGraph: {
    title: 'About ExiusCart | Our Story & Mission',
    description: 'ExiusCart is built by NexCodeNova. Affordable business tools for small shops in UAE & beyond.',
    url: 'https://exiuscart.com/about',
    siteName: 'ExiusCart',
    type: 'website',
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0B1121]">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 text-center">
        <span className="inline-block text-xs font-semibold tracking-widest text-[#6B3FD9] bg-[#6B3FD9]/10 px-3 py-1.5 rounded-full mb-8 uppercase">
          About ExiusCart
        </span>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight mb-8 max-w-4xl mx-auto">
          You run the business.<br />
          <span style={{ color: '#6B3FD9' }}>We handle the rest.</span>
        </h1>
        <p className="text-base md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
          ExiusCart is built by NexCodeNova — a tech company on a mission to give every
          small business owner the tools that enterprise companies take for granted.
        </p>
      </section>

      {/* Big mission statement */}
      <section className="py-20 px-6 border-y border-gray-800/60">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-[1.3]">
            "Small business owners deserve software that works as hard as they do —
            without the enterprise price tag or the steep learning curve."
          </p>
          <p className="mt-8 text-gray-400 text-sm font-medium tracking-widest uppercase">
            NexCodeNova · Founders
          </p>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-[#6B3FD9]">Our Story</span>
            <h2 className="mt-4 text-3xl md:text-4xl font-bold text-white leading-tight mb-8">
              From a simple observation<br /> to a full platform
            </h2>
            <div className="space-y-5 text-gray-400 leading-relaxed text-[15px]">
              <p>
                NexCodeNova started with a simple observation: small shop owners in
                Sri Lanka and the UAE were struggling with expensive, overcomplicated
                software that wasn&apos;t built for their reality.
              </p>
              <p>
                We saw grocers tracking inventory on paper, electronics shops creating
                invoices by hand, and boutique owners missing orders because nothing
                connected. There had to be a better way.
              </p>
              <p>
                That&apos;s why we built ExiusCart — an all-in-one platform that
                handles POS, inventory, invoicing, and customer management in one
                place, at a price any small business can afford.
              </p>
            </div>
          </div>

          {/* Timeline */}
          <div className="relative pl-8 border-l-2 border-[#6B3FD9]/20 space-y-10 pt-2">
            {[
              { stage: 'Founded', title: 'NexCodeNova Established', desc: 'Started as a software development studio in Sri Lanka, focused on building practical tools for real businesses.' },
              { stage: 'Product Launch', title: 'ExiusCart v1 Released', desc: 'First version launched — POS, inventory, and VAT invoicing for small businesses in the UAE.' },
              { stage: 'Growth', title: 'Expanding to Dubai', desc: 'Opened regional operations in Dubai to better serve UAE-based businesses and provide local support.' },
              { stage: "What's Next", title: 'Growing Across the Region', desc: 'Expanding our presence to Saudi Arabia and beyond, with new features shipping every month.', muted: true },
            ].map(({ stage, title, desc, muted }) => (
              <div key={stage} className="relative">
                <div className={`absolute -left-[25px] top-1 w-4 h-4 rounded-full ${muted ? 'bg-[#6B3FD9]/40' : 'bg-[#6B3FD9]'}`} />
                <span className="text-[#6B3FD9] font-semibold text-xs uppercase tracking-wide">{stage}</span>
                <h3 className="text-white font-semibold text-base mt-0.5">{title}</h3>
                <p className="text-gray-500 text-sm mt-1 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 px-6 bg-[#0D1526]">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-6">
          <div className="bg-[#111827] rounded-2xl border border-gray-800 p-10">
            <div className="w-12 h-12 bg-[#6B3FD9]/10 rounded-xl flex items-center justify-center mb-6">
              <Target className="w-6 h-6 text-[#6B3FD9]" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Our Mission</h3>
            <p className="text-gray-400 leading-relaxed">
              To empower every small business owner with affordable, easy-to-use
              technology that simplifies daily operations — from invoicing and inventory
              to customer management and order processing. Powerful tools
              shouldn&apos;t require an enterprise budget.
            </p>
          </div>
          <div className="bg-[#111827] rounded-2xl border border-gray-800 p-10">
            <div className="w-12 h-12 bg-[#6B3FD9]/10 rounded-xl flex items-center justify-center mb-6">
              <Rocket className="w-6 h-6 text-[#6B3FD9]" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Our Vision</h3>
            <p className="text-gray-400 leading-relaxed">
              To become the go-to business management platform for small and medium
              businesses across the Middle East and South Asia — making it possible for
              every shop, boutique, and store to run smarter and serve their
              customers better.
            </p>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#6B3FD9]">What Drives Us</span>
            <h2 className="mt-4 text-3xl md:text-4xl font-bold text-white">Our Core Values</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Heart, title: 'Customer First', desc: 'Every feature we build starts with a real customer problem, not a product roadmap checkbox.' },
              { icon: Zap, title: 'Simplicity', desc: 'Powerful software doesn\'t have to be complicated. If a shop owner can\'t use it on day one, we failed.' },
              { icon: ShieldCheck, title: 'Trust & Quality', desc: 'We ship software you can rely on. Your business data and daily operations deserve nothing less.' },
              { icon: Globe, title: 'Local Focus', desc: 'Built for local regulations, VAT rules, currencies, and the way real businesses in this region operate.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-[#0D1526] rounded-2xl border border-gray-800 p-7">
                <div className="w-11 h-11 bg-[#6B3FD9]/10 rounded-xl flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-[#6B3FD9]" />
                </div>
                <h3 className="text-white font-semibold mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Corporate Structure */}
      <section className="py-24 px-6 bg-[#0D1526]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-[#6B3FD9]">Our Company</span>
            <h2 className="mt-4 text-3xl md:text-4xl font-bold text-white">Who stands behind ExiusCart</h2>
            <p className="mt-3 text-gray-400 max-w-xl mx-auto text-[15px]">
              ExiusCart is a registered brand operating under Fairam Private Limited,
              incorporated in Sri Lanka.
            </p>
          </div>

          {/* Parent company */}
          <div className="bg-[#111827] rounded-2xl border border-[#6B3FD9]/40 p-8 mb-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-[#6B3FD9]/3 pointer-events-none" />
            <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="w-14 h-14 bg-[#6B3FD9]/15 rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 className="w-7 h-7 text-[#6B3FD9]" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-1">
                  <h3 className="text-xl font-bold text-white">Fairam Private Limited</h3>
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-[#6B3FD9]/15 text-[#6B3FD9] border border-[#6B3FD9]/30 px-2.5 py-1 rounded-full">
                    Parent Company
                  </span>
                </div>
                <p className="text-gray-400 text-sm">Registered Company · Sri Lanka</p>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed sm:max-w-xs sm:text-right">
                A privately held company incorporated in Sri Lanka, responsible for the
                development and operation of ExiusCart.
              </p>
            </div>
          </div>

          {/* Connector */}
          <div className="flex justify-center my-1">
            <div className="w-px h-8 bg-[#6B3FD9]/30" />
          </div>

          {/* Brands under Fairam */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-[#111827] rounded-2xl border border-[#6B3FD9]/25 p-7 relative">
              <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest bg-[#6B3FD9]/10 text-[#6B3FD9] px-2.5 py-1 rounded-full">
                Brand
              </span>
              <div className="w-11 h-11 bg-[#6B3FD9]/10 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-5 h-5 text-[#6B3FD9]" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">ExiusCart</h3>
              <p className="text-gray-500 text-xs mb-3">Business Management Platform</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                All-in-one POS, inventory, invoicing, and order management platform
                for small businesses across the UAE and beyond.
              </p>
            </div>
            <div className="bg-[#111827] rounded-2xl border border-gray-800 p-7 relative">
              <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest bg-gray-800 text-gray-400 px-2.5 py-1 rounded-full">
                Studio
              </span>
              <div className="w-11 h-11 bg-[#6B3FD9]/10 rounded-xl flex items-center justify-center mb-4">
                <Code className="w-5 h-5 text-[#6B3FD9]" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">NexCodeNova</h3>
              <p className="text-gray-500 text-xs mb-3">Development & Engineering</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                The technology studio behind ExiusCart — building and maintaining the
                platform and taking on custom software projects.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-[#0D1526]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to run your business smarter?
          </h2>
          <p className="text-gray-400 mb-10 text-[15px]">
            Start your free 14-day trial — no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold px-10 py-4 rounded-xl transition-all text-base"
            >
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 bg-transparent hover:bg-white/5 text-white font-semibold px-10 py-4 rounded-xl transition-all border border-gray-700 text-base"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
