'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, AlertTriangle, Zap, X } from 'lucide-react';

interface PlanInfo {
  plan_type: string;
  status: string;
  is_trial: boolean;
  is_expired: boolean;
  daysLeft: number | null;
  source: string;
}

export function TrialBanner() {
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const shopId = localStorage.getItem('shop_id');
    if (!shopId) return;

    import('@/lib/api').then(({ subscriptionApi }) => {
      subscriptionApi.getCurrent(shopId)
        .then((res: any) => {
          const p = res.data?.plan;
          if (p && (p.is_trial || p.is_expired)) {
            setPlan(p);
          }
        })
        .catch(() => {});
    });
  }, []);

  if (!plan || dismissed) return null;

  // An expired trial can't reach any other page (dashboard/layout.tsx
  // replaces everything else with a full lock screen), so this only ever
  // renders here on Billing — a plain reminder of why they landed here.
  if (plan.is_expired) {
    return (
      <div className="bg-red-600 text-white px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Your free trial has expired. Upgrade to keep using ExiusCart.</span>
        </div>
      </div>
    );
  }

  if (plan.is_trial) {
    const days = plan.daysLeft ?? 0;
    const urgent = days <= 3;
    const progressPct = Math.round(((14 - days) / 14) * 100);

    return (
      <div className={`${urgent ? 'bg-orange-500' : 'bg-indigo-600'} text-white px-4 py-2 flex items-center justify-between gap-3`}>
        <div className="flex items-center gap-3 min-w-0">
          <Clock className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium truncate">
            {days === 0
              ? 'Trial expires today!'
              : `Free trial — ${days} day${days !== 1 ? 's' : ''} left`}
          </span>
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-24 h-1.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => router.push('/dashboard/billing')}
            className="flex items-center gap-1 bg-white text-indigo-600 text-xs font-bold px-3 py-1 rounded-lg hover:bg-indigo-50 transition"
          >
            <Zap className="w-3 h-3" />
            Upgrade
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-white/20 rounded transition"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
