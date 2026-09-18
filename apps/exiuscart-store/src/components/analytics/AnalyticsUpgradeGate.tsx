import Link from 'next/link';
import { Lock, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Shown when the backend's /analytics/* endpoints return the
// `upgrade_required` 403 — Growth/Scale only (TheDersi Pro/Official get it
// too, via the backend's is_thedersi_pro_shop() bump). Real Launch/Free
// Forever/Lite shops land here instead of an empty dashboard.
export default function AnalyticsUpgradeGate({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6 border border-dashed border-border rounded-2xl bg-muted/30">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
        <TrendingUp className="w-7 h-7 text-primary" />
      </div>
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Lock className="w-4 h-4 text-amber-500" /> {title}
      </h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
        Advanced Analytics — real-time revenue trends, product margins, channel attribution, customer LTV, and fulfillment performance — is available on Growth and Scale.
      </p>
      <Button asChild className="mt-6">
        <Link href="/dashboard/billing">Upgrade to unlock</Link>
      </Button>
    </div>
  );
}
