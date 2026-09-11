'use client';

import { ShoppingCart, Package, Coins, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useCurrency } from '@/components/providers/currency-provider';
import { timeAgo, type ChannelDashboardKPIs } from './types';

function KPICard({ icon: Icon, iconClass, label, value, sub }: {
  icon: React.ElementType; iconClass: string; label: string; value: string; sub?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold tracking-tight text-foreground">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

// Real KPI row for a channel's connected dashboard — total orders, revenue,
// products listed and last sync, all from the same /dashboard endpoint call
// (no separate approximations, no fabricated "conversion rate" style metric
// that isn't actually computable from what we store).
export default function ChannelKPICards({ kpis }: { kpis: ChannelDashboardKPIs }) {
  const { fmt } = useCurrency();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KPICard icon={ShoppingCart} iconClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
        label="Total Orders" value={kpis.total_orders.toLocaleString()} sub="All time on this channel" />
      <KPICard icon={Package} iconClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        label="Products Listed" value={kpis.products_listed.toLocaleString()} sub="Currently live" />
      <KPICard icon={Coins} iconClass="bg-green-500/10 text-green-600 dark:text-green-400"
        label="Revenue" value={fmt(kpis.revenue)} sub="Paid orders, all time" />
      <KPICard icon={RefreshCw} iconClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        label="Last Sync" value={timeAgo(kpis.last_synced_at)} sub={kpis.last_synced_at ? 'Auto-sync on new orders' : 'No sync recorded yet'} />
    </div>
  );
}
