'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Store, Search, Loader2, RefreshCw, X, ShoppingCart, Users, Package, Plug, Truck,
  UserCog, Clock, ChevronRight, ScrollText,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { PlanChip, StatusChip, fmtDate } from '@/lib/subscription-ui';

interface StoreRow {
  id: number;
  name: string;
  country: string | null;
  currency: string | null;
  is_active: boolean;
  owner_name: string | null;
  owner_email: string | null;
  plan: string;
  subscription_status: string;
  expires_at: string | null;
  created_at: string | null;
  order_count: number;
  revenue: number;
  orders_30d: number;
  revenue_30d: number;
  last_order_at: string | null;
  product_count: number;
  customer_count: number;
  channels: string[];
  suppliers: string[];
  team_count: number;
  last_login_at: string | null;
}

interface Detail {
  store: {
    id: number; name: string; country: string | null; currency: string | null; email: string | null; phone: string | null;
    is_active: boolean; created_at: string | null; owner_name: string | null; owner_email: string | null;
    plan: string; subscription_status: string; expires_at: string | null;
  };
  metrics: StoreRow;
  orders_by_status: { status: string; count: number; total: number }[];
  orders_by_source: { source: string; count: number; total: number }[];
  recent_orders: { id: number; order_number: string; status: string; payment_status: string; source: string; total: number; created_at: string | null }[];
  top_products: { name: string | null; sold: number; revenue: number }[];
  team: { email: string; full_name: string | null; status: string; role_name: string | null }[];
  recent_activity: { id: number; event_type: string; actor_email: string | null; country: string | null; description: string | null; created_at: string | null }[];
}

const SORTS: Record<string, { label: string; fn: (a: StoreRow, b: StoreRow) => number }> = {
  newest: { label: 'Newest stores', fn: (a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '') },
  revenue: { label: 'Most revenue', fn: (a, b) => b.revenue - a.revenue },
  orders: { label: 'Most orders', fn: (a, b) => b.order_count - a.order_count },
  recent: { label: 'Recently active', fn: (a, b) => (b.last_login_at ?? b.last_order_at ?? '').localeCompare(a.last_login_at ?? a.last_order_at ?? '') },
};

const money = (n: number, cur: string | null) =>
  `${cur ?? ''} ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`.trim();

function ago(iso: string | null): string {
  if (!iso) return 'Never';
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 60) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(iso);
}

function CountryCell({ code }: { code: string | null }) {
  if (!code) return null;
  if (code.length !== 2) return <span className="text-xs text-gray-500">{code}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <span className={`fi fi-${code.toLowerCase()} inline-block h-3 w-4 rounded-sm`} role="img" aria-label={code} />
      {code.toUpperCase()}
    </span>
  );
}

function Pills({ items, empty = '—' }: { items: string[]; empty?: string }) {
  if (items.length === 0) return <span className="text-gray-400">{empty}</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((i) => (
        <span key={i} className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium capitalize text-gray-700">{i}</span>
      ))}
    </div>
  );
}

function Tile({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub?: string; icon: typeof Store }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-1 flex items-center gap-2 text-xs text-gray-500"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
      {children}
    </section>
  );
}

function StoreDrawer({ shopId, onClose }: { shopId: number; onClose: () => void }) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null); setError('');
    adminApi.storeInsightDetail(shopId).then((r) => setData(r.data)).catch(() => setError('Could not load this store.'));
  }, [shopId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const cur = data?.store.currency ?? null;
  const m = data?.metrics;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/40 backdrop-blur-[1px]" onClick={onClose}>
      <aside className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-gray-50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-gray-900">{data?.store.name ?? 'Loading…'}</p>
            {data && (
              <p className="truncate text-sm text-gray-500">
                {data.store.owner_name} · {data.store.owner_email}
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          {!data && !error && <div className="flex items-center justify-center py-20 text-gray-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>}

          {data && m && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <PlanChip plan={data.store.plan} />
                <StatusChip status={data.store.subscription_status} />
                {!data.store.is_active && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600">Suspended</span>}
                <CountryCell code={data.store.country} />
                <span className="text-xs text-gray-500">Store #{data.store.id} · joined {fmtDate(data.store.created_at)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Tile icon={ShoppingCart} label="Orders" value={m.order_count} sub={`${m.orders_30d} in last 30 days`} />
                <Tile icon={Store} label="Revenue" value={money(m.revenue, cur)} sub={`${money(m.revenue_30d, cur)} in last 30 days`} />
                <Tile icon={Users} label="Customers" value={m.customer_count} />
                <Tile icon={Package} label="Products" value={m.product_count} />
                <Tile icon={Plug} label="Connected channels" value={m.channels.length} />
                <Tile icon={Truck} label="Connected suppliers" value={m.suppliers.length} />
              </div>

              <Section title="Connected">
                <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 text-sm">
                  <div className="flex items-start gap-3"><span className="w-20 shrink-0 text-gray-500">Channels</span><Pills items={m.channels} empty="None connected" /></div>
                  <div className="flex items-start gap-3"><span className="w-20 shrink-0 text-gray-500">Suppliers</span><Pills items={m.suppliers} empty="None connected" /></div>
                </div>
              </Section>

              <Section title="What they're doing">
                <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Last sign-in</span><span className="font-medium text-gray-900">{ago(m.last_login_at)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Last order</span><span className="font-medium text-gray-900">{ago(m.last_order_at)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Plan ends</span><span className="font-medium text-gray-900">{fmtDate(data.store.expires_at)}</span></div>
                </div>
              </Section>

              <div className="grid gap-6 sm:grid-cols-2">
                <Section title="Orders by status">
                  <div className="space-y-1.5 rounded-xl border border-gray-200 bg-white p-4 text-sm">
                    {data.orders_by_status.length === 0 && <p className="text-gray-400">No orders yet</p>}
                    {data.orders_by_status.map((s) => (
                      <div key={s.status} className="flex justify-between">
                        <span className="capitalize text-gray-600">{s.status}</span>
                        <span className="font-medium text-gray-900">{s.count} <span className="font-normal text-gray-400">· {money(s.total, cur)}</span></span>
                      </div>
                    ))}
                  </div>
                </Section>
                <Section title="Orders by source">
                  <div className="space-y-1.5 rounded-xl border border-gray-200 bg-white p-4 text-sm">
                    {data.orders_by_source.length === 0 && <p className="text-gray-400">No orders yet</p>}
                    {data.orders_by_source.map((s) => (
                      <div key={s.source} className="flex justify-between">
                        <span className="capitalize text-gray-600">{s.source}</span>
                        <span className="font-medium text-gray-900">{s.count} <span className="font-normal text-gray-400">· {money(s.total, cur)}</span></span>
                      </div>
                    ))}
                  </div>
                </Section>
              </div>

              <Section title="Recent orders">
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
                      <tr><th className="px-3 py-2">Order</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Source</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2">When</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.recent_orders.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">No orders yet</td></tr>}
                      {data.recent_orders.map((o) => (
                        <tr key={o.id}>
                          <td className="px-3 py-2 font-mono text-xs text-gray-900">{o.order_number}</td>
                          <td className="px-3 py-2 capitalize text-gray-600">{o.status}</td>
                          <td className="px-3 py-2 capitalize text-gray-600">{o.source}</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">{money(o.total, cur)}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{ago(o.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>

              <Section title="Top products">
                <div className="space-y-1.5 rounded-xl border border-gray-200 bg-white p-4 text-sm">
                  {data.top_products.length === 0 && <p className="text-gray-400">Nothing sold yet</p>}
                  {data.top_products.map((p, i) => (
                    <div key={i} className="flex justify-between gap-3">
                      <span className="truncate text-gray-700">{p.name ?? 'Unnamed item'}</span>
                      <span className="shrink-0 font-medium text-gray-900">{p.sold} sold <span className="font-normal text-gray-400">· {money(p.revenue, cur)}</span></span>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title={`Team (${data.team.length})`}>
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white text-sm">
                  {data.team.length === 0 && <p className="p-4 text-gray-400">Just the owner</p>}
                  {data.team.map((t) => (
                    <div key={t.email} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0"><p className="truncate text-gray-900">{t.full_name || t.email}</p>{t.full_name && <p className="truncate text-xs text-gray-500">{t.email}</p>}</div>
                      <span className="shrink-0 text-xs text-gray-500">{t.role_name} · <span className="capitalize">{t.status}</span></span>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Recent activity">
                <a
                  href={`/dashboard/audit-log?shop=${data.store.id}&type=shop_action`}
                  className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[#5A2EC9] hover:underline"
                >
                  See everything this store&apos;s team changed <ChevronRight className="h-3 w-3" />
                </a>
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white text-sm">
                  {data.recent_activity.length === 0 && <p className="p-4 text-gray-400">No recorded activity yet</p>}
                  {data.recent_activity.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-gray-900">{a.description || a.event_type}</p>
                        <p className="truncate text-xs text-gray-500">{a.actor_email}{a.country ? ` · ${a.country}` : ''}</p>
                      </div>
                      <span className="shrink-0 text-xs text-gray-400">{ago(a.created_at)}</span>
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function StoreActivityPage() {
  const [rows, setRows] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError('');
    adminApi.storeInsights(search)
      .then((r) => setRows(r.data?.stores ?? []))
      .catch(() => setError('Could not load stores.'))
      .finally(() => setLoading(false));
  }, [search]);
  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(() => [...rows].sort(SORTS[sort].fn), [rows, sort]);
  const totals = useMemo(() => ({
    stores: rows.length,
    active: rows.filter((r) => r.orders_30d > 0).length,
    orders: rows.reduce((n, r) => n + r.order_count, 0),
    channels: rows.reduce((n, r) => n + r.channels.length, 0),
  }), [rows]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><ScrollText className="h-6 w-6 text-[#6B3FD9]" /> Store Activity</h1>
          <p className="mt-0.5 text-sm text-gray-500">Every store: what it sells, what it has connected, and when it was last used. Click a store for the full picture.</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Store} label="Stores" value={totals.stores} />
        <Tile icon={Clock} label="With orders in last 30 days" value={totals.active} sub={totals.stores ? `${Math.round((totals.active / totals.stores) * 100)}% of stores` : undefined} />
        <Tile icon={ShoppingCart} label="Total orders" value={totals.orders.toLocaleString()} />
        <Tile icon={Plug} label="Connected channels" value={totals.channels} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[220px] max-w-sm flex-1 items-center gap-2">
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput.trim()); }}
            placeholder="Search store, owner or email…"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#6B3FD9] focus:outline-none" />
          <button onClick={() => setSearch(searchInput.trim())} className="rounded-lg bg-[#6B3FD9] p-2 text-white hover:bg-[#5A2EC9]"><Search className="h-4 w-4" /></button>
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#6B3FD9] focus:outline-none">
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-2.5">Store</th>
                <th className="px-3 py-2.5">Plan</th>
                <th className="px-3 py-2.5 text-right">Orders</th>
                <th className="px-3 py-2.5 text-right">Revenue</th>
                <th className="px-3 py-2.5 text-right">Customers</th>
                <th className="px-3 py-2.5 text-right">Products</th>
                <th className="px-3 py-2.5">Channels</th>
                <th className="px-3 py-2.5">Suppliers</th>
                <th className="px-3 py-2.5 text-right">Team</th>
                <th className="px-3 py-2.5">Last sign-in</th>
                <th className="px-3 py-2.5">Last order</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={12} className="px-4 py-16 text-center text-gray-500"><Loader2 className="mr-2 inline h-5 w-5 animate-spin" /> Loading…</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-16 text-center text-gray-500">No stores found.</td></tr>
              ) : sorted.map((r) => (
                <tr key={r.id} onClick={() => setOpenId(r.id)} className="cursor-pointer align-top transition hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <p className="flex items-center gap-2 font-medium text-gray-900">
                      {r.name} {!r.is_active && <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-600">Suspended</span>}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-gray-500">{r.owner_email} <CountryCell code={r.country} /></p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5"><div className="flex flex-wrap items-center gap-1"><PlanChip plan={r.plan} /><StatusChip status={r.subscription_status} /></div></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right"><span className="font-medium text-gray-900">{r.order_count}</span><span className="ml-1 text-xs text-gray-400">({r.orders_30d} / 30d)</span></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium text-gray-900">{money(r.revenue, r.currency)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{r.customer_count}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{r.product_count}</td>
                  <td className="px-3 py-2.5"><Pills items={r.channels} /></td>
                  <td className="px-3 py-2.5"><Pills items={r.suppliers} /></td>
                  <td className="px-3 py-2.5 text-right text-gray-700"><span className="inline-flex items-center gap-1">{r.team_count > 0 && <UserCog className="h-3.5 w-3.5 text-gray-400" />}{r.team_count}</span></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-gray-600">{ago(r.last_login_at)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-gray-600">{ago(r.last_order_at)}</td>
                  <td className="pr-3 text-gray-300"><ChevronRight className="h-4 w-4" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {openId !== null && <StoreDrawer shopId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
