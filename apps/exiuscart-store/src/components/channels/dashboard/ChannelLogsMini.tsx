'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, FileClock, Loader2, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { channelsApi } from '@/lib/api';

interface SyncLogRow {
  id: number;
  product_name: string | null;
  action: string;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = {
  create_listing: 'Listing created',
  update_stock: 'Stock synced',
  update_price: 'Price updated',
  update_listing: 'Listing updated',
  delete_listing: 'Listing removed',
  sync_order: 'Order synced',
};

// Real, unfiltered feed straight off ChannelSyncLog for this channel — every
// attempt, success or failure, append-only. The "Recent Activity" card on
// Overview shows a curated top slice; this is the raw log for troubleshooting.
export default function ChannelLogsMini({ shopId, channelType, limit = 50 }: { shopId: string; channelType: string; limit?: number }) {
  const [rows, setRows] = useState<SyncLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    channelsApi.getSyncLogs(shopId, { channel_type: channelType, limit })
      .then((r) => setRows(r.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [shopId, channelType, limit]);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="text-sm font-bold text-foreground">Integration Logs</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Every sync attempt on this channel — success or failure.</p>
        </div>
        <Link href={`/dashboard/channels/listings?channel=${channelType}`}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-80 shrink-0">
          Full listings view <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-14 text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-xs">Loading…</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <FileClock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No sync attempts logged yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border max-h-[420px] overflow-y-auto">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-5 py-2.5">
              {r.success ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-foreground truncate">
                  <span className="font-semibold">{ACTION_LABEL[r.action] ?? r.action}</span>
                  {r.product_name && <span className="text-muted-foreground"> — {r.product_name}</span>}
                </p>
                {!r.success && r.error_message && (
                  <p className="text-[11px] text-destructive truncate">{r.error_message}</p>
                )}
              </div>
              <span className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">
                {new Date(r.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
