'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { useCurrency } from '@/context/currency-context';
import { pricing } from '@/config/pricing';

export function PricingPreview() {
  const { currency, currencyConfig, isLoading } = useCurrency();
  const prices = pricing[currency];
  const [hovering, setHovering] = useState(false);
  const [tapped, setTapped] = useState(false);
  const flipped = hovering || tapped;

  if (isLoading) {
    return (
      <div className="bg-[#151F32] rounded-2xl border border-gray-800 p-8 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-24 mb-4" />
        <div className="h-12 bg-gray-700 rounded w-32 mb-2" />
        <div className="h-4 bg-gray-700 rounded w-48 mb-8" />
        <div className="space-y-3 mb-8">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-4 bg-gray-700 rounded w-36" />)}
        </div>
        <div className="h-12 bg-gray-700 rounded" />
      </div>
    );
  }

  const starterMonthly = prices.starter.monthly;
  const premiumMonthly = prices.premium.monthly;
  const priceDisplay = currency === 'USD' ? `$${starterMonthly}` : `AED ${starterMonthly}`;
  const premiumDisplay = currency === 'USD' ? `$${premiumMonthly}` : `AED ${premiumMonthly}`;

  return (
    <div
      className="relative h-[520px] [perspective:1600px] cursor-pointer"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={() => setTapped(t => !t)}
    >
      <div
        className="relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d]"
        style={{ transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        {/* Front — illustration */}
        <div className="absolute inset-0 [backface-visibility:hidden] rounded-2xl overflow-hidden border border-gray-800 bg-[#F5F3EF]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/integration/pricing.jpg" alt="ExiusCart pricing" className="w-full h-full object-contain" />
          <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold text-center py-2.5">
            See full pricing & plans →
          </div>
        </div>

        {/* Back — real, dynamic pricing */}
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-[#151F32] rounded-2xl border border-gray-800 p-8 overflow-y-auto">
          {/* Trial badge */}
          <div className="inline-flex items-center gap-2 bg-[#7B4FE9]/10 border border-[#7B4FE9]/30 text-[#7B4FE9] text-xs font-bold px-3 py-1 rounded-full mb-4">
            14-day free trial
          </div>

          <p className="text-gray-400 text-sm mb-1">Starter plan from</p>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-5xl font-bold text-white">{priceDisplay}</span>
            <span className="text-gray-400 text-sm">/month</span>
          </div>
          <p className="text-gray-500 text-xs mb-6">
            Premium from {premiumDisplay}/month &nbsp;·&nbsp; Yearly saves ~15%
          </p>

          <div className="space-y-3 mb-8">
            <PricingFeature text="POS & VAT Invoicing" />
            <PricingFeature text="Inventory Management" />
            <PricingFeature text="Multi-Store & Marketplace Connect" />
            <PricingFeature text="Lead Management" />
            <PricingFeature text="Sales & VAT Reports" />
          </div>

          <Link
            href="/pricing"
            onClick={e => e.stopPropagation()}
            className="block text-center bg-[#7B4FE9] hover:bg-[#5A2EC9] text-white font-semibold py-4 rounded-xl transition-all"
          >
            View All Plans
          </Link>

          <p className="text-center text-gray-600 text-xs mt-4">
            {currencyConfig.flag} Prices for {currencyConfig.country}
          </p>
        </div>
      </div>
    </div>
  );
}

function PricingFeature({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <Check className="w-4 h-4 text-[#7B4FE9]" />
      <span className="text-gray-300 text-sm">{text}</span>
    </div>
  );
}
