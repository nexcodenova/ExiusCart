import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export interface SyncedChannel {
  name: string;
  lastSyncedAt: string | null;
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never synced';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// The original design's mock showed 4 fake "Products/Orders/Inventory/
// Customers — Up to date" rows — no such per-category sync state exists
// anywhere in the backend, so it's rebuilt here as what's actually real:
// each CONNECTED channel's own last-synced timestamp (ChannelConnection.
// last_synced_at), and a refresh that re-fetches real data rather than
// pretending to trigger a sync that doesn't exist as a single action.
export default function SyncCenter({ channels, onRefresh, refreshing }: { channels: SyncedChannel[]; onRefresh: () => void; refreshing: boolean }) {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-card text-primary flex items-center justify-center shadow-sm shrink-0">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Synchronization Center</h3>
              <p className="text-[11px] text-muted-foreground">Keep all connected channels synchronized.</p>
            </div>
          </div>
          <Button size="sm" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh Status'}
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {channels.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Connect a channel to see its sync status here.</p>
          ) : (
            channels.map((c) => (
              <div key={c.name} className="flex items-center justify-between rounded-xl bg-card/70 px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-xs font-medium text-foreground">{c.name}</span>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">{timeAgo(c.lastSyncedAt)}</span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
