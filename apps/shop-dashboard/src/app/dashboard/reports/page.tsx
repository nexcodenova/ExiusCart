'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BarChart3, TrendingUp, DollarSign, ShoppingCart, Users, Download, Calendar, FileText } from 'lucide-react';
import { reportsApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

export default function ReportsPage() {
  const [salesData, setSalesData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
  const { fmt } = useCurrency();

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    const now = new Date();
    const from = new Date();
    if (period === 'week') from.setDate(now.getDate() - 7);
    else if (period === 'month') from.setMonth(now.getMonth() - 1);
    else from.setFullYear(now.getFullYear() - 1);

    Promise.all([
      reportsApi.getSalesReport(shopId, { from: from.toISOString().split('T')[0], to: now.toISOString().split('T')[0] }),
      reportsApi.getTopProducts(shopId),
    ])
      .then(([salesRes, topRes]) => {
        setSalesData(salesRes.data ?? []);
        setTopProducts(topRes.data ?? []);
      })
      .catch(() => { setSalesData([]); setTopProducts([]); })
      .finally(() => setLoading(false));
  }, [shopId, period]);

  const totalSales = salesData.reduce((sum: number, d: any) => sum + (d.sales ?? 0), 0);
  const totalOrders = salesData.reduce((sum: number, d: any) => sum + (d.orders ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground text-sm">Analyze your business performance</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['week', 'month', 'year'] as const).map((p) => (
            <button key={p} type="button" onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${period === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'This Year'}
            </button>
          ))}
          <Link
            href="/dashboard/reports/vat"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-muted transition"
          >
            <FileText className="w-4 h-4" /> VAT Report
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Sales', value: loading ? '—' : fmt(totalSales, 0), icon: <DollarSign className="w-5 h-5" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Total Orders', value: loading ? '—' : totalOrders.toString(), icon: <ShoppingCart className="w-5 h-5" />, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10' },
          { label: 'Avg. Order', value: loading || totalOrders === 0 ? '—' : fmt(Math.round(totalSales / totalOrders), 0), icon: <TrendingUp className="w-5 h-5" />, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10' },
          { label: 'Top Products', value: loading ? '—' : topProducts.length.toString(), icon: <BarChart3 className="w-5 h-5" />, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10' },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl border border-border p-4">
            <div className={`w-10 h-10 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center mb-3`}>{stat.icon}</div>
            <p className="text-muted-foreground text-xs mb-1">{stat.label}</p>
            <p className="text-xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Chart Area */}
      {loading ? (
        <div className="bg-card rounded-xl border border-border p-8">
          <div className="h-48 bg-muted rounded-lg animate-pulse" />
        </div>
      ) : salesData.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-16 text-center">
          <BarChart3 className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="font-semibold text-foreground mb-1">No data yet</h3>
          <p className="text-sm text-muted-foreground">Sales data will appear here once you start making sales</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="font-semibold text-foreground mb-4">Sales Overview</h2>
          <div className="space-y-2">
            {salesData.map((d: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-12 text-right">{d.label ?? d.day ?? d.month}</span>
                <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                  <div className="bg-primary h-4 rounded-full" style={{ width: `${totalSales ? (d.sales / totalSales) * 100 : 0}%` }} />
                </div>
                <span className="text-xs font-medium text-foreground w-24 text-right">{fmt(d.sales ?? 0, 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Products */}
      {!loading && topProducts.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="font-semibold text-foreground mb-4">Top Products</h2>
          <div className="space-y-3">
            {topProducts.slice(0, 5).map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-muted-foreground w-5">{i + 1}</span>
                  <span className="text-sm font-medium text-foreground">{p.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">{p.quantity} sold</span>
                  <span className="text-sm font-semibold text-foreground">{fmt(p.revenue ?? 0, 0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
