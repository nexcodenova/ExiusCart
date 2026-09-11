'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText, RefreshCw, Download, Loader2, DollarSign, ShoppingBag,
  Receipt, PackageSearch, AlertTriangle, Truck, X,
} from 'lucide-react';
import { channelsApi, dropshipApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import StatCard from '@/components/channels/listings/StatCard';
import FiltersPanel, { OrderFiltersState, DEFAULT_ORDER_FILTERS } from '@/components/channels/orders/FiltersPanel';
import OrdersTable, { ChannelOrderRow } from '@/components/channels/orders/OrdersTable';
import { CHANNEL_META } from '@/components/channels/channelMeta';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

const PAGE_SIZE = 50;

interface Stats {
  total_revenue: number; orders_count: number; average_order_value: number;
  awaiting_fulfillment: number; needs_attention: number;
  daily: { day: string; orders: number; revenue: number }[];
}

// Real trend line built from the stats endpoint's own per-day breakdown —
// renders nothing until there are at least 2 real days to draw between.
function MiniSparkline({ data, dataKey, color }: { data: { day: string }[]; dataKey: string; color: string }) {
  if (!data || data.length < 2) return null;
  return (
    <div className="pointer-events-none absolute bottom-0 right-0 h-8 w-20 opacity-70">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`co-spark-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} fill={`url(#co-spark-${dataKey})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function dateRangeToApiParams(range: OrderFiltersState['dateRange']): { date_from?: string; date_to?: string } {
  if (range.preset === 'all') return {};
  if (range.preset === 'custom') return { date_from: range.from, date_to: range.to };
  const days = range.preset === 'today' ? 1 : Number(range.preset);
  return { date_from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() };
}

function downloadCsv(rows: ChannelOrderRow[]) {
  const header = ['Order', 'Channel', 'Customer', 'Email', 'Items', 'Total', 'Payment', 'Fulfillment', 'Supplier', 'Tracking', 'Date'];
  const lines = rows.map((r) => [
    r.order_number, CHANNEL_META[r.channel_type]?.label ?? r.channel_type, r.customer_name, r.customer_email ?? '',
    String(r.items_count), r.total.toFixed(2), r.payment_status, r.fulfillment_label, r.supplier_label ?? '',
    r.tracking_number ?? '', r.created_at ?? '',
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `channel-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ChannelOrdersPage() {
  const { fmt } = useCurrency();
  const [shopId, setShopId] = useState('');
  const [activeChannels, setActiveChannels] = useState<string[]>([]);
  const [activeSuppliers, setActiveSuppliers] = useState<string[]>([]);

  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [filters, setFilters] = useState<OrderFiltersState>(DEFAULT_ORDER_FILTERS);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ChannelOrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingRows, setLoadingRows] = useState(true);

  const [selected, setSelected] = useState<number[]>([]);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [assignSupplier, setAssignSupplier] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  useEffect(() => {
    if (!shopId) return;
    channelsApi.getConnections(shopId).then((r) => {
      setActiveChannels((r.data ?? []).map((c: any) => c.channel_type));
    }).catch(() => {});
    dropshipApi.getConnections(shopId).then((r) => {
      setActiveSuppliers((r.data?.suppliers ?? []).filter((s: any) => s.connected).map((s: any) => s.supplier_type));
    }).catch(() => {});
  }, [shopId]);

  const apiParams = {
    channel: filters.channels.length ? filters.channels.join(',') : undefined,
    payment_status: filters.paymentStatus || undefined,
    fulfillment: filters.fulfillment || undefined,
    needs_attention: filters.onlyNeedsAttention || undefined,
    search: filters.search || undefined,
    ...dateRangeToApiParams(filters.dateRange),
  };

  const loadStats = useCallback(() => {
    if (!shopId) return;
    setLoadingStats(true);
    channelsApi.getChannelOrdersStats(shopId, {
      channel: apiParams.channel, date_from: apiParams.date_from, date_to: apiParams.date_to,
    }).then((r) => setStats(r.data)).catch(() => setStats(null)).finally(() => setLoadingStats(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, filters.channels, filters.dateRange]);

  const loadRows = useCallback(() => {
    if (!shopId) return;
    setLoadingRows(true);
    channelsApi.getChannelOrders(shopId, { ...apiParams, skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE })
      .then((r) => { setRows(r.data?.orders ?? []); setTotal(r.data?.total ?? 0); })
      .catch(() => { setRows([]); setTotal(0); })
      .finally(() => setLoadingRows(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, filters, page]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadRows(); }, [loadRows]);
  useEffect(() => { setPage(1); setSelected([]); }, [filters]);

  const refreshAll = () => { loadStats(); loadRows(); };

  const toggleSelect = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((v) => v !== id) : [...s, id]));
  const toggleSelectAll = (checked: boolean) => setSelected(checked ? rows.map((r) => r.id) : []);

  const runAssignSupplier = async () => {
    if (!assignSupplier || selected.length === 0) return;
    setAssigning(true);
    let ok = 0, fail = 0;
    for (const id of selected) {
      try {
        await dropshipApi.fulfillOrder(shopId, id, assignSupplier);
        ok++;
      } catch {
        fail++;
      }
    }
    setAssigning(false);
    setSupplierDialogOpen(false);
    setSelected([]);
    setBanner(
      fail === 0
        ? { tone: 'success', text: `Sent ${ok} order${ok === 1 ? '' : 's'} to the supplier.` }
        : { tone: 'error', text: `Sent ${ok} order${ok === 1 ? '' : 's'}, ${fail} failed — usually a missing supplier product link. Open each order to see why.` }
    );
    refreshAll();
  };

  const hasActiveFilters = !!(filters.search || filters.channels.length || filters.paymentStatus || filters.fulfillment || filters.onlyNeedsAttention || filters.dateRange.preset !== 'all');
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-[1500px] mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-primary">Sales Channels <span className="mx-1 text-muted-foreground">/</span> Channel Orders</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" /> Channel Orders
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Every order that came in through a connected sales channel — see which channels are actually performing, not just what's in your inbox.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={refreshAll} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition">
            <RefreshCw className={`w-4 h-4 ${loadingStats || loadingRows ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Stat cards — real, from /channels/orders/stats, scoped to whatever
          channel + date filters are active so they always match the table. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard title="Revenue (paid)" value={loadingStats ? '—' : fmt(stats?.total_revenue ?? 0)}
          icon={<DollarSign className="w-4 h-4" />} iconClassName="bg-primary/10 text-primary"
          sparkline={<MiniSparkline data={stats?.daily ?? []} dataKey="revenue" color="#6366f1" />} />
        <StatCard title="Orders" value={loadingStats ? '—' : (stats?.orders_count ?? 0)}
          icon={<ShoppingBag className="w-4 h-4" />} iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          sparkline={<MiniSparkline data={stats?.daily ?? []} dataKey="orders" color="#3b82f6" />} />
        <StatCard title="Average order value" value={loadingStats ? '—' : fmt(stats?.average_order_value ?? 0)}
          icon={<Receipt className="w-4 h-4" />} iconClassName="bg-green-500/10 text-green-600 dark:text-green-400"
          sparkline={<MiniSparkline data={(stats?.daily ?? []).map((d) => ({ ...d, aov: d.orders ? d.revenue / d.orders : 0 }))} dataKey="aov" color="#22c55e" />} />
        <StatCard title="Awaiting fulfillment" value={loadingStats ? '—' : (stats?.awaiting_fulfillment ?? 0)}
          icon={<PackageSearch className="w-4 h-4" />} iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
        <StatCard title="Needs attention" value={loadingStats ? '—' : (stats?.needs_attention ?? 0)}
          icon={<AlertTriangle className="w-4 h-4" />} iconClassName="bg-destructive/10 text-destructive" />
      </div>

      <FiltersPanel
        activeChannels={activeChannels}
        filters={filters}
        onChange={(next) => setFilters((f) => ({ ...f, ...next }))}
        onClearAll={() => setFilters(DEFAULT_ORDER_FILTERS)}
      />

      {banner && (
        <div className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-medium ${banner.tone === 'success' ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'}`}>
          {banner.text}
          <button onClick={() => setBanner(null)} className="shrink-0"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-primary/5 px-4 py-3">
            <span className="text-xs font-semibold text-primary">{selected.length} selected</span>
            <button onClick={() => setSupplierDialogOpen(true)} disabled={activeSuppliers.length === 0}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
              <Truck className="w-3.5 h-3.5" /> Assign supplier
            </button>
            <button onClick={() => downloadCsv(rows.filter((r) => selected.includes(r.id)))}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted">
              <Download className="w-3.5 h-3.5" /> Export selected
            </button>
            <button onClick={() => setSelected([])} className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground">Deselect all</button>
          </div>
        )}

        {loadingRows && rows.length === 0 ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">Loading…</span>
          </div>
        ) : (
          <OrdersTable rows={rows} loading={false} selected={selected} onToggleSelect={toggleSelect} onToggleSelectAll={toggleSelectAll} />
        )}

        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <p>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} order{total === 1 ? '' : 's'}{hasActiveFilters ? ' (filtered)' : ''}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-2.5 py-1 rounded-md border border-border disabled:opacity-40 hover:bg-muted">‹</button>
              <span className="font-medium text-foreground">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="px-2.5 py-1 rounded-md border border-border disabled:opacity-40 hover:bg-muted">›</button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign supplier</DialogTitle>
            <DialogDescription>
              Sends {selected.length} order{selected.length === 1 ? '' : 's'} to the chosen supplier for fulfillment. Any order whose products don't have a supplier link yet will fail — you'll see exactly which ones.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Supplier</label>
            <select value={assignSupplier} onChange={(e) => setAssignSupplier(e.target.value)}
              className="w-full h-10 px-3 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Choose a connected supplier…</option>
              {activeSuppliers.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 px-6 pb-6 pt-2">
            <button onClick={() => setSupplierDialogOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted">Cancel</button>
            <button onClick={runAssignSupplier} disabled={!assignSupplier || assigning}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2">
              {assigning && <Loader2 className="w-4 h-4 animate-spin" />} Send to supplier
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
