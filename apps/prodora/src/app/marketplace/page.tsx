'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X, ArrowUpDown, ChevronRight, ShoppingBasket, Download } from 'lucide-react';
import { shoppingApi, prodoraAuth, Product, Category } from '@/lib/api';
import { SORT_LABEL, sortProducts, type SortKey } from '@/lib/catalogue';
import Sidebar from '@/components/Sidebar';
import PageIntro from '@/components/PageIntro';
import ProductCard from '@/components/ProductCard';
import { SkeletonCard } from '@/components/DigitalBundleCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Soft pastel backgrounds, cycled across the category tiles.
const TILE_COLORS = [
  { idle: 'bg-orange-50 border-orange-100', on: 'bg-orange-50 border-orange-400' },
  { idle: 'bg-sky-50 border-sky-100', on: 'bg-sky-50 border-sky-400' },
  { idle: 'bg-rose-50 border-rose-100', on: 'bg-rose-50 border-rose-400' },
  { idle: 'bg-indigo-50 border-indigo-100', on: 'bg-indigo-50 border-indigo-400' },
  { idle: 'bg-emerald-50 border-emerald-100', on: 'bg-emerald-50 border-emerald-400' },
  { idle: 'bg-violet-50 border-violet-100', on: 'bg-violet-50 border-violet-400' },
  { idle: 'bg-amber-50 border-amber-100', on: 'bg-amber-50 border-amber-400' },
];

function MarketplaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cat = searchParams.get('cat') || 'all';

  const [authorized, setAuthorized] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('default');
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!prodoraAuth.hasAccess()) { router.replace('/'); return; }
    setAuthorized(true);
  }, [router]);

  useEffect(() => {
    if (!authorized) return;
    shoppingApi.getCategories().then(setCategories).catch(() => {});
    shoppingApi.getProducts()
      .then(setProducts)
      .catch(() => setError('Could not load products. Please check your connection and try again.'))
      .finally(() => setLoading(false));
  }, [authorized]);

  // A tile only exists for a category an admin has given an image
  // (Admin > Prodora > Categories), and it shows that image.
  const tileCategories = useMemo(() => categories.filter((c) => !!c.image_url), [categories]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = products.filter((p) => {
      if (cat !== 'all' && p.category_slug !== cat) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.category_name ?? '').toLowerCase().includes(q) || (p.tags ?? '').toLowerCase().includes(q);
    });
    return sortProducts(filtered, sort);
  }, [products, cat, search, sort]);

  if (!authorized) return null;

  const pick = (slug: string) => router.replace(slug === 'all' ? '/marketplace' : `/marketplace?cat=${slug}`, { scroll: false });

  return (
    <div className="min-h-screen bg-[#F3F5F9]">
      <Sidebar />
      <main className="app-main pt-12">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 pb-8 pt-3 sm:gap-4 sm:px-6">
          <PageIntro title="Marketplace" subtitle="Browse the full catalogue. Import what you like and sell it on your store." />

          <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products"
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-9 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                {search && (
                  <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="h-10 w-auto shrink-0 gap-2 bg-white px-3">
                  <ArrowUpDown className="h-4 w-4 shrink-0 text-gray-500" />
                  <span className="hidden text-gray-500 sm:inline">Sort:</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => <SelectItem key={k} value={k}>{SORT_LABEL[k]}</SelectItem>)}
                </SelectContent>
              </Select>
          </div>

          {/* Category tiles */}
          <div className="relative">
            <div ref={stripRef} className="scrollbar-none flex gap-3 overflow-x-auto pb-1 pr-12">
              <Tile label="All products" active={cat === 'all'} color={{ idle: 'bg-white border-gray-200', on: 'bg-blue-50 border-blue-400' }} onClick={() => pick('all')}
                art={<ShoppingBasket className="h-8 w-8 text-blue-500" />} />
              {tileCategories.map((c, i) => (
                <Tile
                  key={c.id} label={c.name} active={cat === c.slug} color={TILE_COLORS[i % TILE_COLORS.length]} onClick={() => pick(c.slug)}
                  art={<Image src={c.image_url!} alt="" width={56} height={56} className="h-14 w-14 rounded-lg object-cover" />}
                />
              ))}
              <Tile label="Digital products" active={false} color={{ idle: 'bg-white border-gray-200', on: 'bg-blue-50 border-blue-400' }} onClick={() => router.push('/digital')}
                art={<Download className="h-8 w-8 text-blue-500" />} />
            </div>
            <button
              type="button" aria-label="Scroll categories"
              onClick={() => stripRef.current?.scrollBy({ left: 420, behavior: 'smooth' })}
              className="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-gray-200 hover:bg-gray-50"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-600">{error}</div>}

          {loading ? (
            <Grid>{Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}</Grid>
          ) : visible.length === 0 ? (
            <Empty title="No products found" text="Try a different search or category." />
          ) : (
            <Grid>{visible.map((p) => <ProductCard key={p.id} product={p} showDetailsBar={false} />)}</Grid>
          )}
        </div>
      </main>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5">{children}</div>;
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
      <h2 className="text-lg font-bold text-gray-800">{title}</h2>
      <p className="max-w-xs text-sm text-gray-400">{text}</p>
    </div>
  );
}

function Tile({
  label, active, color, onClick, art,
}: {
  label: string; active: boolean; color: { idle: string; on: string }; onClick: () => void; art: React.ReactNode;
}) {
  return (
    <button
      type="button" onClick={onClick}
      className={`flex h-[5.25rem] w-[11.5rem] shrink-0 items-center justify-between gap-2 rounded-lg border-2 px-4 text-left transition hover:shadow-sm ${active ? color.on : color.idle}`}
    >
      <span title={label} className={`line-clamp-3 min-w-0 break-words text-sm font-semibold leading-tight ${active ? 'text-blue-700' : 'text-gray-800'}`}>{label.split('>').pop()!.trim()}</span>
      <span className="flex h-14 w-14 shrink-0 items-center justify-center">{art}</span>
    </button>
  );
}

export default function MarketplacePage() {
  return <Suspense fallback={null}><MarketplaceContent /></Suspense>;
}
