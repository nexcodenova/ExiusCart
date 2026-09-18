import Link from 'next/link';
import { Mail, MessageSquare, MessageCircle, Share2, ArrowUpRight } from 'lucide-react';
import type { UnifiedCampaign } from './normalizeCampaigns';

const CHANNEL_ICON: Record<UnifiedCampaign['channel'], React.ElementType> = {
  Email: Mail, SMS: MessageSquare, WhatsApp: MessageCircle, Social: Share2,
};

const CHANNEL_COLOR: Record<UnifiedCampaign['channel'], string> = {
  Email: 'bg-blue-500/10 text-blue-600', SMS: 'bg-violet-500/10 text-violet-600',
  WhatsApp: 'bg-emerald-500/10 text-emerald-600', Social: 'bg-pink-500/10 text-pink-600',
};

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground', scheduled: 'bg-amber-500/10 text-amber-600',
  sending: 'bg-amber-500/10 text-amber-600', publishing: 'bg-amber-500/10 text-amber-600',
  sent: 'bg-emerald-500/10 text-emerald-600', published: 'bg-emerald-500/10 text-emerald-600',
  partial: 'bg-amber-500/10 text-amber-600', failed: 'bg-destructive/10 text-destructive',
  canceled: 'bg-muted text-muted-foreground',
};

export default function CampaignsTable({ campaigns }: { campaigns: UnifiedCampaign[] }) {
  if (!campaigns.length) {
    return <p className="text-sm text-muted-foreground text-center py-12">No campaigns yet across any channel.</p>;
  }
  return (
    <div className="space-y-2">
      {campaigns.map((c) => {
        const Icon = CHANNEL_ICON[c.channel];
        return (
          <Link key={c.id} href={c.href}
            className="flex items-center gap-3 border border-border rounded-xl p-3.5 bg-card hover:border-primary/50 hover:shadow-sm transition group">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${CHANNEL_COLOR[c.channel]}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[c.status] ?? 'bg-muted text-muted-foreground'}`}>{c.status}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {c.channel}{c.recipients !== null && ` · ${c.recipients.toLocaleString()} recipients`}
                {c.date && ` · ${new Date(c.date).toLocaleDateString()}`}
              </p>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition" />
          </Link>
        );
      })}
    </div>
  );
}
