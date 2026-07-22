'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, AlertTriangle, Zap, X, Lock } from 'lucide-react';

interface PlanInfo {
  plan_type: string;
  status: string;
  is_trial: boolean;
  is_expired: boolean;
  daysLeft: number | null;
  source: string;
}

const LOCK_RENAG_MS = 60_000; // expired trials see this interruption every minute

export function TrialBanner() {
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showLock, setShowLock] = useState(false);
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

  // Expired trials keep dashboard access (nothing is actually blocked) but
  // get interrupted with an upgrade prompt every minute — dismissible each
  // time, reappears on its own rather than staying gone for the session.
  useEffect(() => {
    if (!plan?.is_expired) return;
    setShowLock(true);
    const interval = setInterval(() => setShowLock(true), LOCK_RENAG_MS);
    return () => clearInterval(interval);
  }, [plan?.is_expired]);

  const lockModal = plan?.is_expired && showLock && (
    <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-md p-6 relative text-center">
        <button
          type="button"
          onClick={() => setShowLock(false)}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
          aria-label="Continue browsing"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-2">Your free trial has ended</h3>
        <p className="text-sm text-muted-foreground mb-5">
          Upgrade to Starter or Premium to keep selling, adding products, and using ExiusCart without interruption.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => { setShowLock(false); router.push('/dashboard/billing'); }}
            className="w-full bg-red-600 text-white font-bold px-4 py-2.5 rounded-lg hover:bg-red-700 transition"
          >
            Upgrade Now
          </button>
          <button
            type="button"
            onClick={() => setShowLock(false)}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition"
          >
            Continue browsing
          </button>
        </div>
      </div>
    </div>
  );

  if (!plan || dismissed) return lockModal || null;

  if (plan.is_expired) {
    return (
      <>
        <div className="bg-red-600 text-white px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Your free trial has expired. Upgrade to keep using ExiusCart.</span>
          </div>
          <button
            onClick={() => router.push('/dashboard/billing')}
            className="flex-shrink-0 bg-white text-red-600 text-xs font-bold px-3 py-1 rounded-lg hover:bg-red-50 transition"
          >
            Upgrade Now
          </button>
        </div>
        {lockModal}
      </>
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
