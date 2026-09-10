'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ListChecks, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Loader2, Plus } from 'lucide-react';
import { channelsApi, dropshipApi } from '@/lib/api';
import StatCard from '@/components/channel-listings/StatCard';
import SuccessRateBar from '@/components/channel-listings/SuccessRateBar';
import FiltersPanel, { FiltersState } from '@/components/channel-listings/FiltersPanel';
import ListingsTable, { ListingRow } from '@/components/channel-listings/ListingsTable';
import ListingDrawer, { ListingDetail } from '@/components/channel-listings/ListingDrawer';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface Stats {
  total_activity: number; successful: number; failed: number; needs_attention: number;
  success_rate: number | null;
  trend: { total_activity: number | null; successful: number | null; failed: number | null };
  top_failing_action: string | null; top_failing_action_count: number;
}

const PAGE_SIZE = 10;
// The stat cards' trend % always compares a fixed trailing window — that's
// independent of the table's own date filter below, which defaults to "all
// time" so real (older) activity is never hidden by an invisible default.
const STATS_TREND_DAYS = 7;
const DEFAULT_FILTERS: FiltersState = {
  search: '', channels: [], statuses: [], actions: [], suppliers: [],
  dateRange: { preset: 'all' }, onlyNeedsAction: false, showRetries: true,
};

function dateRangeToApiParams(range: FiltersState['dateRange']): { date_from?: string; date_to?: string } {
  if (range.preset === 'all') return {};
  if (range.preset === 'custom') return { date_from: range.from, date_to: range.to };
  const days = range.preset === 'today' ? 1 : Number(range.preset);
  return { date_from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() };
}

export default function ChannelListingsPage() {
  const [shopId, setShopId] = useState('');
  const [activeChannels, setActiveChannels] = useState<string[]>([]);
  const [activeSuppliers, setActiveSuppliers] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ListingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingRows, setLoadingRows] = useState(true);

  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ListingDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  // Deep link from an integration page's "View all" — pre-filter to that
  // one channel. Read from the raw query string so no Suspense boundary is
  // needed around useSearchParams.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('channel');
    if (c) setFilters((f) => ({ ...f, channels: [c] }));
  }, []);

  useEffect(() => {
    if (!shopId) return;
    channelsApi.getConnections(shopId).then((r) => {
      setActiveChannels((r.data ?? []).map((c: any) => c.channel_type));
    }).catch(() => {});
    dropshipApi.getConnections(shopId).then((r) => {
      setActiveSuppliers((r.data?.suppliers ?? []).filter((s: any) => s.connected).map((s: any) => s.supplier_type));
    }).catch(() => {});
  }, [shopId]);

  const loadStats = useCallback(() => {
    if (!shopId) return;
    setLoadingStats(true);
    channelsApi.getListingsStats(shopId, STATS_TREND_DAYS)
      .then((r) => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));
  }, [shopId]);

  const loadRows = useCallback(() => {
    if (!shopId) return;
    setLoadingRows(true);
    channelsApi.getListings(shopId, {
      search: filters.search || undefined,
      channel_types: filters.channels.length ? filters.channels.join(',') : undefined,
      statuses: filters.statuses.length ? filters.statuses.join(',') : undefined,
      actions: filters.actions.length ? filters.actions.join(',') : undefined,
      supplier_types: filters.suppliers.length ? filters.suppliers.join(',') : undefined,
      ...dateRangeToApiParams(filters.dateRange),
      only_needs_action: filters.onlyNeedsAction || undefined,
      show_retries: filters.showRetries,
      page, page_size: PAGE_SIZE,
    })
      .then((r) => { setRows(r.data?.rows ?? []); setTotal(r.data?.total ?? 0); })
      .catch(() => { setRows([]); setTotal(0); })
      .finally(() => setLoadingRows(false));
  }, [shopId, filters, page]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadRows(); }, [loadRows]);

  // Reset to page 1 whenever a filter (other than page itself) changes
  useEffect(() => { setPage(1); }, [filters]);

  const openDetail = (id: number) => {
    setOpenId(id);
    setLoadingDetail(true);
    channelsApi.getListingDetail(shopId, id)
      .then((r) => setDetail(r.data))
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false));
  };

  const refreshAll = () => { loadStats(); loadRows(); };

  return (
    <>
    <div className={`max-w-[1400px] mx-auto space-y-6 ${openId ? 'sm:pr-[400px]' : ''} transition-all`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ListChecks className="w-6 h-6 text-primary" /> Channel Listings
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Track every product listing, inventory sync, and price update across your sales channels.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={refreshAll} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition">
            <RefreshCw className={`w-4 h-4 ${loadingStats || loadingRows ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {/* Listing creation itself happens per-product on the Products
              page (assign a channel category, hit Create Listing there) —
              this just gets you to the right place, not a second flow. */}
          <Link href="/dashboard/products"
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition">
            <Plus className="w-4 h-4" /> Create Listing
          </Link>
        </div>
      </div>

      {/* Stat cards — real, from /channel-listings/stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total activity" value={loadingStats ? '—' : (stats?.total_activity ?? 0)} trend={stats?.trend.total_activity ?? null}
          icon={<ListChecks className="w-4 h-4" />} iconClassName="bg-primary/10 text-primary" />
        <StatCard title="Successful" value={loadingStats ? '—' : (stats?.successful ?? 0)} trend={stats?.trend.successful ?? null}
          icon={<CheckCircle2 className="w-4 h-4" />} iconClassName="bg-green-500/10 text-green-600 dark:text-green-400" />
        <StatCard title="Failed" value={loadingStats ? '—' : (stats?.failed ?? 0)} trend={stats?.trend.failed ?? null} trendGoodDirection="down"
          icon={<XCircle className="w-4 h-4" />} iconClassName="bg-destructive/10 text-destructive" />
        <StatCard title="Needs attention" value={loadingStats ? '—' : (stats?.needs_attention ?? 0)}
          icon={<AlertTriangle className="w-4 h-4" />} iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
      </div>

      {!loadingStats && stats && (
        <SuccessRateBar successRate={stats.success_rate} topFailingAction={stats.top_failing_action} topFailingCount={stats.top_failing_action_count} />
      )}

      <FiltersPanel
        activeChannels={activeChannels}
        activeSuppliers={activeSuppliers}
        filters={filters}
        onChange={(next) => setFilters((f) => ({ ...f, ...next }))}
        onClearAll={() => setFilters(DEFAULT_FILTERS)}
      />

      {loadingRows && rows.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">Loading…</span>
        </div>
      ) : (
        <ListingsTable rows={rows} total={total} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} onOpenDetail={openDetail}
          hasActiveFilters={!!(filters.search || filters.channels.length || filters.statuses.length || filters.actions.length || filters.suppliers.length || filters.onlyNeedsAction || filters.dateRange.preset !== 'all')} />
      )}

    </div>

    {/* Rendered outside the max-w wrapper so the fixed panel takes no stray
        margin from its space-y-6 siblings and anchors exactly under the
        64px app header. */}
    {openId && (
      <>
        <div className="fixed inset-0 bg-black/40 z-[55] sm:hidden" onClick={() => setOpenId(null)} />
        <ListingDrawer detail={detail} loading={loadingDetail} onClose={() => setOpenId(null)} />
      </>
    )}
    </>
  );
}
