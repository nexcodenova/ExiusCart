import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Lock, Package, ShoppingCart, Clock3 } from 'lucide-react';

export interface ChannelDef {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: React.ReactNode;
  badge: 'live' | 'connect' | 'soon' | 'locked';
  badgeLabel?: string;
  onAction?: () => void;
  actionLabel?: string;
}

export interface ChannelStat {
  products_synced: number;
  orders_synced: number;
  last_synced_at: string | null;
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const badgeVariant: Record<ChannelDef['badge'], 'success' | 'default' | 'muted'> = {
  live: 'success',
  connect: 'default',
  soon: 'muted',
  locked: 'muted',
};
const badgeLabels: Record<string, string> = {
  live: 'Connected',
  connect: 'Available',
  soon: 'Coming Soon',
  locked: 'Not on your plan',
};

// Same real Card/Badge/Button primitives the previous ChannelTile used —
// this redesign adds the stat row (real products/orders/last-synced, from
// channels.py's /channels/stats, never fabricated) and a denser, more
// premium layout, but keeps every gating state (live/connect/soon/locked)
// and its exact copy untouched.
export default function ChannelCard({ channel, stat }: { channel: ChannelDef; stat?: ChannelStat }) {
  return (
    <Card className={`group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-black/[0.03] hover:-translate-y-0.5 ${
      channel.badge === 'live' ? 'border-green-500/25 bg-gradient-to-br from-green-500/[0.04] to-transparent' : 'hover:border-primary/30'
    }`}>
      <CardContent className="p-5 flex flex-col gap-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="w-12 h-12 rounded-2xl bg-muted/70 ring-1 ring-border flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:ring-primary/20 transition-all duration-200">
            {channel.icon}
          </div>
          <Badge variant={badgeVariant[channel.badge]} className="shrink-0 gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${
              channel.badge === 'live' ? 'bg-green-500' : channel.badge === 'connect' ? 'bg-primary' : 'bg-muted-foreground/40'
            }`} />
            {channel.badgeLabel ?? badgeLabels[channel.badge]}
          </Badge>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground text-sm">{channel.name}</p>
            <span className="text-[10px] text-muted-foreground">{channel.category}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{channel.description}</p>
        </div>

        {channel.badge === 'live' && stat ? (
          <div className="grid grid-cols-2 gap-2 border-t border-border pt-3.5">
            <div>
              <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <Package className="w-3 h-3" /> Products
              </div>
              <p className="text-sm font-bold text-foreground mt-0.5">{stat.products_synced.toLocaleString()}</p>
            </div>
            <div>
              <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <ShoppingCart className="w-3 h-3" /> Orders
              </div>
              <p className="text-sm font-bold text-foreground mt-0.5">{stat.orders_synced.toLocaleString()}</p>
            </div>
            {stat.last_synced_at && (
              <p className="col-span-2 flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                <Clock3 className="w-3 h-3" /> Last synced {timeAgo(stat.last_synced_at)}
              </p>
            )}
          </div>
        ) : (
          <div className="border-t border-border pt-3.5 text-[10px] text-muted-foreground">
            {channel.badge === 'soon' ? 'Not yet available' : 'Secure OAuth or API-key connection'}
          </div>
        )}

        {channel.onAction && channel.badge === 'live' && (
          <Button variant="success" className="w-full" onClick={channel.onAction}>
            {channel.actionLabel ?? 'Manage'} <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        )}
        {channel.onAction && channel.badge === 'connect' && (
          <Button className="w-full" onClick={channel.onAction}>
            {channel.actionLabel ?? 'Connect'} <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        )}
        {channel.onAction && channel.badge === 'locked' && (
          <Button variant="outline" className="w-full" onClick={channel.onAction}>
            <Lock className="w-3.5 h-3.5" /> {channel.actionLabel ?? 'Upgrade to Premium'}
          </Button>
        )}
        {channel.onAction && channel.badge === 'soon' && (
          <Button variant="outline" className="w-full" onClick={channel.onAction}>
            Learn more
          </Button>
        )}
      </CardContent>

      {channel.badge === 'live' && (
        <div className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-emerald-400 via-primary to-blue-500 opacity-0 transition group-hover:opacity-100" />
      )}
    </Card>
  );
}
