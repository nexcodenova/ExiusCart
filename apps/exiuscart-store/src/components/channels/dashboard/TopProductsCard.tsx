'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Package, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useCurrency } from '@/components/providers/currency-provider';
import type { ChannelTopProduct } from './types';

const RANK_CLASS = [
  'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  'bg-muted text-muted-foreground',
  'bg-amber-500/15 text-amber-600 dark:text-amber-400',
];

// Real top-5 products by revenue on this channel's orders, from actual
// order items — not a copy of the shop-wide bestsellers list. growth_pct is
// a real last-30-days-vs-prior-30-days revenue comparison per product;
// null (shown as "—") when there's no prior-period revenue to compare against.
export default function TopProductsCard({ channelType, products }: { channelType: string; products: ChannelTopProduct[] }) {
  const { fmt } = useCurrency();
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="text-sm font-bold text-foreground">Top Performing Products</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Best-selling products on this channel.</p>
        </div>
        <Link href={`/dashboard/channels/orders?channel=${channelType}`}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-80 shrink-0">
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Package className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No orders yet on this channel.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {products.map((p, i) => (
            <li key={p.product_id ?? i} className="flex items-center gap-3 px-5 py-3">
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${RANK_CLASS[i] ?? 'bg-muted text-muted-foreground'}`}>
                {i + 1}
              </div>
              <div className="relative w-9 h-9 rounded-lg bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                {p.image_url ? (
                  <Image src={p.image_url} alt="" fill className="object-cover" unoptimized />
                ) : (
                  <Package className="w-4 h-4 text-muted-foreground/60" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold leading-4 text-foreground line-clamp-2">{p.name}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{p.orders} sold</p>
              </div>
              <div className="hidden sm:block text-right shrink-0">
                <p className="text-xs font-bold text-foreground">{fmt(p.revenue)}</p>
                {p.growth_pct === null ? (
                  <span className="mt-1 inline-block text-[9px] text-muted-foreground">—</span>
                ) : (
                  <span className={`mt-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    p.growth_pct >= 0 ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {p.growth_pct >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    {Math.abs(p.growth_pct)}%
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
