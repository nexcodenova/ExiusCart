'use client';

import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { channelsApi } from '@/lib/api';

// Same list the dashboard header's currency switcher and the Custom
// Website storefront-currency setting use — never a narrower choice.
const CURRENCIES = [
  'AED', 'SAR', 'USD', 'EUR', 'GBP', 'INR', 'LKR', 'BDT', 'PKR', 'MYR',
  'SGD', 'CAD', 'AUD', 'QAR', 'KWD', 'BHD', 'OMR', 'EGP', 'NGN', 'KES',
  'ZAR', 'TRY', 'IDR', 'PHP', 'THB', 'JPY', 'CNY',
];

// ExiusCart has no way to know what currency a seller's own Shopify/eBay/
// WooCommerce store actually uses (that's set up on the channel's own
// side) — only the seller knows, same reasoning as eBay's seller_country
// field. Left unset, prices push over unconverted, exactly like before
// this existed.
export function ChannelCurrencyField({ shopId, channelId, initialValue, storeName }: {
  shopId: string;
  channelId: number;
  initialValue: string | null | undefined;
  storeName: string;
}) {
  const [value, setValue] = useState(initialValue ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async (next: string) => {
    setValue(next);
    setSaving(true); setSaved(false);
    try {
      await channelsApi.setChannelCurrency(shopId, channelId, next || null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <label className="text-sm text-muted-foreground mb-1.5 block flex items-center gap-2">
        What currency does your {storeName} store use?
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {saved && !saving && <Check className="w-3.5 h-3.5 text-green-500" />}
      </label>
      <select value={value} onChange={(e) => save(e.target.value)}
        className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm">
        <option value="">Unknown — don&apos;t convert prices</option>
        {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
        Products pushed to {storeName} get converted to this currency using a live exchange rate first. Leave unset only if you&apos;re not sure — an unconverted price is safer than a wrong guess.
      </p>
    </div>
  );
}
