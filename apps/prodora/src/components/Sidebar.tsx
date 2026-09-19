'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LayoutGrid, Flame, Star, Download, Tag, ChevronDown, Store, ExternalLink, ArrowRight, Search,
  Trophy, Compass, Swords, GraduationCap, ShoppingBag, Package, ClipboardList, PanelLeftClose, PanelLeftOpen, X,
} from 'lucide-react';
import { shoppingApi, Category } from '@/lib/api';
import TopBar from '@/components/TopBar';

const COLLAPSED_KEY = 'prodora_sidebar_collapsed';
const PROMO_KEY = 'prodora_promo_dismissed';

// Persistent app chrome — dark left navigation + top bar — shared by every
// authenticated page. Items backed by real catalogue data open a real view
// (Product Picks = featured products, Global Bestsellers = ranked by real
// order counts, Current Trends = trending products, Marketplace = the full
// catalogue). Store Explorer, Competitor Research and Academy have no data
// behind them yet, so they open an honest "coming soon" page.
export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({ research: true, marketplace: false, store: false });
  const [collapsed, setCollapsed] = useState(false);
  const [promoDismissed, setPromoDismissed] = useState(false);

  useEffect(() => {
    shoppingApi.getCategories().then(setCategories).catch(() => {});
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1');
      setPromoDismissed(localStorage.getItem(PROMO_KEY) === '1');
    } catch {}
  }, []);

  // The page content and top bar offset themselves from this attribute
  // (see globals.css), so collapsing the rail reflows everything.
  useEffect(() => {
    document.documentElement.dataset.sidebar = collapsed ? 'collapsed' : 'open';
  }, [collapsed]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1'); } catch {}
      return !c;
    });
  };
  const dismissPromo = () => {
    setPromoDismissed(true);
    try { localStorage.setItem(PROMO_KEY, '1'); } catch {}
  };
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const view = pathname === '/browse' ? (searchParams.get('view') || 'all') : null;
  const onProduct = pathname.startsWith('/product/');
  const soon = pathname.startsWith('/research/') ? pathname.split('/')[2] : pathname === '/academy' ? 'academy' : null;
  const isCategory = !!view && categories.some((c) => c.slug === view);

  const researchActive = view === 'featured' || view === 'bestsellers' || view === 'trending' || (!!soon && soon !== 'academy');
  const marketplaceActive = view === 'all' || view === 'digital' || isCategory || onProduct;

  return (
    <>
      <aside className={`hidden lg:flex flex-col fixed inset-y-0 left-0 bg-[#0B1D3A] text-white z-30 transition-[width] duration-200 ${collapsed ? 'w-[4.5rem]' : 'w-64'}`}>
        <Link href="/browse" className={`flex items-center h-16 shrink-0 ${collapsed ? 'justify-center' : 'gap-2.5 px-5'}`}>
          <Image src="/prodora-logo.png" alt="" width={30} height={30} className="rounded-lg" />
          {!collapsed && <span className="font-extrabold text-xl tracking-tight">Prodora</span>}
        </Link>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden pb-4">
          <Group id="research" label="Product Research" icon={Search} collapsed={collapsed} open={open.research} onToggle={toggle} highlight={researchActive}>
            <NavItem href="/browse?view=featured" label="Product Picks" icon={LayoutGrid} active={view === 'featured'} />
            <NavItem href="/research/store-explorer" label="Store Explorer" icon={Compass} active={soon === 'store-explorer'} soon />
            <NavItem href="/research/competitor-research" label="Competitor Research" icon={Swords} active={soon === 'competitor-research'} soon />
            <NavItem href="/browse?view=bestsellers" label="Global Bestsellers" icon={Trophy} active={view === 'bestsellers'} />
            <NavItem href="/browse?view=trending" label="Current Trends" icon={Flame} active={view === 'trending'} />
          </Group>

          <Group id="marketplace" label="Marketplace" icon={ShoppingBag} collapsed={collapsed} open={open.marketplace} onToggle={toggle} highlight={marketplaceActive}>
            <NavItem href="/browse" label="All Products" icon={Package} active={view === 'all' || onProduct} />
            <NavItem href="/browse?view=digital" label="Digital Products" icon={Download} active={view === 'digital'} />
            {categories.map((cat) => (
              <NavItem key={cat.id} href={`/browse?view=${cat.slug}`} label={cat.name} icon={Tag} active={view === cat.slug} />
            ))}
          </Group>

          <Group id="store" label="My Store" icon={Store} collapsed={collapsed} open={open.store} onToggle={toggle}>
            <NavItem href="https://store.exiuscart.com/dashboard/products" label="Products" icon={Package} external />
            <NavItem href="https://store.exiuscart.com/dashboard/orders" label="Orders" icon={ClipboardList} external />
            <NavItem href="https://store.exiuscart.com/dashboard" label="Dashboard" icon={LayoutGrid} external />
          </Group>

          <Link
            href="/academy"
            title="Academy"
            className={`mt-1 mx-3 flex items-center rounded-lg py-3 text-[15px] font-semibold transition hover:bg-white/5 ${
              collapsed ? 'justify-center px-0' : 'gap-3 px-3'
            } ${soon === 'academy' ? 'bg-[#122C55] text-white' : 'text-white/75 hover:text-white'}`}
          >
            <GraduationCap className="h-5 w-5 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1">Academy</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">Soon</span>
              </>
            )}
          </Link>
        </nav>

        <div className="shrink-0">
          {!collapsed && !promoDismissed && (
            <div className="relative mx-4 mb-3 rounded-xl bg-white/5 p-3.5 ring-1 ring-white/10">
              <button type="button" onClick={dismissPromo} aria-label="Dismiss" className="absolute right-2 top-2 text-white/40 hover:text-white">
                <X className="h-4 w-4" />
              </button>
              <p className="pr-5 text-sm font-bold">Ready to sell?</p>
              <p className="mt-0.5 text-xs text-white/60">Import a product and it is live on your ExiusCart store.</p>
              <a
                href="https://store.exiuscart.com/dashboard"
                target="_blank" rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] py-2 text-xs font-semibold transition hover:bg-[#1E4FC2]"
              >
                Open my store <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            className={`flex w-full items-center border-t border-white/10 py-4 text-sm text-white/70 transition hover:text-white ${collapsed ? 'justify-center' : 'gap-3 px-6'}`}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            {!collapsed && 'Hide menu'}
          </button>
        </div>
      </aside>
      <TopBar />
    </>
  );
}

function Group({
  id, label, icon: Icon, open, onToggle, highlight, collapsed, children,
}: {
  id: string; label: string; icon: React.ElementType; open: boolean; onToggle: (id: string) => void;
  highlight?: boolean; collapsed: boolean; children: React.ReactNode;
}) {
  return (
    <div className="mt-1">
      <button
        type="button"
        title={label}
        onClick={() => onToggle(id)}
        className={`mx-3 flex w-[calc(100%-1.5rem)] items-center rounded-lg py-3 text-left text-[15px] font-semibold transition hover:bg-white/5 ${
          collapsed ? 'justify-center px-0' : 'gap-3 px-3'
        } ${highlight ? 'text-white' : 'text-white/75'}`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1">{label}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>
      {open && !collapsed && <div className="mt-0.5">{children}</div>}
    </div>
  );
}

function NavItem({
  href, label, icon: Icon, active, soon, external,
}: {
  href: string; label: string; icon: React.ElementType; active?: boolean; soon?: boolean; external?: boolean;
}) {
  const cls = `relative flex items-center gap-3 py-2.5 pl-12 pr-4 text-sm transition ${
    active ? 'bg-[#122C55] font-semibold text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
  }`;
  const inner = (
    <>
      {active && <span className="absolute inset-y-0 left-0 w-1 bg-[#3B82F6]" />}
      <Icon className="absolute left-5 h-4 w-4 shrink-0 opacity-70" />
      <span className="flex-1 truncate">{label}</span>
      {soon && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/60">Soon</span>}
      {external && <ExternalLink className="h-3 w-3 opacity-50" />}
    </>
  );
  return external
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
    : <Link href={href} className={cls}>{inner}</Link>;
}
