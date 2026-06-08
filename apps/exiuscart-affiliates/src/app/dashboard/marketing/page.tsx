'use client';

import { useState } from 'react';
import { Copy, Check, Link2, MessageSquare, Twitter, Send } from 'lucide-react';

const AFFILIATE_CODE = 'AFF-XXXX'; // will come from API
const REFERRAL_LINK = `https://exiuscart.com/register?ref=${AFFILIATE_CODE}`;

const copyTexts = [
  {
    platform: 'WhatsApp / General',
    icon: MessageSquare,
    color: '#25D366',
    text: `🚀 I use ExiusCart to manage my business — invoicing, inventory, orders all in one place!\n\nSign up free for 14 days 👇\n${REFERRAL_LINK}`,
  },
  {
    platform: 'Twitter / X',
    icon: Twitter,
    color: '#1DA1F2',
    text: `Running a shop? Try @ExiusCart — POS, VAT invoicing, inventory & more in one dashboard. 14-day free trial 👇 ${REFERRAL_LINK}`,
  },
  {
    platform: 'Telegram',
    icon: Send,
    color: '#0088CC',
    text: `💼 ExiusCart — Smart business management for shops. Invoicing, inventory, orders & more.\n\n✅ 14 days free trial\n✅ No credit card needed\n\n${REFERRAL_LINK}`,
  },
];

export default function MarketingPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Marketing</h1>
        <p className="text-gray-400 text-sm mt-1">Your referral link and ready-to-share content</p>
      </div>

      {/* Referral link */}
      <div className="bg-[#151F32] border border-gray-800 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="w-4 h-4 text-[#7B4FE9]" />
          <h2 className="text-white font-semibold">Your Referral Link</h2>
        </div>
        <p className="text-gray-400 text-xs mb-3">Share this link. Anyone who signs up through it is tracked to you.</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-[#0D1526] border border-gray-700 rounded-xl px-4 py-3 text-sm text-[#7B4FE9] font-mono truncate">
            {REFERRAL_LINK}
          </div>
          <button
            onClick={() => copy(REFERRAL_LINK, 'link')}
            className="flex items-center gap-2 bg-[#7B4FE9] hover:bg-[#5A2EC9] text-white px-4 py-3 rounded-xl text-sm font-medium transition-all flex-shrink-0"
          >
            {copied === 'link' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied === 'link' ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
          <span>Your code: <span className="text-white font-mono font-bold">{AFFILIATE_CODE}</span></span>
        </div>
      </div>

      {/* Copy templates */}
      <h2 className="text-white font-semibold mb-4">Ready-to-Share Copy</h2>
      <div className="space-y-4">
        {copyTexts.map(({ platform, icon: Icon, color, text }) => (
          <div key={platform} className="bg-[#151F32] border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}22` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <span className="text-white text-sm font-medium">{platform}</span>
              </div>
              <button
                onClick={() => copy(text, platform)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-all"
              >
                {copied === platform ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied === platform ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="text-gray-400 text-xs leading-relaxed whitespace-pre-wrap font-sans bg-[#0D1526] rounded-lg p-3 border border-gray-800">
              {text}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
