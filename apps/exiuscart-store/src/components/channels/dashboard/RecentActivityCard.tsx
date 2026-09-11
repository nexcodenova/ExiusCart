'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ShoppingCart, Package, CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { timeAgo, type ChannelActivityItem } from './types';

// Real merged feed — actual ChannelSyncLog rows (listing/stock/price events)
// plus actual new-order events for this channel, already sorted newest-first
// by the backend. Nothing here is a placeholder; an empty list just means
// nothing has happened yet.
export default function RecentActivityCard({ channelType, activity }: { channelType: string; activity: ChannelActivityItem[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="text-sm font-bold text-foreground">Recent Activity</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Latest events from this connection.</p>
        </div>
        <Link href={`/dashboard/channels/listings?channel=${channelType}`}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-80 shrink-0">
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {activity.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Package className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No activity yet on this channel.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {activity.map((a, i) => (
            <li key={i} className="flex items-center gap-3 px-5 py-3">
              <div className="relative w-9 h-9 rounded-lg bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                {a.image_url ? (
                  <Image src={a.image_url} alt="" fill className="object-cover" unoptimized />
                ) : a.kind === 'order' ? (
                  <ShoppingCart className="w-4 h-4 text-muted-foreground/60" />
                ) : (
                  <Package className="w-4 h-4 text-muted-foreground/60" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate">{a.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">{a.description || '—'}</p>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                {a.success ? (
                  <Badge variant="success" className="text-[10px] gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Success
                  </Badge>
                ) : (
                  <Badge className="text-[10px] gap-1 border-transparent bg-destructive/10 text-destructive">
                    <XCircle className="w-2.5 h-2.5" /> Failed
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(a.created_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
