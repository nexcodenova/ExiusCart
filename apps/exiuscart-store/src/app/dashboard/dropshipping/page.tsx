'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { CheckCircle2, Loader2, Package, Lock, Globe, Truck, Search, Plus, ArrowDownToLine, FileText } from 'lucide-react';
import { dropshipApi, channelsApi } from '@/lib/api';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/dropshipping/StatCard';
import Workflow from '@/components/dropshipping/Workflow';
import RecentProducts, { RecentProduct } from '@/components/dropshipping/RecentProducts';
import ConnectedSuppliersTable, { ConnectedSupplierRow } from '@/components/dropshipping/ConnectedSuppliersTable';
import TrustPanel from '@/components/dropshipping/TrustPanel';
import SupplierCard, { Supplier, SUPPLIER_STYLE, DASHBOARD_LINKS } from '@/components/dropshipping/SupplierCard';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

// ── Main Page ─────────────────────────────────────────────────────────────────

interface DropshipStats {
  products_sourced: number;
  automated_orders: number;
  fulfilled_orders: number;
  fulfillment_rate: number | null;
  by_supplier: Record<string, { products: number; orders: number; fulfilled: number }>;
  recent_products: RecentProduct[];
}

const CATEGORY_FILTERS = ['All', 'Dropshipping', 'Print-on-Demand'] as const;

export default function DropshippingPage() {
  const searchParams = useSearchParams();
  const [shopId, setShopId] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [plan, setPlan] = useState('');
  const [hasTheDersi, setHasTheDersi] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DropshipStats | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<typeof CATEGORY_FILTERS[number]>('All');
  const discoverRef = useRef<HTMLDivElement>(null);
  const connectedRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  // ?view=connected — the sidebar's "Connected Suppliers" link deep-links
  // here rather than being a separate page, scrolling straight to the real
  // connected-suppliers table below instead of duplicating it elsewhere.
  useEffect(() => {
    if (searchParams.get('view') !== 'connected' || loading) return;
    connectedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [searchParams, loading]);

  const load = () => {
    if (!shopId) return;
    setLoading(true);
    Promise.all([
      dropshipApi.getConnections(shopId),
      channelsApi.getConnections(shopId),
    ])
      .then(([supRes, connRes]) => {
        setSuppliers(supRes.data?.suppliers ?? []);
        setPlan(supRes.data?.plan ?? '');
        setHasTheDersi((connRes.data ?? []).some((c: any) => c.channel_type === 'thedersi'));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    dropshipApi.getStats(shopId).then((r) => setStats(r.data)).catch(() => {});
  };

  useEffect(() => { load(); }, [shopId]);

  const connectedCount = suppliers.filter((s) => s.connected).length;
  const availableCount = suppliers.filter((s) => !s.connected && !s.locked).length;
  // Detected via an active TheDersi connection, not plan_type — TheDersi's
  // Growth/Premium tier maps to plan='starter', same as a direct customer,
  // so a plan-string check alone would miss those sellers.
  const isTheDersiUser = hasTheDersi;

  const filteredSuppliers = useMemo(() => suppliers.filter((s) => {
    const searchMatch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase());
    const categoryMatch = categoryFilter === 'All' ? true : categoryFilter === 'Dropshipping' ? s.category === 'dropship' : s.category === 'pod';
    return searchMatch && categoryMatch;
  }), [suppliers, search, categoryFilter]);

  const connectedSupplierRows: ConnectedSupplierRow[] = suppliers
    .filter((s) => s.connected)
    .map((s) => {
      const style = SUPPLIER_STYLE[s.supplier_type] ?? { icon: Package, color: 'text-primary', bg: 'bg-muted' };
      const supplierStats = stats?.by_supplier[s.supplier_type];
      return {
        supplierType: s.supplier_type,
        name: s.name,
        icon: style.icon,
        color: style.color,
        bg: style.bg,
        products: supplierStats?.products ?? 0,
        orders: supplierStats?.orders ?? 0,
        fulfilled: supplierStats?.fulfilled ?? 0,
        dashboardUrl: DASHBOARD_LINKS[s.supplier_type] ?? s.signup_url,
      };
    });

  // While the plan is still loading, show only a spinner — never flash the
  // supplier cards / "How it works" before we know if the user is a TheDersi seller.
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  // TheDersi sellers don't get dropshipping — their fulfilment is handled by TheDersi
  if (isTheDersiUser) {
    return (
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Suppliers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect a dropshipping or print-on-demand supplier. ExiusCart forwards orders to them automatically.
          </p>
        </div>

        <Card className="rounded-2xl p-8 sm:p-10 flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Dropshipping is for direct ExiusCart sellers</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Your store is managed by <strong className="text-foreground">TheDersi</strong>, and your orders are fulfilled through TheDersi&apos;s own logistics. Dropshipping and print-on-demand suppliers like CJ, HyperSKU, AliExpress, Printful &amp; Gelato are only available to sellers on a direct ExiusCart plan (Starter or Premium).
          </p>
          <Button asChild className="mt-6">
            <Link href="/dashboard/channels">Back to Channels</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-2">Suppliers / Dropshipping</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Find suppliers. Source products. <span className="text-primary">Fulfill automatically.</span>
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Connect trusted suppliers, discover products and automate fulfillment from one centralized ecommerce workspace.
          </p>
        </div>
        <div className="flex gap-2.5 shrink-0">
          <Button variant="outline" asChild>
            <Link href="/dashboard/helpdesk"><FileText className="w-4 h-4" /> View Documentation</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/dropshipping/import"><ArrowDownToLine className="w-4 h-4" /> Import Products</Link>
          </Button>
          <Button onClick={() => discoverRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            <Plus className="w-4 h-4" /> Connect Supplier
          </Button>
        </div>
      </div>

      {/* Starter banner */}
      {!loading && plan === 'starter' && (
        <Card className="bg-muted/60 rounded-xl">
          <CardContent className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-foreground">CJ Dropshipping is included in your Starter plan</p>
              <p className="text-xs text-muted-foreground mt-0.5">Upgrade to Premium to unlock HyperSKU, EPROLO, AliExpress, Printful, Printify, Gelato, and auto-fulfill.</p>
            </div>
            <Button asChild size="sm" className="shrink-0 whitespace-nowrap">
              <Link href="/dashboard/billing">Upgrade to Premium</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : (
        <>
          {/* Stat cards — real numbers from /dropship/stats + the
              connections list already loaded above */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard icon={<Truck className="w-5 h-5" />} title="Connected Suppliers" value={connectedCount} />
            <StatCard icon={<Globe className="w-5 h-5" />} title="Available Suppliers" value={availableCount} iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400" />
            <StatCard icon={<Package className="w-5 h-5" />} title="Products Sourced" value={(stats?.products_sourced ?? 0).toLocaleString()} iconClassName="bg-violet-500/10 text-violet-600 dark:text-violet-400" />
            <StatCard icon={<CheckCircle2 className="w-5 h-5" />} title="Automated Orders" value={(stats?.automated_orders ?? 0).toLocaleString()} iconClassName="bg-green-500/10 text-green-600 dark:text-green-400" />
          </div>

          {/* Discover suppliers */}
          <div ref={discoverRef} className="scroll-mt-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-foreground">Discover suppliers</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Find suppliers and sourcing partners that match your products and fulfillment needs.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search suppliers..."
                  className="w-full h-10 pl-10 pr-3 bg-muted border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex rounded-xl bg-muted p-1 shrink-0">
                {CATEGORY_FILTERS.map((f) => (
                  <button key={f} onClick={() => setCategoryFilter(f)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${categoryFilter === f ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {connectedCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium mb-3">
                <CheckCircle2 className="w-4 h-4" />
                {connectedCount} supplier{connectedCount > 1 ? 's' : ''} connected
              </div>
            )}

            {filteredSuppliers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Search className="w-5 h-5" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">No suppliers found</h3>
                <p className="mt-1 text-sm text-muted-foreground">Try another search or filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                {filteredSuppliers.map((s) => (
                  <SupplierCard key={s.supplier_type} supplier={s} shopId={shopId} plan={plan} onRefresh={load}
                    stat={stats?.by_supplier[s.supplier_type]} />
                ))}
              </div>
            )}
          </div>

          <Workflow />

          <RecentProducts products={stats?.recent_products ?? []} />

          <div ref={connectedRef} className="scroll-mt-6">
            <ConnectedSuppliersTable rows={connectedSupplierRows} />
          </div>

          <TrustPanel />
        </>
      )}
    </div>
  );
}
