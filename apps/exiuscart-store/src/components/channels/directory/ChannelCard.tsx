import { ArrowRight, Lock, Package, ShoppingCart, Clock3 } from 'lucide-react';
import { channelMeta } from '@/components/channels/channelMeta';
import ChannelLogo from '@/components/channels/ChannelLogo';
import { cn } from '@/lib/utils';

export interface ChannelDef {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: React.ReactNode;
  channelType?: string;
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

const badgeLabels: Record<string, string> = {
  live: 'Connected',
  connect: 'Available',
  soon: 'Coming soon',
  locked: 'Not on your plan',
};

const dot: Record<ChannelDef['badge'], string> = {
  live: 'bg-emerald-500',
  connect: 'bg-primary',
  soon: 'bg-muted-foreground/40',
  locked: 'bg-amber-500',
};

// Directory card in the calm "store" style (Apify-like): the whole card is the
// action, a plain body (logo, name, category, description) and a grey footer
// strip with the status on the left and real stats or the next step on the
// right. Every gating state (live/connect/soon/locked) and its copy is kept;
// stats are real numbers from /channels/stats, never made up.
export default function ChannelCard({ channel, stat }: { channel: ChannelDef; stat?: ChannelStat }) {
  const clickable = !!channel.onAction;
  const meta = channel.channelType ? channelMeta(channel.channelType) : null;
  // Wordmark logos (Walmart, Trendyol, Jumia...) need a wider box than square icons, or they get cut off
  const wideLogo = !!(meta?.logo && meta.wide);
  const status = channel.badgeLabel ?? badgeLabels[channel.badge];
  const action = channel.badge === 'live' ? (channel.actionLabel ?? 'Manage')
    : channel.badge === 'locked' ? (channel.actionLabel ?? 'Upgrade')
    : channel.badge === 'soon' ? 'Learn more'
    : (channel.actionLabel ?? 'Connect');

  return (
    <button
      type="button"
      onClick={channel.onAction}
      disabled={!clickable}
      className={cn(
        'group flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition',
        clickable && 'hover:border-foreground/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background', wideLogo ? 'max-w-[104px] px-2.5' : 'w-11')}>
            {channel.channelType && meta?.logo
              ? <ChannelLogo channelType={channel.channelType} size={wideLogo ? 18 : 24} />
              : channel.icon}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-foreground">{channel.name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{channel.category.toLowerCase().replace(/\s+/g, '-')}/{channel.id.replace(/_/g, '-')}</p>
          </div>
        </div>
        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{channel.description}</p>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-5 py-2.5 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 text-foreground">
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot[channel.badge])} />
          <span className="truncate">{status}</span>
        </span>
        {channel.badge === 'live' && stat ? (
          <span className="flex shrink-0 items-center gap-3 text-muted-foreground">
            <span className="flex items-center gap-1" title="Products synced"><Package className="h-3.5 w-3.5" /> {stat.products_synced.toLocaleString()}</span>
            <span className="flex items-center gap-1" title="Orders synced"><ShoppingCart className="h-3.5 w-3.5" /> {stat.orders_synced.toLocaleString()}</span>
            {stat.last_synced_at && <span className="hidden items-center gap-1 sm:flex" title="Last synced"><Clock3 className="h-3.5 w-3.5" /> {timeAgo(stat.last_synced_at)}</span>}
          </span>
        ) : clickable ? (
          <span className="flex shrink-0 items-center gap-1 font-medium text-foreground transition group-hover:text-primary">
            {channel.badge === 'locked' && <Lock className="h-3.5 w-3.5" />}
            {action}
            {channel.badge !== 'locked' && <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />}
          </span>
        ) : null}
      </div>
    </button>
  );
}
