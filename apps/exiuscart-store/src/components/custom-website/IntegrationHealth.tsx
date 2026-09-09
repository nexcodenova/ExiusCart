import { CheckCircle2, XCircle, HeartPulse, AlertTriangle } from 'lucide-react';

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface HealthProps {
  connected: boolean;
  paymentConfigured: boolean;
  lastOrderAt: string | null;
  recentSuccessRate: number | null; // % of last 20 orders that are paid
}

// Deliberately not the mockup's "API endpoint / Product sync / Inventory
// sync: Operational" rows — none of those are actually monitored for this
// channel (Custom Website has no periodic sync to monitor in the first
// place, see WorkflowDiagram). Every row here is backed by something real:
// whether the connection exists, whether payments are configured, when the
// last real order actually arrived, and the real recent payment success
// rate — not a fabricated uptime percentage.
export default function IntegrationHealth({ connected, paymentConfigured, lastOrderAt, recentSuccessRate }: HealthProps) {
  const items = [
    { label: 'Webhook connection', ok: connected, detail: connected ? 'Active' : 'Not connected' },
    { label: 'Payment gateway', ok: paymentConfigured, detail: paymentConfigured ? 'Configured' : 'Not configured' },
    { label: 'Last order received', ok: !!lastOrderAt, detail: timeAgo(lastOrderAt) },
  ];
  const okCount = items.filter((i) => i.ok).length;
  const healthy = okCount === items.length;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <HeartPulse className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Connection health</h3>
            <p className="text-xs text-muted-foreground">Real signals, not a simulated uptime %</p>
          </div>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${healthy ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
          {healthy ? 'Healthy' : 'Needs attention'}
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-medium text-foreground">
              {item.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-destructive" />}
              {item.label}
            </span>
            <span className="text-muted-foreground">{item.detail}</span>
          </div>
        ))}
        {recentSuccessRate != null && (
          <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
            <span className="font-medium text-foreground">Recent payment success rate</span>
            <span className={recentSuccessRate >= 90 ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold'}>
              {recentSuccessRate}% <span className="text-muted-foreground font-normal">(last 20 orders)</span>
            </span>
          </div>
        )}
      </div>

      {!connected && (
        <div className="mt-4 flex items-start gap-2 bg-amber-500/10 rounded-lg p-3">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">Connect your website in the Connection & Payments tab to start receiving orders.</p>
        </div>
      )}
    </div>
  );
}
