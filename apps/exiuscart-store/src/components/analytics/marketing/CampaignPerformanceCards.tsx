import { Mail, MessageSquare, MessageCircle } from 'lucide-react';

interface ChannelPerf { sent: number; opened?: number; clicked?: number; delivered?: number; open_rate_pct?: number; delivery_rate_pct?: number }

const CHANNELS: { key: 'email' | 'sms' | 'whatsapp'; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'email', label: 'Email', icon: Mail, color: 'bg-blue-500/10 text-blue-600' },
  { key: 'sms', label: 'SMS', icon: MessageSquare, color: 'bg-violet-500/10 text-violet-600' },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'bg-emerald-500/10 text-emerald-600' },
];

export default function CampaignPerformanceCards({ data }: { data: Record<string, ChannelPerf> }) {
  return (
    <div className="grid sm:grid-cols-3 gap-4">
      {CHANNELS.map(({ key, label, icon: Icon, color }) => {
        const perf = data[key];
        const rate = perf.open_rate_pct ?? perf.delivery_rate_pct ?? 0;
        const rateLabel = perf.open_rate_pct !== undefined ? 'open rate' : 'delivery rate';
        return (
          <div key={key} className="border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}><Icon className="w-4 h-4" /></div>
              <p className="text-sm font-semibold text-foreground">{label}</p>
            </div>
            <p className="text-xl font-bold text-foreground tabular-nums">{perf.sent.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">sent</p>
            <p className="text-sm font-medium text-foreground mt-2 tabular-nums">{rate}% <span className="text-xs text-muted-foreground font-normal">{rateLabel}</span></p>
          </div>
        );
      })}
    </div>
  );
}
