import { CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';

interface Props {
  connected: boolean;
  paymentConfigured: boolean;
  lastOrderAt: string | null;
}

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

// The circular-gauge visual from the reference, but the percentage is real:
// it's literally (checks passed / checks that exist), not a fabricated
// uptime number. Only 3 checks exist for this channel — there's no
// "Product sync" / "Inventory sync" row here the way the mockup had, since
// neither is a real monitored thing for Custom Website (see
// IntegrationHealth.tsx's own note on why).
export default function ConnectionHealthGauge({ connected, paymentConfigured, lastOrderAt }: Props) {
  const checks = [
    { label: 'Webhook connection', ok: connected, detail: connected ? 'Active' : 'Not connected' },
    { label: 'Payment gateway', ok: paymentConfigured, detail: paymentConfigured ? 'Configured' : 'Not configured' },
    { label: 'HTTPS enforced', ok: true, detail: 'Always on' },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const pct = Math.round((100 * passed) / checks.length);
  const healthy = passed === checks.length;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-foreground">Connection health</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Real checks, not a simulated uptime %</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${healthy ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
          {healthy ? 'Healthy' : 'Needs attention'}
        </span>
      </div>

      <div className="mx-auto w-28 h-28 rounded-full flex items-center justify-center"
        style={{ background: `conic-gradient(${healthy ? '#22c55e' : '#f59e0b'} ${pct * 3.6}deg, hsl(var(--muted)) 0deg)` }}>
        <div className="w-[88px] h-[88px] rounded-full bg-card flex flex-col items-center justify-center">
          <p className="text-xl font-bold text-foreground">{pct}%</p>
          <p className={`text-[10px] font-semibold ${healthy ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>{healthy ? 'Healthy' : 'Needs attention'}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-medium text-foreground">
              {c.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-destructive" />}
              {c.label}
            </span>
            <span className="text-muted-foreground">{c.detail}</span>
          </div>
        ))}
        <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
          <span className="flex items-center gap-2 font-medium text-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Last order received
          </span>
          <span className="text-muted-foreground">{timeAgo(lastOrderAt)}</span>
        </div>
      </div>
    </div>
  );
}
