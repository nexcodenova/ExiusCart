'use client';

import { useEffect, useState } from 'react';
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
}

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

export function UsageBanner({ shopId, show }: UsageBannerProps) {
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

  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
      {items.map(({ key, label, item }) => (
        <Bar key={key} item={item} label={label} />
      ))}
      <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
        Resets {data.reset_label}
      </span>
    </div>
  );
}
