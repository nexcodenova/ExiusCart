import Link from 'next/link';
import { Zap, CheckCircle2, ArrowRight, Lock } from 'lucide-react';

// Honest, not a row of decorative-but-fake switches: "Import new orders" is
// real and always-on (every webhook POST creates an order unconditionally —
// there's no setting to turn off), "Send to supplier" is real but lives on
// the Dropshipping page (auto_fulfill_enabled is per-supplier, not
// per-channel, so a second toggle here would just be a second source of
// truth for the same setting), and the rest genuinely aren't built yet —
// shown clearly as such instead of as working switches with no backend.
export default function AutomationPanel() {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">Automation</h3>
          <p className="text-xs text-muted-foreground">What's real here, and what isn't yet</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-foreground">Import new orders</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Every order your website sends is created in ExiusCart automatically — there's no setting to turn this off.</p>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600 dark:text-green-400 shrink-0 whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3" /> Always on
          </span>
        </div>

        <div className="flex items-start justify-between gap-3 pt-3 border-t border-border">
          <div>
            <p className="text-xs font-semibold text-foreground">Send to supplier</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Real — set per connected supplier, applies to orders from every channel including this one.</p>
          </div>
          <Link href="/dashboard/dropshipping" className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:opacity-80 shrink-0 whitespace-nowrap">
            Manage <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {[
          { title: 'Sync stock to website', desc: 'Push stock changes back to your site automatically.' },
          { title: 'Push tracking updates', desc: 'Send tracking numbers back to your site when an order ships.' },
          { title: 'Send customer notifications', desc: 'Notify customers directly from ExiusCart when their order ships.' },
        ].map((f) => (
          <div key={f.title} className="flex items-start justify-between gap-3 pt-3 border-t border-border opacity-60">
            <div>
              <p className="text-xs font-semibold text-foreground">{f.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{f.desc}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground shrink-0 whitespace-nowrap">
              <Lock className="w-3 h-3" /> Not built yet
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
