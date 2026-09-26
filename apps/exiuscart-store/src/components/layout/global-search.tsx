'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Package, Receipt, Users, Clock, CornerDownLeft, Compass, Flame, AlertTriangle, X, Loader2,
} from 'lucide-react';
import { searchApi, type SearchCustomer, type SearchOrder, type SearchProduct } from '@/lib/api';
import { useAccess } from '@/components/providers/access-provider';
import { useCurrency } from '@/components/providers/currency-provider';
import { menuItems } from '@/components/layout/sidebar';

type Item = {
  key: string; group: string; icon: React.ElementType; title: string; subtitle?: string; right?: string;
  go: () => void;
};
type Group = { label: string; icon: React.ElementType; items: Item[] };

const RECENT_MAX = 5;
// Pages worth offering when the box is opened empty (only those this person can open).
const QUICK_PAGES = ['/dashboard/orders', '/dashboard/products', '/dashboard/customers', '/dashboard/reports', '/dashboard/inventory'];

function recentKey(shopId: string) { return `search_recent_${shopId}`; }
function readRecent(shopId: string): string[] {
  try { return JSON.parse(localStorage.getItem(recentKey(shopId)) || '[]').slice(0, RECENT_MAX); } catch { return []; }
}

function useGlobalSearch(onNavigate: () => void) {
  const router = useRouter();
  const access = useAccess();
  const { fmt } = useCurrency();
  const [shopId, setShopId] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState<{ products: SearchProduct[]; orders: SearchOrder[]; customers: SearchCustomer[] } | null>(null);
  const [sugg, setSugg] = useState<{ best_sellers: SearchProduct[]; low_stock: SearchProduct[]; recent_orders: SearchOrder[]; recent_customers: SearchCustomer[] } | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => { const id = localStorage.getItem('shop_id') || ''; setShopId(id); if (id) setRecent(readRecent(id)); }, []);

  const term = q.trim();

  // Suggestions are fetched once per opening, from the shop's own data.
  const loadSuggestions = useCallback(() => {
    if (!shopId) return;
    setRecent(readRecent(shopId));
    searchApi.suggestions(shopId).then((r) => setSugg(r.data)).catch(() => {});
  }, [shopId]);

  useEffect(() => {
    if (term.length < 2 || !shopId) { setFound(null); setLoading(false); return; }
    setLoading(true);
    let stale = false;
    const t = setTimeout(() => {
      searchApi.search(shopId, term)
        .then((r) => { if (!stale) { setFound(r.data); setActive(0); } })
        .catch(() => { if (!stale) setFound({ products: [], orders: [], customers: [] }); })
        .finally(() => { if (!stale) setLoading(false); });
    }, 250);
    return () => { stale = true; clearTimeout(t); };
  }, [term, shopId]);

  const remember = useCallback((text: string) => {
    const t = text.trim();
    if (t.length < 2 || !shopId) return;
    const next = [t, ...readRecent(shopId).filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, RECENT_MAX);
    try { localStorage.setItem(recentKey(shopId), JSON.stringify(next)); } catch { /* storage blocked */ }
    setRecent(next);
  }, [shopId]);

  const open = useCallback((href: string, remembered?: string) => {
    if (remembered) remember(remembered);
    onNavigate();
    router.push(href);
  }, [router, remember, onNavigate]);

  const pages = useMemo(() => menuItems.filter((m) => !m.href.includes('?') && (access.isOwner || access.canPath(m.href))), [access]);

  const productItem = useCallback((p: SearchProduct, group: string): Item => ({
    key: `p${p.id}${group}`, group, icon: Package, title: p.name,
    subtitle: [p.sku, p.reason].filter(Boolean).join(' · ') || undefined,
    right: p.price != null ? fmt(p.price) : undefined,
    go: () => open(`/dashboard/products?edit=${p.id}`, term),
  }), [fmt, open, term]);
  const orderItem = useCallback((o: SearchOrder, group: string): Item => ({
    key: `o${o.id}${group}`, group, icon: Receipt, title: `Order ${o.order_number}`,
    subtitle: [o.customer_name, o.status].filter(Boolean).join(' · ') || undefined,
    right: o.total != null ? fmt(o.total) : undefined,
    go: () => open(`/dashboard/orders/${o.id}`, term),
  }), [fmt, open, term]);
  const customerItem = useCallback((c: SearchCustomer, group: string): Item => ({
    key: `c${c.id}${group}`, group, icon: Users, title: c.name,
    subtitle: [c.email, c.phone].filter(Boolean).join(' · ') || undefined,
    go: () => open(`/dashboard/customers?q=${encodeURIComponent(c.email || c.name)}`, term),
  }), [open, term]);

  const groups: Group[] = useMemo(() => {
    if (term.length >= 2) {
      const gs: Group[] = [];
      if (found?.products.length) gs.push({ label: 'Products', icon: Package, items: found.products.map((p) => productItem(p, 'Products')) });
      if (found?.orders.length) gs.push({ label: 'Orders', icon: Receipt, items: found.orders.map((o) => orderItem(o, 'Orders')) });
      if (found?.customers.length) gs.push({ label: 'Customers', icon: Users, items: found.customers.map((c) => customerItem(c, 'Customers')) });
      const pg = pages.filter((m) => m.label.toLowerCase().includes(term.toLowerCase())).slice(0, 4);
      if (pg.length) gs.push({ label: 'Pages', icon: Compass, items: pg.map((m) => ({ key: `pg${m.href}`, group: 'Pages', icon: m.icon, title: m.label, go: () => open(m.href) })) });
      return gs;
    }
    const gs: Group[] = [];
    if (recent.length) gs.push({ label: 'Recent searches', icon: Clock, items: recent.map((r) => ({ key: `r${r}`, group: 'Recent', icon: Clock, title: r, go: () => setQ(r) })) });
    const quick = QUICK_PAGES.map((h) => pages.find((m) => m.href === h)).filter(Boolean) as typeof pages;
    if (quick.length) gs.push({ label: 'Jump to', icon: Compass, items: quick.map((m) => ({ key: `q${m.href}`, group: 'Jump', icon: m.icon, title: m.label, go: () => open(m.href) })) });
    if (sugg?.best_sellers.length) gs.push({ label: 'Your best sellers', icon: Flame, items: sugg.best_sellers.map((p) => productItem(p, 'Best')) });
    if (sugg?.low_stock.length) gs.push({ label: 'Running low', icon: AlertTriangle, items: sugg.low_stock.map((p) => productItem(p, 'Low')) });
    if (sugg?.recent_orders.length) gs.push({ label: 'Latest orders', icon: Receipt, items: sugg.recent_orders.map((o) => orderItem(o, 'Latest')) });
    if (sugg?.recent_customers.length) gs.push({ label: 'New customers', icon: Users, items: sugg.recent_customers.map((c) => customerItem(c, 'New')) });
    return gs;
  }, [term, found, pages, recent, sugg, productItem, orderItem, customerItem, open]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  useEffect(() => { setActive(0); }, [term]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, Math.max(flat.length - 1, 0))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); flat[active]?.go(); }
  };

  const clearRecent = () => { try { localStorage.removeItem(recentKey(shopId)); } catch { /* ignore */ } setRecent([]); };
  return { q, setQ, term, loading, groups, flat, active, setActive, onKeyDown, loadSuggestions, clearRecent, hasRecent: recent.length > 0 };
}

function Panel({ s, mobile }: { s: ReturnType<typeof useGlobalSearch>; mobile?: boolean }) {
  const { groups, flat, active, setActive, term, loading } = s;
  let index = -1;
  return (
    <div className={mobile ? 'flex-1 overflow-y-auto' : 'max-h-[70vh] overflow-y-auto'}>
      {groups.length === 0 && (
        <div className="px-4 py-10 text-center">
          {loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /> : (
            <>
              <Search className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">{term.length >= 2 ? `Nothing found for "${term}"` : 'Search your store'}</p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
                {term.length >= 2 ? 'Try a product name or SKU, an order number, or a customer name, email or phone.' : 'Type a product, an order number or a customer.'}
              </p>
            </>
          )}
        </div>
      )}
      {groups.map((g) => (
        <div key={g.label} className="py-1.5">
          <div className="flex items-center justify-between px-4 py-1">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <g.icon className="h-3 w-3" /> {g.label}
            </p>
            {g.label === 'Recent searches' && s.hasRecent && (
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={s.clearRecent} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
            )}
          </div>
          {g.items.map((it) => {
            index += 1;
            const i = index;
            const on = i === active;
            return (
              <button key={it.key} type="button" onMouseDown={(e) => e.preventDefault()} onClick={it.go} onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left transition ${on ? 'bg-muted' : ''}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><it.icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{it.title}</span>
                  {it.subtitle && <span className="block truncate text-xs text-muted-foreground">{it.subtitle}</span>}
                </span>
                {it.right && <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">{it.right}</span>}
                {on && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              </button>
            );
          })}
        </div>
      ))}
      {flat.length > 0 && !mobile && (
        <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <span><kbd className="rounded border border-border bg-background px-1">↑</kbd> <kbd className="rounded border border-border bg-background px-1">↓</kbd> to move</span>
          <span><kbd className="rounded border border-border bg-background px-1">Enter</kbd> to open</span>
          <span><kbd className="rounded border border-border bg-background px-1">Esc</kbd> to close</span>
        </div>
      )}
    </div>
  );
}

export function GlobalSearch() {
  const [focused, setFocused] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const close = useCallback(() => { setFocused(false); setMobileOpen(false); inputRef.current?.blur(); }, []);
  const s = useGlobalSearch(close);

  useEffect(() => { setIsMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)); }, []);

  // Ctrl+K / Cmd+K opens the search from anywhere (desktop box, or the full-screen one on a phone).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const el = inputRef.current;
        if (el && el.offsetParent !== null) { el.focus(); el.select(); }
        else setMobileOpen(true);
      } else if (e.key === 'Escape') { close(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setFocused(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => { if (focused || mobileOpen) s.loadSuggestions(); }, [focused, mobileOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (mobileOpen) setTimeout(() => mobileInputRef.current?.focus(), 50); }, [mobileOpen]);

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex items-center flex-1 min-w-0 max-w-xl ml-4">
        <div ref={wrapRef} className="group relative w-full">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-indigo-500 transition-colors" />
          <input ref={inputRef} type="text" value={s.q} onChange={(e) => s.setQ(e.target.value)} onFocus={() => setFocused(true)} onKeyDown={s.onKeyDown}
            placeholder="Search products, orders, customers…" autoComplete="off" role="combobox" aria-expanded={focused} aria-label="Search your store"
            className="w-full h-9 pl-11 pr-16 bg-muted/50 border border-border/60 rounded-md text-sm text-foreground placeholder:text-muted-foreground/80 outline-none transition-all focus:bg-background focus:border-indigo-400/70 focus:ring-4 focus:ring-indigo-500/10 focus:shadow-sm" />
          {s.q ? (
            <button type="button" aria-label="Clear search" onClick={() => { s.setQ(''); inputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-0.5 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {isMac ? <span className="text-xs">⌘</span> : <span>Ctrl</span>}K
            </kbd>
          )}
          {focused && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
              <Panel s={s} />
            </div>
          )}
        </div>
      </div>

      {/* Phone: a button that opens a full-screen search */}
      <button type="button" aria-label="Search" onClick={() => setMobileOpen(true)}
        className="md:hidden flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition">
        <Search className="w-5 h-5" />
      </button>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[100] flex flex-col bg-background">
          <div className="flex items-center gap-2 border-b border-border p-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input ref={mobileInputRef} type="text" value={s.q} onChange={(e) => s.setQ(e.target.value)} onKeyDown={s.onKeyDown}
                placeholder="Search products, orders, customers…" autoComplete="off"
                className="h-10 w-full rounded-md border border-border bg-muted/50 pl-10 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-indigo-500/30" />
            </div>
            <button type="button" onClick={close} className="px-2 text-sm font-medium text-muted-foreground">Cancel</button>
          </div>
          <Panel s={s} mobile />
        </div>
      )}
    </>
  );
}
