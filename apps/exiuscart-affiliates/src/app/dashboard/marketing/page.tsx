'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, Link2, MessageSquare, Twitter, Send } from 'lucide-react';

export default function MarketingPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const [affiliateCode, setAffiliateCode] = useState('');

  useEffect(() => {
    const code = localStorage.getItem('affiliate_code') || '';
    setAffiliateCode(code);
  }, []);

  // Tracking link goes through our API to count clicks, then redirects to the register page
  const trackingLink = affiliateCode
    ? `https://api.exiuscart.com/api/v1/affiliates/ref/${affiliateCode}`
    : '';
  const referralLink = trackingLink;

  const copyTexts = affiliateCode ? [
    {
      platform: 'WhatsApp / General',
      icon: MessageSquare,
      color: '#25D366',
      text: `🚀 I use ExiusCart to manage my business — invoicing, inventory, orders all in one place!\n\nSign up free for 14 days 👇\n${referralLink}`,
    },
    {
      platform: 'Twitter / X',
      icon: Twitter,
      color: '#1DA1F2',
      text: `Running a shop? Try @ExiusCart — POS, VAT invoicing, inventory & more in one dashboard. 14-day free trial 👇 ${referralLink}`,
    },
    {
      platform: 'Telegram',
      icon: Send,
      color: '#0088CC',
      text: `💼 ExiusCart — Smart business management for shops. Invoicing, inventory, orders & more.\n\n✅ 14 days free trial\n✅ No credit card needed\n\n${referralLink}`,
    },
  ] : [];

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Marketing</h1>
        <p className="text-gray-500 text-sm mt-1">Your referral link and ready-to-share content</p>
      </div>

      {/* Earnings callout */}
      <div className="bg-[#7B4FE9]/8 border border-[#7B4FE9]/20 rounded-2xl p-5 mb-6 flex flex-col sm:flex-row gap-4 items-center">
        <div className="flex-1">
          <p className="text-gray-900 font-bold text-base mb-1">Earn up to <span className="text-[#7B4FE9] text-2xl font-black">$75</span> per referral</p>
          <p className="text-gray-500 text-sm">One-time commission per qualified referral that activates a paid plan.</p>
        </div>
        <div className="flex gap-4 shrink-0">
          <div className="text-center bg-white rounded-xl px-5 py-3 border border-gray-200">
            <p className="text-2xl font-black text-gray-900">$25</p>
            <p className="text-xs text-gray-400 mt-0.5">Monthly plan</p>
          </div>
          <div className="text-center bg-[#7B4FE9]/10 rounded-xl px-5 py-3 border border-[#7B4FE9]/30">
            <p className="text-2xl font-black text-[#7B4FE9]">$75</p>
            <p className="text-xs text-gray-500 mt-0.5">Yearly plan</p>
          </div>
        </div>
      </div>

      {/* Content policy */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
        <p className="text-amber-700 font-semibold text-sm mb-2">Promotion Policy — Please read</p>
        <ul className="text-gray-600 text-sm space-y-1.5">
          <li>✅ <span className="font-medium">Paid ads allowed</span> — Google, Meta, TikTok, any platform. No restrictions.</li>
          <li>⚠️ <span className="font-medium">Do not share a bare link</span> — you must pair your referral link with content: a landing page, blog post, social post, or video.</li>
          <li>🏷️ <span className="font-medium">Label required</span> — display <span className="text-amber-700 font-mono">&quot;Affiliate partner of ExiusCart by NexCodeNova&quot;</span> on your profile or site. This must be done before payouts are enabled.</li>
        </ul>
      </div>

      {/* Referral link */}
      {affiliateCode ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="w-4 h-4 text-[#7B4FE9]" />
            <h2 className="text-gray-900 font-semibold">Your Referral Link</h2>
          </div>
          <p className="text-gray-400 text-xs mb-3">Share this link. Anyone who signs up through it is tracked to you for 30 days.</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#7B4FE9] font-mono truncate">
              {referralLink}
            </div>
            <button
              onClick={() => copy(referralLink, 'link')}
              className="flex items-center gap-2 bg-[#7B4FE9] hover:bg-[#5A2EC9] text-white px-4 py-3 rounded-xl text-sm font-medium transition-all flex-shrink-0"
            >
              {copied === 'link' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied === 'link' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
            <span>Your code: <span className="text-gray-900 font-mono font-bold">{affiliateCode}</span></span>
            <span>· Tracking cookie: 30 days</span>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 text-center text-gray-400 text-sm">
          Referral link unavailable — your account may not be active yet.
        </div>
      )}

      {/* Copy templates */}
      {copyTexts.length > 0 && (
        <>
          <h2 className="text-gray-900 font-semibold mb-4">Ready-to-Share Copy</h2>
          <div className="space-y-4">
            {copyTexts.map(({ platform, icon: Icon, color, text }) => (
              <div key={platform} className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <span className="text-gray-900 text-sm font-medium">{platform}</span>
                  </div>
                  <button
                    onClick={() => copy(text, platform)}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-all"
                  >
                    {copied === platform ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied === platform ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="text-gray-500 text-xs leading-relaxed whitespace-pre-wrap font-sans bg-gray-50 rounded-lg p-3 border border-gray-100">
                  {text}
                </pre>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
