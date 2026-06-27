import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ShieldCheck, RefreshCw, XCircle, Clock, MessageCircle,
  Mail, CheckCircle, AlertTriangle, ArrowRight, BadgeCheck,
} from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  title: 'Refund Policy | ExiusCart',
  description: 'ExiusCart refund and cancellation policy. 14-day free trial with no credit card required. Learn about our money-back guarantee and subscription cancellation terms.',
  openGraph: {
    title: 'Refund Policy | ExiusCart',
    description: 'ExiusCart refund policy — 14-day free trial, 7-day money-back guarantee, and transparent subscription terms.',
    url: 'https://exiuscart.com/refund-policy',
    siteName: 'ExiusCart',
    type: 'website',
  },
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-[#0B1121]">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#6B3FD9]/30 bg-[#6B3FD9]/10 px-4 py-1.5 text-sm font-medium text-[#6B3FD9] mb-6">
            <ShieldCheck className="w-4 h-4" /> Refund Policy
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-4">
            Fair & Transparent<br />Refund Terms
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            We want you to succeed with ExiusCart. If something isn&apos;t right, we make it easy to get help or a refund.
          </p>
          <p className="text-gray-600 text-sm mt-4">Last updated: June 2026</p>
        </div>
      </section>

      {/* Quick summary cards */}
      <section className="pb-16 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#151F32] border border-[#6B3FD9]/20 rounded-2xl p-5 text-center">
            <div className="w-11 h-11 rounded-xl bg-[#6B3FD9]/10 flex items-center justify-center mx-auto mb-3">
              <BadgeCheck className="w-5 h-5 text-[#6B3FD9]" />
            </div>
            <p className="text-white font-semibold text-sm">14-Day Free Trial</p>
            <p className="text-gray-500 text-xs mt-1">No credit card required. Just try it.</p>
          </div>
          <div className="bg-[#151F32] border border-green-500/20 rounded-2xl p-5 text-center">
            <div className="w-11 h-11 rounded-xl bg-green-500/10 flex items-center justify-center mx-auto mb-3">
              <ShieldCheck className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-white font-semibold text-sm">7-Day Money Back</p>
            <p className="text-gray-500 text-xs mt-1">Full refund within 7 days of first payment.</p>
          </div>
          <div className="bg-[#151F32] border border-gray-800 rounded-2xl p-5 text-center">
            <div className="w-11 h-11 rounded-xl bg-gray-500/10 flex items-center justify-center mx-auto mb-3">
              <Clock className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-white font-semibold text-sm">5–7 Business Days</p>
            <p className="text-gray-500 text-xs mt-1">Processing time for approved refunds.</p>
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="pb-20 px-4">
        <div className="max-w-3xl mx-auto space-y-10">

          {/* 1. Free trial */}
          <div className="bg-[#151F32] rounded-2xl border border-gray-800 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800 bg-[#6B3FD9]/5">
              <div className="w-8 h-8 rounded-lg bg-[#6B3FD9]/10 flex items-center justify-center shrink-0">
                <BadgeCheck className="w-4 h-4 text-[#6B3FD9]" />
              </div>
              <h2 className="text-white font-bold text-lg">1. 14-Day Free Trial</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-gray-400 leading-relaxed">
                Every new ExiusCart account includes a <span className="text-white font-medium">14-day free trial</span> with full access to all features.
                No credit card is required to start. If you decide not to continue after the trial:
              </p>
              <ul className="space-y-2">
                {[
                  'Your account simply expires — no charges are made.',
                  'No cancellation steps needed.',
                  'Your data is retained for 30 days after trial expiry in case you change your mind.',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-400">
                    <CheckCircle className="w-4 h-4 text-[#6B3FD9] shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="rounded-xl bg-[#6B3FD9]/5 border border-[#6B3FD9]/20 px-4 py-3 text-sm text-[#9B6FFF]">
                The 14-day trial countdown starts only after your account is reviewed and approved by our team.
              </div>
            </div>
          </div>

          {/* 2. Subscription refunds */}
          <div className="bg-[#151F32] rounded-2xl border border-gray-800 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800 bg-green-500/5">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-green-400" />
              </div>
              <h2 className="text-white font-bold text-lg">2. Subscription Plan Refunds</h2>
            </div>
            <div className="px-6 py-5 space-y-5">
              <p className="text-gray-400 leading-relaxed">
                For paid subscription plans (Starter, Premium, Enterprise), the following refund terms apply:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                  <p className="text-green-400 font-semibold text-sm mb-2">Within 7 Days of Payment</p>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    You may request a <strong className="text-white">full refund</strong> within 7 days of your first subscription payment. No questions asked.
                  </p>
                </div>
                <div className="rounded-xl border border-gray-700 bg-[#0B1121] p-4">
                  <p className="text-gray-300 font-semibold text-sm mb-2">After 7 Days</p>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Refunds are not available after 7 days. You retain full access until the end of your current billing period.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-700 bg-[#0B1121] p-4 space-y-3">
                <p className="text-white font-semibold text-sm">Renewal Charges</p>
                <ul className="space-y-2">
                  {[
                    'Monthly plans: cancel anytime before your next renewal date to avoid the next charge.',
                    'Yearly plans: no refund for the remaining months after the 7-day window.',
                    'Partial-period refunds are not provided for subscription plans.',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-gray-400">
                      <span className="text-[#6B3FD9] mt-1 shrink-0">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* 3. Cancellation */}
          <div className="bg-[#151F32] rounded-2xl border border-gray-800 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800 bg-blue-500/5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <RefreshCw className="w-4 h-4 text-blue-400" />
              </div>
              <h2 className="text-white font-bold text-lg">3. Cancellation</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-gray-400 leading-relaxed">
                You can cancel your subscription at any time by contacting our support team. After cancellation:
              </p>
              <ul className="space-y-2">
                {[
                  'Your access continues until the end of the current paid period.',
                  'No further charges will be made after cancellation.',
                  'Your store data is retained for 60 days after your subscription ends.',
                  'Reactivation is available at any time within the data retention window.',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-400">
                    <CheckCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 4. Non-refundable */}
          <div className="bg-[#151F32] rounded-2xl border border-gray-800 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800 bg-red-500/5">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                <XCircle className="w-4 h-4 text-red-400" />
              </div>
              <h2 className="text-white font-bold text-lg">4. Non-Refundable Items</h2>
            </div>
            <div className="px-6 py-5">
              <p className="text-gray-400 text-sm mb-4">The following are not eligible for refunds under any circumstances:</p>
              <ul className="space-y-2">
                {[
                  'Custom development, integrations, or setup services',
                  'Onboarding, training, or consulting sessions',
                  'Accounts suspended or terminated due to Terms of Service violations',
                  'Subscription periods where the service was actively used beyond the 7-day window',
                  'Add-on services purchased separately',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-400">
                    <XCircle className="w-4 h-4 text-red-400/70 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 5. How to request */}
          <div className="bg-[#151F32] rounded-2xl border border-gray-800 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
              <div className="w-8 h-8 rounded-lg bg-[#6B3FD9]/10 flex items-center justify-center shrink-0">
                <MessageCircle className="w-4 h-4 text-[#6B3FD9]" />
              </div>
              <h2 className="text-white font-bold text-lg">5. How to Request a Refund</h2>
            </div>
            <div className="px-6 py-5 space-y-5">
              <p className="text-gray-400 text-sm">
                To submit a refund request, contact us via WhatsApp or email and include the following:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { num: '1', text: 'Your registered email address' },
                  { num: '2', text: 'Store name and account details' },
                  { num: '3', text: 'Date of payment' },
                  { num: '4', text: 'Reason for your refund request' },
                ].map((item) => (
                  <div key={item.num} className="flex items-center gap-3 bg-[#0B1121] border border-gray-800 rounded-xl px-4 py-3">
                    <span className="w-6 h-6 rounded-full bg-[#6B3FD9]/20 text-[#6B3FD9] text-xs font-bold flex items-center justify-center shrink-0">
                      {item.num}
                    </span>
                    <p className="text-gray-300 text-sm">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a
                  href="https://wa.me/971562393573"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20BD5A] text-white font-semibold px-5 py-3 rounded-xl transition-all text-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp Support
                </a>
                <a
                  href="mailto:support@exiuscart.com"
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-[#151F32] hover:bg-[#1A2540] text-white font-semibold px-5 py-3 rounded-xl transition-all border border-gray-700 text-sm"
                >
                  <Mail className="w-4 h-4" />
                  support@exiuscart.com
                </a>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-amber-500/5 border border-amber-500/20 px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-amber-300/80 text-sm">
                  Approved refunds are processed within <strong className="text-amber-300">5–7 business days</strong> back to your original payment method. Your bank may take additional time to reflect the refund.
                </p>
              </div>
            </div>
          </div>

          {/* 6. Policy changes */}
          <div className="bg-[#151F32] rounded-2xl border border-gray-800 px-6 py-5">
            <h2 className="text-white font-bold text-lg mb-3">6. Changes to This Policy</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              ExiusCart reserves the right to update this refund policy at any time. Material changes will be communicated via email to active subscribers at least 14 days before taking effect. The most recent version is always available at this page.
            </p>
          </div>

          {/* CTA */}
          <div className="rounded-2xl border border-[#6B3FD9]/20 bg-[#6B3FD9]/5 p-8 text-center">
            <h3 className="text-xl font-bold text-white mb-2">Still have questions?</h3>
            <p className="text-gray-400 text-sm mb-6">Our support team usually replies within a few hours.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold px-6 py-3 rounded-xl transition-all text-sm"
              >
                Contact Support <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 bg-transparent hover:bg-white/5 text-gray-300 font-semibold px-6 py-3 rounded-xl transition-all border border-gray-700 text-sm"
              >
                View Plans & Pricing
              </Link>
            </div>
          </div>

        </div>
      </section>

      <Footer />
    </div>
  );
}
