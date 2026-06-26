import Link from 'next/link';
import { ArrowLeft, BadgeCheck, Clock, DollarSign, ShieldAlert, AlertTriangle } from 'lucide-react';

export const metadata = {
  title: 'Affiliate Terms & Conditions — ExiusCart',
  description: 'Full terms and conditions for the ExiusCart Affiliate Program, including commission rates, lock periods, eligibility rules, and payout conditions.',
};

export default function AffiliateTermsPage() {
  return (
    <div className="min-h-screen bg-[#FBF8F3] text-slate-900">
      {/* Nav */}
      <nav className="border-b border-slate-200/70 bg-[#FBF8F3]/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold"><span className="text-[#6B3FD9]">Exius</span>Cart</Link>
          <Link href="/affiliate" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition">
            <ArrowLeft className="h-4 w-4" /> Back to Affiliate Program
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#6B3FD9]/20 bg-[#6B3FD9]/5 px-4 py-1.5 text-sm font-medium text-[#6B3FD9] mb-4">
            <BadgeCheck className="h-4 w-4" /> Affiliate Program
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight">Affiliate Terms &amp; Conditions</h1>
          <p className="mt-3 text-slate-500 text-sm">Effective date: June 2026 · Applies to all ExiusCart Affiliate Program participants</p>
        </div>

        <div className="space-y-10">

          {/* Commission Rates */}
          <Section icon={DollarSign} title="1. Commission Rates">
            <p className="text-slate-600 mb-4">ExiusCart pays a one-time flat commission for each qualified referral that activates a paid subscription. Commissions are not recurring.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-500">Free Trial</p>
                <p className="text-3xl font-extrabold text-slate-300 mt-1">$0</p>
                <p className="text-xs text-slate-400 mt-1">No commission — referral has not paid</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-600">Monthly Plan</p>
                <p className="text-3xl font-extrabold text-emerald-600 mt-1">$25</p>
                <p className="text-xs text-slate-500 mt-1">One-time commission per referral</p>
              </div>
              <div className="rounded-2xl border-2 border-[#6B3FD9]/30 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-[#6B3FD9]">Yearly Plan</p>
                <p className="text-3xl font-extrabold text-[#6B3FD9] mt-1">$75</p>
                <p className="text-xs text-slate-500 mt-1">One-time commission per referral</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-500">Commission is credited to your affiliate account once the referred customer&apos;s payment is confirmed and the lock period has passed.</p>
          </Section>

          {/* Lock Period */}
          <Section icon={Clock} title="2. Lock Period (Holding Period)">
            <p className="text-slate-600">All commissions are subject to a <strong className="text-slate-900">45-day lock period</strong> from the date the referred customer makes their first payment.</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600 list-disc list-inside">
              <li>Commissions cannot be withdrawn or transferred during the lock period.</li>
              <li>The lock period exists to account for refund windows and chargeback periods.</li>
              <li>After 45 days, cleared commissions become available for payout request.</li>
              <li>If the referred customer requests a refund during the lock period, the commission is cancelled (see Section 4).</li>
            </ul>
          </Section>

          {/* Payout */}
          <Section icon={DollarSign} title="3. Payout Conditions">
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-2"><span className="text-[#6B3FD9] font-bold shrink-0">•</span><span>Payouts are processed via <strong className="text-slate-900">PayPal, Skrill, or Payoneer</strong> only. No other methods are available.</span></li>
              <li className="flex gap-2"><span className="text-[#6B3FD9] font-bold shrink-0">•</span><span>A minimum payout threshold applies — your cleared balance must reach <strong className="text-slate-900">$25</strong> before a withdrawal can be requested.</span></li>
              <li className="flex gap-2"><span className="text-[#6B3FD9] font-bold shrink-0">•</span><span>Payout requests are processed within <strong className="text-slate-900">7 business days</strong> of approval.</span></li>
              <li className="flex gap-2"><span className="text-[#6B3FD9] font-bold shrink-0">•</span><span>ExiusCart reserves the right to withhold payout if fraud or policy violation is suspected, pending investigation.</span></li>
            </ul>
          </Section>

          {/* Refund & Chargeback */}
          <Section icon={ShieldAlert} title="4. Refunds, Money-Back Guarantee &amp; Commission Reversal">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 mb-5">
              <p className="text-sm font-semibold text-amber-800 mb-1">Important — 7-Day Money-Back Guarantee Impact</p>
              <p className="text-sm text-amber-700">ExiusCart offers customers a 7-day money-back guarantee. If a referred customer claims a refund within their first 7 days, their commission is forfeited entirely and will not be paid to the affiliate.</p>
            </div>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-2"><span className="text-[#6B3FD9] font-bold shrink-0">•</span><span>If a referred customer receives a refund <strong className="text-slate-900">in their second billing month</strong> (i.e., after renewing once), the affiliate commission is also <strong className="text-slate-900">reversed and not paid</strong>.</span></li>
              <li className="flex gap-2"><span className="text-[#6B3FD9] font-bold shrink-0">•</span><span>Commissions that have already been paid out before a reversal occurs may be deducted from future earnings or recovered at ExiusCart&apos;s discretion.</span></li>
              <li className="flex gap-2"><span className="text-[#6B3FD9] font-bold shrink-0">•</span><span>Chargebacks initiated by the referred customer result in immediate commission cancellation regardless of timing.</span></li>
            </ul>
          </Section>

          {/* Eligibility Rules */}
          <Section icon={BadgeCheck} title="5. Commission Eligibility Rules">
            <p className="text-slate-600 mb-4">A referral is only considered a <em>qualified lead</em> and earns commission if ALL of the following conditions are met:</p>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-2"><span className="text-emerald-600 font-bold shrink-0">✓</span><span>The referred customer signed up using your unique affiliate referral link.</span></li>
              <li className="flex gap-2"><span className="text-emerald-600 font-bold shrink-0">✓</span><span>The referred customer is a <strong className="text-slate-900">new user</strong> who has not previously registered on ExiusCart.</span></li>
              <li className="flex gap-2"><span className="text-emerald-600 font-bold shrink-0">✓</span><span>The referred customer activates a <strong className="text-slate-900">paid subscription</strong> (Free Trial referrals earn $0).</span></li>
              <li className="flex gap-2"><span className="text-emerald-600 font-bold shrink-0">✓</span><span>You have created <strong className="text-slate-900">supporting content</strong> (landing page, blog post, social post, or video) that links to ExiusCart — bare link sharing without content is not permitted.</span></li>
              <li className="flex gap-2"><span className="text-emerald-600 font-bold shrink-0">✓</span><span>Your account is in good standing with no policy violations at the time of payout.</span></li>
            </ul>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <strong className="text-slate-800">Partnership label required:</strong> Once approved, you must display <em>&ldquo;Affiliate partner of ExiusCart by NexCodeNova&rdquo;</em> on your social profiles or website to activate payouts.
            </div>
          </Section>

          {/* Promotion Rules */}
          <Section icon={AlertTriangle} title="6. Promotion Rules">
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-2"><span className="text-[#6B3FD9] font-bold shrink-0">•</span><span><strong className="text-slate-900">Paid advertising is allowed</strong> — you may run Google, Meta, TikTok, or any ad platform to promote your referral link.</span></li>
              <li className="flex gap-2"><span className="text-[#6B3FD9] font-bold shrink-0">•</span><span><strong className="text-slate-900">Supporting content is required</strong> — you must create a landing page, blog post, social post, or video around your referral link. Directly sharing a bare link without any supporting content is not permitted and will result in commission ineligibility.</span></li>
              <li className="flex gap-2"><span className="text-[#6B3FD9] font-bold shrink-0">•</span><span>You may not make false or misleading claims about ExiusCart&apos;s features, pricing, or capabilities.</span></li>
              <li className="flex gap-2"><span className="text-[#6B3FD9] font-bold shrink-0">•</span><span>Spam, unsolicited mass messaging, or purchasing fake traffic is strictly prohibited and will result in immediate account termination.</span></li>
              <li className="flex gap-2"><span className="text-[#6B3FD9] font-bold shrink-0">•</span><span>Self-referrals (referring yourself or affiliated accounts) are prohibited.</span></li>
            </ul>
          </Section>

          {/* Termination */}
          <Section icon={ShieldAlert} title="7. Account Termination &amp; Disqualification">
            <p className="text-slate-600 mb-3">ExiusCart reserves the right to terminate any affiliate account and forfeit pending commissions for:</p>
            <ul className="space-y-2 text-sm text-slate-600 list-disc list-inside">
              <li>Violation of any of these terms</li>
              <li>Fraudulent activity, fake referrals, or traffic manipulation</li>
              <li>Misrepresentation of ExiusCart or NexCodeNova</li>
              <li>Failure to maintain the partnership label requirement after approval</li>
              <li>Using prohibited promotion methods</li>
            </ul>
            <p className="mt-3 text-sm text-slate-500">Upon termination, all pending and locked commissions are forfeited.</p>
          </Section>

          {/* General */}
          <Section icon={BadgeCheck} title="8. General">
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-2"><span className="text-[#6B3FD9] font-bold shrink-0">•</span><span>These terms may be updated at any time. Continued participation in the affiliate program after changes constitutes acceptance.</span></li>
              <li className="flex gap-2"><span className="text-[#6B3FD9] font-bold shrink-0">•</span><span>ExiusCart reserves the right to modify commission rates with 14 days&apos; notice to active affiliates.</span></li>
              <li className="flex gap-2"><span className="text-[#6B3FD9] font-bold shrink-0">•</span><span>This program is operated by <strong className="text-slate-900">NexCodeNova</strong>. All disputes are governed by applicable law.</span></li>
              <li className="flex gap-2"><span className="text-[#6B3FD9] font-bold shrink-0">•</span><span>For questions, contact us at <a href="mailto:affiliates@exiuscart.com" className="text-[#6B3FD9] hover:underline">affiliates@exiuscart.com</a>.</span></li>
            </ul>
          </Section>

        </div>

        {/* CTA */}
        <div className="mt-16 rounded-3xl border border-[#6B3FD9]/20 bg-[#6B3FD9]/5 p-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Ready to join?</h2>
          <p className="mt-2 text-slate-600">Apply now and start earning $75 per referral.</p>
          <Link href="/affiliate#apply" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#6B3FD9] px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#6B3FD9]/20 transition hover:bg-[#5A2EC9]">
            Apply to become an affiliate →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6B3FD9]/10 shrink-0">
          <Icon className="h-5 w-5 text-[#6B3FD9]" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      </div>
      {children}
    </div>
  );
}
