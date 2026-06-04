import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Check, Star, Quote, ShoppingCart, Boxes, FileText, Package, BarChart3, Users, Megaphone, Wallet, Truck, Headphones, Calendar, Shield } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { PricingPreview } from '@/components/ui/pricing-preview';
import { PromoBanner } from '@/components/ui/promo-banner';

export const metadata: Metadata = {
  title: 'ExiusCart - Smart Business Management for Small Shops | POS, Invoicing & WhatsApp Orders',
  description: 'All-in-one business solution for UAE shops. Create VAT invoices, track inventory, receive WhatsApp orders. Affordable one-time pricing starting from AED 499.',
  openGraph: {
    title: 'ExiusCart - Smart Business Management for Small Shops',
    description: 'All-in-one business solution for UAE shops. POS, invoicing, inventory & WhatsApp orders.',
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
        {/* Mobile gradient overlay — dark top for text, fades to reveal devices */}
        <div className="absolute inset-0 lg:hidden" style={{ background: 'linear-gradient(180deg, rgba(4,6,15,0.92) 45%, rgba(4,6,15,0.2) 75%, transparent 100%)' }} />

        {/* Desktop text — left aligned, vertically centered */}
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

        {/* Mobile hero — matches reference design */}
        <div className="relative z-10 lg:hidden flex flex-col w-full pt-6 px-5">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 self-start mb-6 px-4 py-2 rounded-full border border-[#7B4FE9]/50 bg-[#7B4FE9]/10">
            <span className="text-yellow-400 text-sm">★</span>
            <span className="text-white/80 text-sm font-medium">All-in-One Business Management</span>
          </div>

          {/* Headline */}
          <h1 className="text-[2.6rem] font-extrabold leading-[1.05] mb-4">
            <span className="text-white">Everything</span>
            <br />
            <span style={{ background: 'linear-gradient(90deg, #7B4FE9, #60A5FA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Your Business</span>
            <br />
            <span className="text-white">Needs,</span>
            <br />
            <span style={{ background: 'linear-gradient(90deg, #7B4FE9, #60A5FA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>In One Place.</span>
          </h1>

          {/* Underline accent */}
          <div className="h-[3px] w-48 rounded-full mb-5" style={{ background: 'linear-gradient(90deg, #7B4FE9, #60A5FA)' }} />

          {/* Subtitle */}
          <p className="text-gray-400 text-base leading-relaxed mb-7">
            Manage invoicing, inventory, orders,<br />marketing &amp; more — all in one platform.
          </p>

          {/* CTA Button */}
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

          {/* Trust line */}
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

      {/* What We Solve */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Stop juggling spreadsheets and paper invoices
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              Running a small business is hard enough. ExiusCart brings everything
              together — invoicing, inventory, customer orders — so you can focus
              on what matters: growing your business.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <FeatureCard
              title="Smart Invoicing"
              desc="Create professional VAT-compliant invoices in seconds. Track payments, send receipts, export reports."
            />
            <FeatureCard
              title="Inventory Control"
              desc="Know your stock levels in real-time. Get alerts before you run out. Track every item movement."
            />
            <FeatureCard
              title="WhatsApp Orders"
              desc="Let customers order through WhatsApp. Manage everything from one dashboard. No more missed messages."
            />
          </div>

          <div className="mt-12">
            <Link
              href="/features"
              className="inline-flex items-center gap-2 text-[#6B3FD9] hover:text-[#8B5CF6] font-medium transition"
            >
              See all features
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Why ExiusCart */}
      <section className="py-20 px-4 bg-[#0D1526]">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Built for UAE small businesses
              </h2>
              <p className="text-gray-400 mb-10">
                We understand local business needs. ExiusCart is designed with
                UAE regulations, Arabic support, and affordable pricing in mind.
              </p>

              <div className="space-y-4">
                <BenefitRow text="VAT compliant invoicing (5%)" />
                <BenefitRow text="Arabic & English interface" />
                <BenefitRow text="Works offline" />
                <BenefitRow text="One-time payment option" />
                <BenefitRow text="WhatsApp integration" />
                <BenefitRow text="Free updates included" />
              </div>
            </div>

            {/* Pricing Preview */}
            <PricingPreview />
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Trusted by UAE Business Owners
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              See what shop owners across UAE are saying about ExiusCart
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <TestimonialCard
              name="Ahmed Al Rashid"
              business="Mobile Zone Electronics"
              location="Dubai"
              rating={5}
              text="ExiusCart transformed how I manage my mobile shop. The POS is so fast, and my customers love getting WhatsApp receipts. Best investment for my business!"
            />
            <TestimonialCard
              name="Fatima Hassan"
              business="Fashion Corner Boutique"
              location="Abu Dhabi"
              rating={5}
              text="Finally, a system that understands UAE business needs! VAT invoicing is automatic, inventory tracking saves me hours every week. Highly recommend!"
            />
            <TestimonialCard
              name="Mohammed Khalid"
              business="Tech Hub Accessories"
              location="Sharjah"
              rating={5}
              text="The WhatsApp ordering feature is a game-changer. My customers can browse and order anytime. Sales increased by 40% in the first month!"
            />
          </div>

          {/* Trust Stats */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 pt-12 border-t border-gray-800">
            <StatItem value="50+" label="Active Shops" />
            <StatItem value="10,000+" label="Invoices Created" />
            <StatItem value="99%" label="Uptime" />
            <StatItem value="4.9/5" label="Customer Rating" />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-[#0D1526]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to simplify your business?
          </h2>
          <p className="text-gray-400 mb-10">
            Join UAE businesses using ExiusCart to manage their daily operations.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-black font-semibold px-10 py-4 rounded-lg transition-all text-lg"
          >
            Start Free Trial
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-gray-600 text-sm mt-4">
            14-day free trial · No credit card required
          </p>
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
}: {
  name: string;
  business: string;
  location: string;
  rating: number;
  text: string;
}) {
  return (
    <div className="bg-[#151F32] rounded-2xl border border-gray-800 p-6 relative">
      <Quote className="absolute top-6 right-6 w-8 h-8 text-[#6B3FD9]/20" />

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

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-3xl md:text-4xl font-bold text-[#6B3FD9] mb-1">{value}</p>
      <p className="text-gray-400 text-sm">{label}</p>
    </div>
  );
}

