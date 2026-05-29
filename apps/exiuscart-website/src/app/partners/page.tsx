import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight, Share2, DollarSign, Users, TrendingUp,
  CheckCircle, MessageCircle, Store, Zap, BarChart3,
} from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  title: 'Affiliate Program | Earn 20–40% Commission | ExiusCart',
  description:
    'Join the ExiusCart affiliate program. Earn 20–35% as an external affiliate or 25–40% as an ExiusCart shop owner. Tiered commissions — the more you refer, the more you earn.',
  openGraph: {
    title: 'ExiusCart Affiliate Program | Earn 20–40% Commission',
    description: 'One program, two tracks. Earn tiered commissions for every shop you bring to ExiusCart.',
    url: 'https://exiuscart.com/partners',
    siteName: 'ExiusCart',
    type: 'website',
  },
};

const HOW_IT_WORKS = [
  { step: '1', title: 'Apply', desc: 'Submit your application. Approved within 24 hours.' },
  { step: '2', title: 'Get your link', desc: 'Receive a unique referral link — share it anywhere.' },
  { step: '3', title: 'They sign up', desc: 'A shop owner registers using your link and starts their trial.' },
  { step: '4', title: 'You earn', desc: "When they activate a paid plan, your commission is recorded automatically." },
];

const WHAT_YOU_GET = [
  { icon: BarChart3, title: 'Earnings Dashboard', desc: 'See every referral, commission, and payout in real time.' },
  { icon: Share2, title: 'Unique Referral Link', desc: 'Your own link — works on any channel, forever.' },
  { icon: Zap, title: 'Instant Tracking', desc: 'Commissions recorded the moment a subscription is approved.' },
  { icon: DollarSign, title: 'Monthly Payouts', desc: 'Commissions paid out at the start of each month.' },
];

export default function PartnersPage() {
  return (
    <div className="min-h-screen bg-[#0B1121]">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-[#6B3FD9]/10 text-[#6B3FD9] text-sm font-medium px-4 py-2 rounded-full mb-6">
            <Share2 className="w-4 h-4" />
            Affiliate Program
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold text-white leading-[1.1] mb-6">
            Refer businesses.<br />
            <span className="text-[#6B3FD9]">Earn up to 40%.</span>
          </h1>
          <p className="text-lg text-gray-400 leading-relaxed max-w-2xl mx-auto mb-10">
            One affiliate program, two tracks. The more shops you refer each month,
            the higher your commission rate. No cap, no ceiling.
          </p>
          <Link
            href="/affiliate"
            className="inline-flex items-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-black font-bold px-10 py-4 rounded-xl text-lg transition"
          >
            Apply Now — It's Free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Commission Tiers */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-4">Commission Structure</h2>
          <p className="text-gray-400 text-center mb-12 max-w-xl mx-auto">
            Tiers reset every calendar month. The first 10 paid referrals earn Tier 1. Every referral after that earns Tier 2.
          </p>

          <div className="grid md:grid-cols-2 gap-8">

            {/* External */}
            <div className="bg-[#151F32] rounded-2xl border border-gray-800 p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <Users className="w-7 h-7 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">External Affiliate</h3>
                  <p className="text-sm text-gray-500">Anyone can apply</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between bg-[#0B1121] rounded-xl px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-white">Tier 1</p>
                    <p className="text-xs text-gray-500 mt-0.5">1–10 paid referrals / month</p>
                  </div>
                  <p className="text-3xl font-bold text-[#6B3FD9]">20%</p>
                </div>
                <div className="flex items-center justify-between bg-[#0B1121] rounded-xl px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-white">Tier 2</p>
                    <p className="text-xs text-gray-500 mt-0.5">11+ paid referrals / month</p>
                  </div>
                  <p className="text-3xl font-bold text-green-400">35%</p>
                </div>
              </div>

              <div className="space-y-2 mb-8">
                {['No minimum requirements', 'Open to everyone', 'Monthly payouts'].map((t) => (
                  <div key={t} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-gray-300">{t}</span>
                  </div>
                ))}
              </div>

              <Link
                href="/affiliate"
                className="block text-center bg-[#151F32] hover:bg-[#1e2d47] text-white font-semibold py-3 rounded-xl border border-gray-700 transition"
              >
                Apply as External Affiliate
              </Link>
            </div>

            {/* Shop Owner */}
            <div className="bg-[#151F32] rounded-2xl border-2 border-[#6B3FD9] p-8 relative overflow-hidden">
              <div className="absolute -top-1 -right-1">
                <span className="bg-[#6B3FD9] text-black text-xs font-bold px-3 py-1.5 rounded-bl-lg">
                  HIGHER RATES
                </span>
              </div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-[#6B3FD9]/10 rounded-xl flex items-center justify-center">
                  <Store className="w-7 h-7 text-[#6B3FD9]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Shop Owner Affiliate</h3>
                  <p className="text-sm text-gray-500">For existing ExiusCart customers</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between bg-[#0B1121] rounded-xl px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-white">Tier 1</p>
                    <p className="text-xs text-gray-500 mt-0.5">1–10 paid referrals / month</p>
                  </div>
                  <p className="text-3xl font-bold text-[#6B3FD9]">25%</p>
                </div>
                <div className="flex items-center justify-between bg-[#0B1121] rounded-xl px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-white">Tier 2</p>
                    <p className="text-xs text-gray-500 mt-0.5">11+ paid referrals / month</p>
                  </div>
                  <p className="text-3xl font-bold text-green-400">40%</p>
                </div>
              </div>

              <div className="space-y-2 mb-8">
                {['Must have an active ExiusCart shop', 'Apply with your shop account email', 'Verified automatically'].map((t) => (
                  <div key={t} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-gray-300">{t}</span>
                  </div>
                ))}
              </div>

              <Link
                href="/affiliate"
                className="block text-center bg-[#6B3FD9] hover:bg-[#5A2EC9] text-black font-bold py-3 rounded-xl transition"
              >
                Apply as Shop Owner
              </Link>
            </div>
          </div>

          {/* Example callout */}
          <div className="mt-6 bg-[#6B3FD9]/5 border border-[#6B3FD9]/20 rounded-xl px-6 py-4 text-sm text-gray-400 text-center">
            <strong className="text-white">Example (Shop Owner):</strong> You refer 15 shops in April.
            First 10 earn <span className="text-[#6B3FD9] font-semibold">25%</span> each.
            The remaining 5 earn <span className="text-green-400 font-semibold">40%</span> each.
            Resets on May 1st.
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-[#0D1526]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">How It Works</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="text-center">
                <div className="w-14 h-14 bg-[#6B3FD9]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-[#6B3FD9] font-bold text-xl">{step.step}</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What Affiliates Get */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">What You Get</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {WHAT_YOU_GET.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="bg-[#151F32] rounded-xl border border-gray-800 p-6 text-center">
                  <div className="w-12 h-12 bg-[#6B3FD9]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-6 h-6 text-[#6B3FD9]" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">{item.title}</h3>
                  <p className="text-gray-500 text-sm">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-[#0D1526]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to start earning?
          </h2>
          <p className="text-gray-400 mb-10">
            Apply in 2 minutes. No commitment. Start earning once approved.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/affiliate"
              className="inline-flex items-center justify-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-black font-bold px-10 py-4 rounded-xl transition text-lg"
            >
              Apply Now
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="https://wa.me/971562393573?text=Hi!%20I%20want%20to%20join%20the%20ExiusCart%20affiliate%20program"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20BD5A] text-white font-semibold px-10 py-4 rounded-xl transition text-lg"
            >
              <MessageCircle className="w-5 h-5" />
              Ask via WhatsApp
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

