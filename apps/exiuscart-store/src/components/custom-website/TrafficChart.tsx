'use client';

import { useState, useEffect } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader2 } from 'lucide-react';
import { paymentGatewayApi } from '@/lib/api';

const PERIODS = [
  { value: 7, label: '7D' },
  { value: 30, label: '30D' },
  { value: 90, label: '90D' },
  { value: 365, label: '1Y' },
];

interface SeriesPoint { date: string; views: number; add_to_cart: number }

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-foreground mb-1">{new Date(label).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
      <p className="text-violet-500">Views: {payload[0]?.value}</p>
      <p className="text-primary">Added to cart: {payload[1]?.value}</p>
    </div>
  );
}

// Real page-view and add-to-cart counts from StorefrontEvent — the exact
// same tracking already behind "Orders per 100 Views" on the stat cards.
// No unique-visitor count exists (no session/cookie tracking by design),
// so this is real event counts per day, not a fabricated visitor total.
export default function TrafficChart({ shopId }: { shopId: string }) {
  const [period, setPeriod] = useState(7);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    paymentGatewayApi.getTrafficSeries(shopId, period)
      .then((r) => setSeries(r.data?.series ?? []))
      .catch(() => setSeries([]))
      .finally(() => setLoading(false));
  }, [shopId, period]);

  const totalViews = series.reduce((s, p) => s + p.views, 0);
  const totalAdds = series.reduce((s, p) => s + p.add_to_cart, 0);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-foreground">Website traffic</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Real page views and add-to-carts on your storefront</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1 shrink-0">
          {PERIODS.map((p) => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${period === p.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[220px] mt-4">
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-xs">Loading…</span>
          </div>
        ) : totalViews === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground text-center px-6 gap-1.5">
            <p>No page views tracked in this period yet.</p>
            <p className="text-xs max-w-sm">
              This only fills in once your website calls ExiusCart's tracking endpoint on page load — see <strong className="text-foreground">POST /public/store/&#123;slug&#125;/track</strong> in the <strong className="text-foreground">Developer Docs</strong> tab.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ left: 0, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="cw-views" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cw-adds" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11}
                tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                interval={period > 30 ? Math.floor(series.length / 6) : 'preserveStartEnd'} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={32} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="views" stroke="#8b5cf6" fill="url(#cw-views)" strokeWidth={2} />
              <Area type="monotone" dataKey="add_to_cart" stroke="hsl(var(--primary))" fill="url(#cw-adds)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-[11px] text-muted-foreground">Page Views</p>
          <p className="text-base font-bold text-foreground mt-0.5">{totalViews.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-[11px] text-muted-foreground">Added to Cart</p>
          <p className="text-base font-bold text-foreground mt-0.5">{totalAdds.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
