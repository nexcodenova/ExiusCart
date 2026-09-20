'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X, SlidersHorizontal, ArrowUpDown, LayoutGrid } from 'lucide-react';
import { shoppingApi, digitalBundlesApi, prodoraAuth, Product, Category, DigitalBundle } from '@/lib/api';
import { SORT_LABEL, sortProducts, type SortKey } from '@/lib/catalogue';
import { SkeletonCard, DigitalBundleCard } from '@/components/DigitalBundleCard';
import ProductCard from '@/components/ProductCard';
import Sidebar from '@/components/Sidebar';
import PageIntro from '@/components/PageIntro';
import FilterDrawer, { EMPTY_FILTERS, type FilterState } from '@/components/FilterDrawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-24 text-center gap-4">
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-4xl select-none">
        🛍️
      </div>
      <h2 className="text-xl font-bold text-gray-800">
        {hasSearch ? 'No products found' : 'No products yet'}
      </h2>
      <p className="text-gray-400 max-w-xs text-sm">
        {hasSearch ? 'Try adjusting your search or category filter.' : 'New products are being added. Check back soon!'}
      </p>
    </div>
  );
}

const ATTRIBUTE_CHIPS = ['Has video', 'Has Meta ad'];

const tagsOf = (p: Product): string[] =>
  (p.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean);

// Chips = the fixed product attributes plus the real tags found on the
// products currently loaded (most common first), so a chip never matches
// nothing.
function buildChips(products: Product[]): string[] {
  const counts = new Map<string, number>();
  for (const p of products) for (const t of new Set(tagsOf(p))) counts.set(t, (counts.get(t) ?? 0) + 1);
  const tags = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([t]) => t);
  return [...ATTRIBUTE_CHIPS, ...tags];
}

function matchesChip(p: Product, chip: string): boolean {
  if (chip === 'Has video') return !!(p.video_url || (p.videos && p.videos.length));
  if (chip === 'Has Meta ad') return !!(p.ad_facebook_url || p.ad_instagram_url);
  return tagsOf(p).some((t) => t.toLowerCase() === chip.toLowerCase());
}

function applyFiltersAndSort(products: Product[], f: FilterState, sort: SortKey): Product[] {
  const min = f.minPrice === '' ? null : Number(f.minPrice);
  const max = f.maxPrice === '' ? null : Number(f.maxPrice);
  const out = products.filter((p) => {
    if (min != null && !Number.isNaN(min) && p.price < min) return false;
    if (max != null && !Number.isNaN(max) && p.price > max) return false;
    return f.chips.every((c) => matchesChip(p, c));
  });
  return sortProducts(out, sort);
}

function BrowseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get('view') || 'all';

  const [authorized, setAuthorized] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('default');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  // Digital bundles now live on the Marketplace page.
  useEffect(() => {
    if (view === 'digital') router.replace('/marketplace?cat=digital');
  }, [view, router]);

  useEffect(() => {
    if (!prodoraAuth.hasAccess()) {
      router.replace('/');
      return;
    }
    setAuthorized(true);
  }, [router]);

  // Bestsellers and Trends are just the catalogue ranked by real order counts
  // / real trend growth; every other view starts in the API's own order.
  useEffect(() => {
    setSort(view === 'bestsellers' ? 'orders' : view === 'trending' ? 'trend' : 'default');
  }, [view]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!authorized) return;
    shoppingApi.getCategories().then(setCategories).catch(() => {});
  }, [authorized]);

  const [bundles, setBundles] = useState<DigitalBundle[]>([]);
  useEffect(() => {
    if (!authorized || (view !== 'trending' && view !== 'bestsellers')) { setBundles([]); return; }
    digitalBundlesApi.list().then(setBundles).catch(() => setBundles([]));
  }, [authorized, view]);

  useEffect(() => {
    if (!authorized) return;
    setLoading(true);
    setError(null);
    const params: Parameters<typeof shoppingApi.getProducts>[0] = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (view === 'trending') params.trending = true;
    else if (view === 'bestsellers') params.bestseller = true;
    else if (view === 'featured') params.featured = true;
    else if (view !== 'all') params.category = view;
    shoppingApi
      .getProducts(params)
      .then(setProducts)
      .catch(() => {
        setError('Could not load products. Please check your connection and try again.');
        setProducts([]);
      })
      .finally(() => setLoading(false));
  }, [authorized, debouncedSearch, view]);

  if (!authorized) return null;

  const activeCategoryName = categories.find(c => c.slug === view)?.name;
  const heading = view === 'trending' ? 'Current Trends'
    : view === 'bestsellers' ? 'Global Bestsellers'
    : view === 'featured' ? 'Hand-Picked Products'
    : activeCategoryName || 'Picked by Researchers & Prodora AI';
  const subtitle = view === 'trending' ? 'Products with the fastest-growing demand right now.'
    : view === 'bestsellers' ? 'Products picked as bestsellers, ranked by orders.'
    : 'Explore winning products, verified by real-time sales data and expert research.';
  const visible = applyFiltersAndSort(products, filters, sort);
  // Digital products the admin flagged Trending / Bestseller also appear here.
  const flaggedBundles = bundles.filter((b) => {
    if (view === 'trending' ? !b.is_trending : !b.is_bestseller) return false;
    const q = debouncedSearch.trim().toLowerCase();
    return !q || b.name.toLowerCase().includes(q) || (b.description ?? '').toLowerCase().includes(q);
  });
  const activeFilters = filters.chips.length + (filters.minPrice ? 1 : 0) + (filters.maxPrice ? 1 : 0);
  const chipOptions = buildChips(products);
  // "Top selling categories": the 5 categories with the most products.
  const topCategories = [...categories]
    .sort((a, b) => (b.product_count ?? 0) - (a.product_count ?? 0) || a.name.localeCompare(b.name))
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-[#F3F5F9]">
      <Sidebar />

      <main className="app-main pt-12">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-3 pb-6 flex flex-col gap-3 sm:gap-4">

          <PageIntro title={heading} subtitle={subtitle} />

          <div className="space-y-3">
              <div className="flex flex-col gap-2 lg:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search products"
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-9 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.15fr)] gap-2 sm:grid-cols-3 lg:flex">
                  <Select value={categories.some((c) => c.slug === view) ? view : undefined} onValueChange={(v) => router.push(v === 'all' ? '/browse' : `/browse?view=${v}`)}>
                    <SelectTrigger className="h-10 w-full min-w-0 gap-1.5 bg-white px-2.5 text-[13px] sm:gap-2 sm:px-3 sm:text-sm lg:w-auto">
                      <LayoutGrid className="hidden h-4 w-4 shrink-0 text-gray-500 sm:block" />
                      <span className="min-w-0 flex-1 truncate text-left"><SelectValue placeholder="Category" /></span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map((c) => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <button
                    type="button"
                    onClick={() => setFiltersOpen((v) => !v)}
                    className={`inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition sm:gap-2 sm:px-3 sm:text-sm ${
                      filtersOpen || activeFilters ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <SlidersHorizontal className="h-4 w-4 shrink-0" /> <span className="truncate">Filters{activeFilters ? ` (${activeFilters})` : ''}</span>
                  </button>

                  <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                    <SelectTrigger className="h-10 w-full min-w-0 gap-1.5 bg-white px-2.5 text-[13px] sm:gap-2 sm:px-3 sm:text-sm lg:w-auto">
                      <ArrowUpDown className="h-4 w-4 shrink-0 text-gray-500" />
                      <span className="hidden text-gray-500 sm:inline">Sort:</span>
                      <span className="min-w-0 flex-1 truncate text-left"><SelectValue /></span>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => <SelectItem key={k} value={k}>{SORT_LABEL[k]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

          </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : visible.length === 0 && flaggedBundles.length === 0 ? (
                <div className="grid grid-cols-1">
                  <EmptyState hasSearch={!!debouncedSearch || activeFilters > 0} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5">
                  {visible.map(p => <ProductCard key={p.id} product={p} />)}
                  {flaggedBundles.map(b => <DigitalBundleCard key={`digital-${b.id}`} bundle={b} />)}
                </div>
              )}
        </div>

        <FilterDrawer
          open={filtersOpen} onClose={() => setFiltersOpen(false)}
          chips={chipOptions} value={filters} onChange={setFilters}
          topCategories={topCategories} activeCategory={view}
          onPickCategory={(slug) => { setFiltersOpen(false); router.push(slug === view ? '/browse' : `/browse?view=${slug}`); }}
        />
      </main>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <BrowseContent />
    </Suspense>
  );
}
