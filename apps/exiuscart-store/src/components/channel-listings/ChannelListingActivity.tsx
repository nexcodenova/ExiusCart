'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, Package, ArrowRight, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { channelsApi } from '@/lib/api';
import { channelMeta } from './channelMeta';
import type { ListingRow } from './ListingsTable';

const STATUS_ICON: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
  failed: <XCircle className="w-3.5 h-3.5 text-destructive" />,
  processing: <Clock className="w-3.5 h-3.5 text-blue-500" />,
  warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
};

// Drop-in section for any channel's integration page — shows that channel's
// own slice of the Channel Listings feed (same real data, filtered to this
// channel_type) with a link through to the full page.
export default function ChannelListingActivity({
  shopId,
  channelType,
  limit = 5,
}: {
  shopId: string;
  channelType: string;
  limit?: number;
}) {
  const [rows, setRows] = useState<ListingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const meta = channelMeta(channelType);

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    channelsApi
      .getListings(shopId, { channel_types: channelType, show_retries: false, page: 1, page_size: limit })
      .then((r) => {
        setRows(r.data?.rows ?? []);
        setTotal(r.data?.total ?? 0);
      })
      .catch(() => {
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [shopId, channelType, limit]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
        <div>
          <p className="font-semibold text-foreground text-sm">Listing activity</p>
          <p className="text-xs text-muted-foreground">Every {meta.label} listing, stock sync and price update</p>
        </div>
        <Link
          href={`/dashboard/channel-listings?channel=${channelType}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-80 shrink-0"
        >
          View all{total > 0 ? ` (${total})` : ''} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Loading…</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Package className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">
            No listing activity yet. This fills up the moment you list a product on {meta.label}.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-5 py-3">
              <div className="relative w-8 h-8 rounded-md bg-muted overflow-hidden shrink-0">
                {r.product_image_url ? (
                  <Image src={r.product_image_url} alt="" fill className="object-cover" unoptimized />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Package className="w-3 h-3 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate">{r.product_name ?? '—'}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {r.error_message ?? (r.synthetic ? 'Available via API' : 'Completed successfully.')}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {STATUS_ICON[r.status] ?? null}
                <span className="whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
