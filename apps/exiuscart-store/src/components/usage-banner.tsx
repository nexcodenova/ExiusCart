'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { usageApi } from '@/lib/api';

interface UsageItem {
  used: number;
  limit: number | null; // null = unlimited
}

interface UsageData {
  plan: string | null;
  reset_label: string;
  emails: {
    invoice: UsageItem;
    quotation: UsageItem;
    marketing: UsageItem;
  };
  orders: UsageItem;
  products: UsageItem;
}

interface UsageBannerProps {
  shopId: string;
  show: ('invoice_emails' | 'quotation_emails' | 'orders' | 'products')[];
  // Render nothing unless something is at/near its limit — for placing the
  // warning on pages (e.g. the dashboard home) that shouldn't carry the
  // full usage bars all the time.
  warnOnly?: boolean;
}

const NEAR_LIMIT_PCT = 80;

function Bar({ item, label }: { item: UsageItem; label: string }) {
  if (!item || item.limit === null) return null; // unlimited — don't show

  const pct = item.limit > 0 ? Math.min((item.used / item.limit) * 100, 100) : 0;
  const isNear = pct >= 80;
  const isFull = pct >= 100;

  const barColor = isFull
    ? 'bg-red-500'
    : isNear
    ? 'bg-yellow-500'
    : 'bg-indigo-500';

  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{label}</span>
      <div className="flex-1 min-w-[80px] h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold tabular-nums whitespace-nowrap shrink-0 ${isFull ? 'text-red-500' : isNear ? 'text-yellow-600 dark:text-yellow-400' : 'text-foreground'}`}>
        {item.used} / {item.limit}
      </span>
    </div>
  );
}

export function UsageBanner({ shopId, show, warnOnly = false }: UsageBannerProps) {
  const [data, setData] = useState<UsageData | null>(null);

  useEffect(() => {
    if (!shopId) return;
    usageApi.get(shopId).then(r => setData(r.data)).catch(() => {});
  }, [shopId]);

  if (!data) return null;

  type ShowKey = UsageBannerProps['show'][number];
  const all: { key: ShowKey; label: string; item: UsageItem }[] = [
    { key: 'invoice_emails' as ShowKey,   label: 'Invoice emails',   item: data.emails.invoice },
    { key: 'quotation_emails' as ShowKey, label: 'Quotation emails', item: data.emails.quotation },
    { key: 'orders' as ShowKey,           label: 'Channel orders',   item: data.orders },
    { key: 'products' as ShowKey,         label: 'Products',         item: data.products },
  ];
  const items = all.filter(x => show.includes(x.key) && x.item?.limit !== null);

  if (items.length === 0) return null;

  // Only the two limits that actually reject real work when hit: channel
  // orders (the backend answers the marketplace's order webhook with a 429,
  // so the buyer's order is refused) and products (creating one fails).
  const warnings = items
    .filter(({ key, item }) => (key === 'orders' || key === 'products') && item.limit! > 0
      && (item.used / item.limit!) * 100 >= NEAR_LIMIT_PCT)
    .map(({ key, label, item }) => ({ key, label, item, full: item.used >= item.limit! }));

  if (warnOnly && warnings.length === 0) return null;

  // Plans set by TheDersi can't be upgraded from ExiusCart billing.
  const isTheDersi = (data.plan ?? '').startsWith('thedersi');

  return (
    <div className="space-y-2">
      {!warnOnly && (
        <div className="bg-card border border-border rounded-xl px-3.5 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-2">
          {items.map(({ key, label, item }) => (
            <Bar key={key} item={item} label={label} />
          ))}
          <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
            Resets {data.reset_label}
          </span>
        </div>
      )}
      {warnings.map(({ key, label, item, full }) => (
        <div key={key} role="alert"
          className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3.5 py-2.5 text-sm ${
            full
              ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
          }`}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">
            {full
              ? key === 'orders'
                ? `Monthly order limit reached (${item.used}/${item.limit}). New orders from your sales channels are being rejected until ${data.reset_label}.`
                : `Product limit reached (${item.used}/${item.limit}). You can't add more products on this plan.`
              : key === 'orders'
                ? `You've used ${item.used} of ${item.limit} channel orders this month. Once you reach ${item.limit}, new channel orders are rejected until ${data.reset_label}.`
                : `You're using ${item.used} of ${item.limit} ${label.toLowerCase()}. You won't be able to add more once you reach ${item.limit}.`}
          </span>
          {isTheDersi ? (
            <Link href="/dashboard/billing" className="whitespace-nowrap text-xs font-semibold underline">
              See TheDersi plans
            </Link>
          ) : (
            <Link href="/dashboard/billing" className="whitespace-nowrap text-xs font-semibold underline">
              Upgrade plan
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
