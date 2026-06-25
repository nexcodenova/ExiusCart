'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  DollarSign, Users, Check, Loader2, ArrowLeft, ArrowRight, Store, Zap,
  Sparkles, Clock, Wallet, BadgeCheck, Play,
} from 'lucide-react';

const HOW_IT_WORKS = [
  { step: '1', title: 'Apply', desc: 'Fill in the short form. We review and approve within 24 hours.' },
  { step: '2', title: 'Get your link', desc: 'Receive a unique referral link like exiuscart.com/register?ref=YOU.' },
  { step: '3', title: 'Share it', desc: 'Post it on social media, WhatsApp groups, YouTube, or send to business owners directly.' },
  { step: '4', title: 'Earn every month', desc: 'When a referred shop pays for a plan, you earn — every month they stay subscribed.' },
];

const METRICS = [
  { icon: DollarSign, value: 'Up to 40%', label: 'Recurring commission' },
  { icon: Wallet, value: 'Monthly', label: 'Payouts' },
  { icon: Clock, value: '24 hours', label: 'Approval time' },
  { icon: BadgeCheck, value: 'Free', label: 'To join, no minimums' },
];

export default function AffiliatePage() {
  const [affiliateType, setAffiliateType] = useState<'external' | 'shop_owner'>('external');
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', company: '', website: '', how_promote: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const rates = affiliateType === 'shop_owner' ? { base: 25, tier2: 40 } : { base: 20, tier2: 35 };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;
    setIsLoading(true);
    setError('');
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_URL}/api/v1/affiliates/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, affiliate_type: affiliateType }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'Something went wrong. Please try again.'); return; }
      setSubmitted(true);
    } catch {
      setError('Could not connect to the server. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF8F3] text-slate-900">
      {/* Nav */}
      <nav className="border-b border-slate-200/70 bg-[#FBF8F3]/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold"><span className="text-[#6B3FD9]">Exius</span>Cart</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-slate-600 hover:text-slate-900 transition">Sign in</Link>
            <a href="#apply" className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-800">Become an affiliate</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-32 -top-24 h-72 w-72 rounded-full bg-[#6B3FD9]/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 top-40 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#6B3FD9]/20 bg-[#6B3FD9]/5 px-4 py-1.5 text-sm font-medium text-[#6B3FD9]">
              <Sparkles className="h-4 w-4" /> ExiusCart Affiliate Program
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Earn up to <span className="text-[#6B3FD9]">40%</span> recurring commission
            </h1>
            <p className="mt-5 max-w-lg text-lg text-slate-600">
              Refer businesses to ExiusCart and earn every single month they stay subscribed. Free to join, no minimums, payouts every month.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#apply" className="inline-flex items-center gap-2 rounded-xl bg-[#6B3FD9] px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#6B3FD9]/20 transition hover:bg-[#5A2EC9]">
                Get started <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#how" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-900 transition hover:bg-slate-50">
                <Play className="h-4 w-4 text-[#6B3FD9]" /> See how it works
              </a>
            </div>
          </div>

          {/* Video — clean rounded media frame (the mp4 has its own background baked in) */}
          <div className="relative">
            <video
              className="w-full rounded-2xl object-cover shadow-xl ring-1 ring-slate-900/5"
              src="/affiliate/exiuscart-affiliate-video.mp4"
              autoPlay muted loop playsInline
            />
          </div>
        </div>
      </section>

      {/* Metrics bar */}
      <section className="border-y border-slate-200/70 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-8 lg:grid-cols-4">
          {METRICS.map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#6B3FD9]/10"><Icon className="h-5 w-5 text-[#6B3FD9]" /></div>
              <div>
                <p className="text-xl font-bold tracking-tight">{value}</p>
                <p className="text-sm text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
          <p className="mt-3 text-slate-600">Four simple steps from sign-up to your first payout.</p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.step} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#6B3FD9] text-lg font-bold text-white">{s.step}</div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Commission tiers */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">One program, two tracks</h2>
            <p className="mt-3 text-slate-600">The more you refer each month, the higher your rate.</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* External */}
            <div className="rounded-3xl border border-slate-200 bg-[#FBF8F3] p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100"><Users className="h-5 w-5 text-blue-600" /></div>
                <div><p className="font-semibold">External Affiliate</p><p className="text-xs text-slate-500">Anyone can apply</p></div>
              </div>
              <div className="mt-5 space-y-3">
                <Tier label="1–10 referrals / month" tier="Tier 1" value="20%" color="text-[#6B3FD9]" />
                <Tier label="11+ referrals / month" tier="Tier 2" value="35%" color="text-emerald-600" />
              </div>
            </div>
            {/* Shop owner */}
            <div className="relative rounded-3xl border-2 border-[#6B3FD9]/40 bg-white p-7 shadow-lg shadow-[#6B3FD9]/5">
              <span className="absolute -top-3 right-6 rounded-full bg-[#6B3FD9] px-3 py-1 text-xs font-bold text-white">Higher rates</span>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#6B3FD9]/10"><Store className="h-5 w-5 text-[#6B3FD9]" /></div>
                <div><p className="font-semibold">ExiusCart Shop Owner</p><p className="text-xs text-slate-500">Must have an active shop</p></div>
              </div>
              <div className="mt-5 space-y-3">
                <Tier label="1–10 referrals / month" tier="Tier 1" value="25%" color="text-[#6B3FD9]" />
                <Tier label="11+ referrals / month" tier="Tier 2" value="40%" color="text-emerald-600" />
              </div>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-[#6B3FD9]/20 bg-[#6B3FD9]/5 px-5 py-4 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">Example:</span> You refer 15 shops in a month. The first 10 pay at your Tier 1 rate, the remaining 5 at Tier 2. Tiers reset each calendar month.
          </div>
        </div>
      </section>

      {/* Application form */}
      <section id="apply" className="mx-auto max-w-2xl px-6 py-20">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 lg:p-8">
          {submitted ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100"><Check className="h-8 w-8 text-emerald-600" /></div>
              <h2 className="text-2xl font-bold">Application submitted!</h2>
              <p className="mt-2 text-slate-600">We&apos;ll review and reply at <strong className="text-slate-900">{formData.email}</strong> within 24 hours.</p>
              <Link href="/" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#6B3FD9] hover:underline"><ArrowLeft className="h-4 w-4" /> Back to home</Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight">Apply to become an affiliate</h2>
                <p className="mt-1 text-sm text-slate-500">Free to join. No minimum sales required.</p>
              </div>

              <div className="mb-5 grid grid-cols-2 gap-3">
                <TypeBtn active={affiliateType === 'external'} onClick={() => setAffiliateType('external')} icon={Users} title="External Affiliate" sub="20% → 35%" />
                <TypeBtn active={affiliateType === 'shop_owner'} onClick={() => setAffiliateType('shop_owner')} icon={Store} title="I'm a Shop Owner" sub="25% → 40%" highlight />
              </div>

              {affiliateType === 'shop_owner' && (
                <div className="mb-5 rounded-lg border border-[#6B3FD9]/20 bg-[#6B3FD9]/5 px-4 py-3 text-sm text-slate-600">
                  <Zap className="mr-1.5 inline h-4 w-4 text-[#6B3FD9]" /> Use the <strong className="text-slate-900">same email</strong> as your ExiusCart shop account — we verify it automatically.
                </div>
              )}

              <div className="mb-5 flex items-center gap-3 rounded-xl bg-[#FBF8F3] px-4 py-3 text-sm">
                <DollarSign className="h-4 w-4 shrink-0 text-[#6B3FD9]" />
                <span className="text-slate-600">Your rates: <strong className="text-[#6B3FD9]">{rates.base}%</strong> for first 10 referrals/month, <strong className="text-emerald-600">{rates.tier2}%</strong> after that</span>
              </div>

              {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Full name *"><input type="text" required value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Your name" className={inputCls} /></Field>
                  <Field label={affiliateType === 'shop_owner' ? 'ExiusCart account email *' : 'Email address *'}><input type="email" required value={formData.email} onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} placeholder={affiliateType === 'shop_owner' ? 'Your shop account email' : 'you@example.com'} className={inputCls} /></Field>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Phone"><input type="tel" value={formData.phone} onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+XX XX XXX XXXX" className={inputCls} /></Field>
                  <Field label="Company / business"><input type="text" value={formData.company} onChange={(e) => setFormData(p => ({ ...p, company: e.target.value }))} placeholder="Optional" className={inputCls} /></Field>
                </div>
                <Field label="Website / social media"><input type="text" value={formData.website} onChange={(e) => setFormData(p => ({ ...p, website: e.target.value }))} placeholder="https://yoursite.com or TikTok/Instagram link" className={inputCls} /></Field>
                <Field label="How will you promote ExiusCart?"><textarea value={formData.how_promote} onChange={(e) => setFormData(p => ({ ...p, how_promote: e.target.value }))} rows={3} placeholder="e.g. I run a WhatsApp group of 500 business owners and will share my link with a short explainer..." className={`${inputCls} resize-none`} /></Field>

                <button type="submit" disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6B3FD9] py-3.5 text-base font-bold text-white transition hover:bg-[#5A2EC9] disabled:opacity-60">
                  {isLoading ? <><Loader2 className="h-5 w-5 animate-spin" /> Submitting...</> : `Apply — ${rates.base}% to ${rates.tier2}% commission`}
                </button>
                <p className="text-center text-xs text-slate-500">By applying you agree to our <Link href="/terms" className="text-[#6B3FD9] hover:underline">Terms</Link> and <Link href="/privacy" className="text-[#6B3FD9] hover:underline">Privacy Policy</Link>.</p>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6B3FD9] focus:outline-none focus:ring-2 focus:ring-[#6B3FD9]/15';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-sm text-slate-600">{label}</label>{children}</div>;
}

function Tier({ label, tier, value, color }: { label: string; tier: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200/70">
      <div><p className="text-xs text-slate-500">{label}</p><p className="mt-0.5 text-xs text-slate-400">{tier}</p></div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function TypeBtn({ active, onClick, icon: Icon, title, sub, highlight }: { active: boolean; onClick: () => void; icon: React.ElementType; title: string; sub: string; highlight?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition ${active ? 'border-[#6B3FD9] bg-[#6B3FD9]/5' : 'border-slate-200 hover:border-slate-300'}`}>
      <Icon className={`h-6 w-6 ${active ? 'text-[#6B3FD9]' : 'text-slate-400'}`} />
      <span className={`text-sm font-medium ${active ? 'text-slate-900' : 'text-slate-600'}`}>{title}</span>
      <span className={`text-xs ${highlight ? 'font-medium text-[#6B3FD9]' : 'text-slate-500'}`}>{sub}</span>
    </button>
  );
}
