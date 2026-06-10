import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Check, Star, Quote, ShoppingCart, Boxes, FileText, Package, BarChart3, Users, Megaphone, Wallet, Truck, Headphones, Calendar, Shield } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { PricingPreview } from '@/components/ui/pricing-preview';
import { PromoBanner } from '@/components/ui/promo-banner';
import { LiveStats } from '@/components/ui/live-stats';

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

      {/* Why ExiusCart — Premium Brand Section */}
      <section className="py-28 px-4 relative overflow-hidden">
        {/* BG glows */}
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-[0.07] blur-3xl pointer-events-none" style={{ background: '#7B4FE9' }} />
        <div className="absolute -bottom-40 right-0 w-[400px] h-[400px] rounded-full opacity-[0.06] blur-3xl pointer-events-none" style={{ background: '#60A5FA' }} />

        <div className="max-w-7xl mx-auto relative z-10">

          {/* Split: brand story left, bento right */}
          <div className="grid lg:grid-cols-5 gap-12 items-start mb-16">

            {/* Left — brand story (2 cols) */}
            <div className="lg:col-span-2 flex flex-col justify-center">
              <span className="inline-flex items-center gap-2 text-[#7B4FE9] text-xs font-bold tracking-widest uppercase mb-6 border border-[#7B4FE9]/30 bg-[#7B4FE9]/10 px-3 py-1.5 rounded-full w-fit">
                <Star className="w-3 h-3 fill-[#7B4FE9]" /> Our Philosophy
              </span>
              <h2 className="text-5xl lg:text-6xl font-black text-white leading-[1.1] mb-6">
                Why<br />
                <span style={{ background: 'linear-gradient(100deg, #7B4FE9 0%, #60A5FA 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  "Exius
                  <span style={{ WebkitTextFillColor: 'white', color: 'white' }}>Cart</span>
                  "?
                </span>
              </h2>
              {/* Accent line */}
              <div className="w-16 h-1 rounded-full mb-6" style={{ background: 'linear-gradient(90deg, #7B4FE9, #60A5FA)' }} />
              <p className="text-gray-300 text-lg leading-relaxed mb-4">
                Because everything your business needs lives in{' '}
                <span className="text-white font-bold">one cart.</span>
              </p>
              <p className="text-gray-500 text-base leading-relaxed mb-10">
                Invoicing, inventory, orders, sales &amp; marketing, HR &amp; payroll — not scattered
                across 10 tools. All in one place, built for real businesses.
              </p>
              <Link
                href="/features"
                className="inline-flex items-center gap-3 text-white font-bold px-6 py-3.5 rounded-xl transition-all hover:scale-105 self-start"
                style={{ background: 'linear-gradient(135deg, #7B4FE9, #5A2EC9)', boxShadow: '0 4px 24px rgba(123,79,233,0.35)' }}
              >
                Explore all features
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Right — Bento grid (3 cols) */}
            <div className="lg:col-span-3 grid grid-cols-2 gap-4">
              {/* Card 1 — wide */}
              <div className="col-span-2 group relative rounded-2xl p-6 overflow-hidden border border-gray-800/60 hover:border-[#EA580C]/40 transition-all duration-300" style={{ background: 'linear-gradient(135deg, #0D1526 0%, #1a1020 100%)' }}>
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 blur-2xl" style={{ background: '#EA580C' }} />
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: '#EA580C22', border: '1px solid #EA580C44' }}>
                  <FileText className="w-5 h-5" style={{ color: '#EA580C' }} />
                </div>
                <h3 className="text-white font-bold text-lg mb-1">Smart Invoicing</h3>
                <p className="text-gray-400 text-sm">VAT-compliant invoices in seconds. Track payments, send receipts, export reports.</p>
              </div>

              {/* Card 2 */}
              <div className="group relative rounded-2xl p-6 overflow-hidden border border-gray-800/60 hover:border-[#16A34A]/40 transition-all duration-300" style={{ background: 'linear-gradient(135deg, #0D1526 0%, #0d1a10 100%)' }}>
                <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 blur-2xl" style={{ background: '#16A34A' }} />
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: '#16A34A22', border: '1px solid #16A34A44' }}>
                  <Boxes className="w-5 h-5" style={{ color: '#16A34A' }} />
                </div>
                <h3 className="text-white font-bold mb-1">Inventory</h3>
                <p className="text-gray-400 text-sm">Real-time stock, low-stock alerts, every movement tracked.</p>
              </div>

              {/* Card 3 */}
              <div className="group relative rounded-2xl p-6 overflow-hidden border border-gray-800/60 hover:border-[#2563EB]/40 transition-all duration-300" style={{ background: 'linear-gradient(135deg, #0D1526 0%, #0d1020 100%)' }}>
                <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 blur-2xl" style={{ background: '#2563EB' }} />
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: '#2563EB22', border: '1px solid #2563EB44' }}>
                  <Package className="w-5 h-5" style={{ color: '#2563EB' }} />
                </div>
                <h3 className="text-white font-bold mb-1">Orders</h3>
                <p className="text-gray-400 text-sm">Track, process and manage orders from one dashboard.</p>
              </div>

              {/* Card 4 — wide */}
              <div className="col-span-2 group relative rounded-2xl p-6 overflow-hidden border border-gray-800/60 hover:border-[#DB2777]/40 transition-all duration-300" style={{ background: 'linear-gradient(135deg, #0D1526 0%, #1a0d18 100%)' }}>
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 blur-2xl" style={{ background: '#DB2777' }} />
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: '#DB277722', border: '1px solid #DB277744' }}>
                    <Users className="w-5 h-5" style={{ color: '#DB2777' }} />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg mb-1">HR &amp; Payroll</h3>
                    <p className="text-gray-400 text-sm">Manage your team, attendance, payroll, and recruitment — all inside ExiusCart.</p>
                  </div>
                  <div className="ml-auto flex-shrink-0 hidden sm:flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#D9770622', border: '1px solid #D9770644' }}>
                      <Megaphone className="w-5 h-5" style={{ color: '#D97706' }} />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg mb-1">Marketing</h3>
                      <p className="text-gray-400 text-sm">Email, SMS campaigns, events and more.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Why ExiusCart */}
      <section className="py-20 px-4 bg-[#0D1526]">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Built for worldwide businesses
              </h2>
              <p className="text-gray-400 mb-10">
                From small shops to growing enterprises — ExiusCart is designed
                for real businesses. VAT-ready, multi-currency, and
                international-ready features all in one platform.
              </p>

              <div className="space-y-4">
                <BenefitRow text="VAT compliant invoicing (5%)" />
                <BenefitRow text="Connect any store or marketplace easily" />
                <BenefitRow text="Email & notification integration" />
                <BenefitRow text="Multi-currency & international-ready" />
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
              Trusted by Businesses Worldwide
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Real businesses running on ExiusCart — more success stories coming soon
            </p>
          </div>

          {/* Featured: TheDersi */}
          <div className="max-w-3xl mx-auto">
            <TestimonialCard
              name="TheDersi"
              business="Sri Lankan Fashion Marketplace"
              location="Sri Lanka · #1 Fashion Platform"
              rating={5}
              text="TheDersi is Sri Lanka's leading fashion marketplace. Our sellers rely on ExiusCart to manage their products, inventory, and orders — all in one place. It has made running a multi-seller marketplace seamless and efficient."
              featured
            />
          </div>

          <LiveStats />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-[#0D1526]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to simplify your business?
          </h2>
          <p className="text-gray-400 mb-10">
            Join businesses across UAE and worldwide using ExiusCart to manage their daily operations.
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
  featured,
}: {
  name: string;
  business: string;
  location: string;
  rating: number;
  text: string;
  featured?: boolean;
}) {
  return (
    <div className={`bg-[#151F32] rounded-2xl border p-6 relative ${featured ? 'border-[#6B3FD9]/40 shadow-lg shadow-[#6B3FD9]/10' : 'border-gray-800'}`}>
      <Quote className="absolute top-6 right-6 w-8 h-8 text-[#6B3FD9]/20" />

      {featured && (
        <div className="inline-flex items-center gap-1.5 bg-[#7B4FE9]/10 border border-[#7B4FE9]/30 text-[#7B4FE9] text-xs font-bold px-3 py-1 rounded-full mb-4">
          ✓ Verified Customer
        </div>
      )}

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

