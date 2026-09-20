'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown, ExternalLink, ArrowRight, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { WinningIcon, MarketplaceIcon, StoreIcon, AcademyIcon, InstructionsIcon } from '@/components/SidebarIcons';
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
  const [open, setOpen] = useState<Record<string, boolean>>({ research: true, store: false });
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
  const openGroup = (k: string) => setOpen((o) => ({ ...o, [k]: true }));

  const view = pathname === '/browse' ? (searchParams.get('view') || 'all') : null;
  const onProduct = pathname.startsWith('/product/');
  const onMarketplace = pathname === '/marketplace';
  const soon = pathname === '/academy' ? 'academy' : null;
  const isCategory = !!view && categories.some((c) => c.slug === view);

  const researchActive = view === 'all' || isCategory || view === 'bestsellers' || view === 'trending' || onProduct || pathname === '/digital';

  return (
    <>
      <aside className={`hidden lg:flex flex-col fixed inset-y-0 left-0 bg-[#0E2647] text-white z-30 transition-[width] duration-200 ${collapsed ? 'w-[4.5rem]' : 'w-[14.5rem]'}`}>
        <Link href="/browse" className={`flex items-center h-12 shrink-0 bg-[#06122A] ${collapsed ? 'justify-center' : 'gap-2.5 px-5'}`}>
          <Image src="/prodora-logo.png" alt="" width={30} height={30} className="rounded-lg" />
          {!collapsed && <span className="font-extrabold text-xl tracking-tight">Prodora</span>}
        </Link>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden pb-4">
          <Group id="research" label="Research Hub" href="/browse" icon={WinningIcon} collapsed={collapsed} open={open.research} onToggle={toggle} onOpen={openGroup} highlight={researchActive}>
            <NavItem href="/browse" label="Picked Products" active={view === 'all' || isCategory || onProduct} />
            <NavItem href="/browse?view=bestsellers" label="Global Bestsellers" active={view === 'bestsellers'} />
            <NavItem href="/browse?view=trending" label="Current Trends" active={view === 'trending'} />
            <NavItem href="/digital" label="Digital Products" active={pathname === '/digital'} />
          </Group>

          <SingleItem href="/marketplace" label="Marketplace" icon={MarketplaceIcon} active={onMarketplace} collapsed={collapsed} />

          <Group id="store" label="My Store" icon={StoreIcon} collapsed={collapsed} open={open.store} onToggle={toggle}>
            <NavItem href="https://store.exiuscart.com/dashboard/products" label="Products" external />
            <NavItem href="https://store.exiuscart.com/dashboard/orders" label="Orders" external />
            <NavItem href="https://store.exiuscart.com/dashboard" label="Dashboard" external />
          </Group>

          <SingleItem href="/instructions" label="Instructions" icon={InstructionsIcon} active={pathname === '/instructions'} collapsed={collapsed} />

          <SingleItem href="/academy" label="Academy" icon={AcademyIcon} active={soon === 'academy'} collapsed={collapsed} soon />
        </nav>

        <div className="shrink-0 bg-[#06122A] pt-3">
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

const ROW = 'flex w-full items-center text-left text-[15px] font-semibold transition';

function Group({
  id, label, href, icon: Icon, open, onToggle, onOpen, highlight, collapsed, children,
}: {
  id: string; label: string; href?: string; icon: React.ElementType; open: boolean;
  onToggle: (id: string) => void; onOpen?: (id: string) => void;
  highlight?: boolean; collapsed: boolean; children: React.ReactNode;
}) {
  const tone = highlight || open ? 'text-white' : 'text-white/70';
  const labelCls = `${ROW} h-14 min-w-0 flex-1 hover:bg-white/5 ${collapsed ? 'justify-center' : 'gap-3.5 pl-5'} ${tone}`;
  const inner = (
    <>
      <Icon className="h-6 w-6 shrink-0" />
      {!collapsed && <span className="min-w-0 flex-1 truncate whitespace-nowrap">{label}</span>}
    </>
  );
  return (
    <div>
      <div className="flex items-stretch">
        {href ? (
          // Opens the group's first page and expands it in one click.
          <Link href={href} title={label} onClick={() => onOpen?.(id)} className={labelCls}>{inner}</Link>
        ) : (
          <button type="button" title={label} onClick={() => onToggle(id)} className={labelCls}>{inner}</button>
        )}
        {!collapsed && (
          <button
            type="button" aria-label={open ? `Collapse ${label}` : `Expand ${label}`} onClick={() => onToggle(id)}
            className={`flex w-12 shrink-0 items-center justify-center hover:bg-white/5 ${tone}`}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      {open && !collapsed && <div>{children}</div>}
    </div>
  );
}

function SingleItem({
  href, label, icon: Icon, active, collapsed, soon,
}: {
  href: string; label: string; icon: React.ElementType; active: boolean; collapsed: boolean; soon?: boolean;
}) {
  return (
    <Link
      href={href}
      title={label}
      className={`${ROW} relative h-14 hover:bg-white/5 ${collapsed ? 'justify-center' : 'gap-3.5 px-5'} ${active ? 'bg-[#1A3E72] text-white' : 'text-white/70 hover:text-white'}`}
    >
      {active && <span className="absolute inset-y-0 left-0 w-1 bg-[#3B82F6]" />}
      <Icon className="h-6 w-6 shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1">{label}</span>
          {soon && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">Soon</span>}
        </>
      )}
    </Link>
  );
}

// Sub-items are text only, indented under their group's label.
function NavItem({ href, label, active, external }: { href: string; label: string; active?: boolean; external?: boolean }) {
  const cls = `relative flex h-12 items-center gap-2 pl-[3.6rem] pr-4 text-[15px] transition ${
    active ? 'bg-[#1A3E72] font-semibold text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
  }`;
  const inner = (
    <>
      {active && <span className="absolute inset-y-0 left-0 w-1 bg-[#3B82F6]" />}
      <span className="flex-1 truncate">{label}</span>
      {external && <ExternalLink className="h-3 w-3 opacity-50" />}
    </>
  );
  return external
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
    : <Link href={href} className={cls}>{inner}</Link>;
}
