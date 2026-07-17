'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, X, Tag, LayoutGrid } from 'lucide-react';
import { shoppingApi, prodoraAuth, Product, Category } from '@/lib/api';
import ProductCard from '@/components/ProductCard';

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="aspect-square bg-gray-100" />
      <div className="p-3 flex flex-col gap-2">
        <div className="h-2.5 bg-gray-100 rounded w-1/3" />
        <div className="h-4 bg-gray-100 rounded w-3/4" />
        <div className="h-4 bg-gray-100 rounded w-1/2" />
        <div className="h-5 bg-gray-100 rounded w-2/5 mt-1" />
      </div>
    </div>
  );
}

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

export default function HomePage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!prodoraAuth.hasAccess()) {
      router.replace('/');
      return;
    }
    setAuthorized(true);
  }, [router]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!authorized) return;
    shoppingApi.getCategories().then(setCategories).catch(() => {});
  }, [authorized]);

  useEffect(() => {
    if (!authorized) return;
    setLoading(true);
    setError(null);
    const params: Parameters<typeof shoppingApi.getProducts>[0] = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (activeCategory && activeCategory !== 'all') params.category = activeCategory;
    shoppingApi
      .getProducts(params)
      .then(setProducts)
      .catch(() => {
        setError('Could not load products. Please check your connection and try again.');
        setProducts([]);
      })
      .finally(() => setLoading(false));
  }, [authorized, debouncedSearch, activeCategory]);

  if (!authorized) return null;

  const trending = products.filter(p => p.is_trending);
  const rest = products.filter(p => !p.is_trending);
  const isFiltered = !!(debouncedSearch || activeCategory !== 'all');
  const activeCategoryName = categories.find(c => c.slug === activeCategory)?.name;

  return (
    <div className="min-h-screen bg-[#f3f3f3]">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="bg-[#FF6000] shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="flex-shrink-0 flex items-center gap-2 mr-2">
            <Image src="/logo.svg" alt="Prodora" width={30} height={30} />
            <div className="leading-none">
              <span className="text-white font-extrabold text-lg tracking-tight block leading-none">
                Prodora
              </span>
              <span className="text-orange-100 text-[10px] font-medium tracking-widest uppercase">
                by ExiusCart
              </span>
            </div>
          </Link>

          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search for products..."
              className="w-full bg-white border border-transparent rounded-lg pl-9 pr-9 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-200 shadow-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Mobile category scroll — hidden on desktop (sidebar handles it) */}
        {categories.length > 0 && (
          <div className="lg:hidden bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 flex gap-0 overflow-x-auto scrollbar-none">
              <MobileCategoryTab label="All" active={activeCategory === 'all'} onClick={() => setActiveCategory('all')} />
              {categories.map(cat => (
                <MobileCategoryTab
                  key={cat.id}
                  label={cat.name}
                  active={activeCategory === cat.slug}
                  onClick={() => setActiveCategory(cat.slug)}
                />
              ))}
            </div>
          </div>
        )}
      </header>

      {/* ── Hero Banner ───────────────────────────────────────────────── */}
      {!isFiltered && !loading && (
        <div className="bg-gradient-to-r from-[#FF6000] to-[#ff8c3f] text-white">
          <div className="max-w-7xl mx-auto px-4 py-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold leading-tight">
                Discover Winning Products
                <br />
                <span className="text-orange-100">Ready to Sell</span>
              </h1>
              <p className="text-orange-100 text-sm mt-2 max-w-sm">
                Find all kinds of winning products and sell them from your ExiusCart store today.
              </p>
            </div>
            <div className="hidden sm:block text-6xl select-none">🔥</div>
          </div>
        </div>
      )}

      {/* ── Layout: Sidebar + Main ─────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6 items-start">

          {/* ── Left Sidebar — desktop only ───────────────────────── */}
          <aside className="hidden lg:flex flex-col gap-3 w-52 flex-shrink-0 sticky top-[72px]">
            {/* Categories card */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-[#FF6000]" />
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Categories</span>
              </div>
              <div className="p-2">
                <SidebarCategoryItem
                  label="All Products"
                  active={activeCategory === 'all'}
                  onClick={() => setActiveCategory('all')}
                />
                {categories.map(cat => (
                  <SidebarCategoryItem
                    key={cat.id}
                    label={cat.name}
                    active={activeCategory === cat.slug}
                    onClick={() => setActiveCategory(cat.slug)}
                  />
                ))}
                {categories.length === 0 && (
                  <p className="text-xs text-gray-400 px-3 py-2">No categories yet</p>
                )}
              </div>
            </div>

            {/* Dropshipper tip card */}
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-4 h-4 text-[#FF6000]" />
                <span className="text-xs font-bold text-gray-700">How it works</span>
              </div>
              <ul className="text-xs text-gray-500 space-y-1.5">
                <li>✓ Browse winning products</li>
                <li>✓ Copy supplier links</li>
                <li>✓ List on your ExiusCart store</li>
                <li>✓ Start selling today</li>
              </ul>
              <a
                href="https://store.exiuscart.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block text-center text-xs font-bold text-white bg-[#FF6000] hover:bg-[#e05500] px-3 py-2 rounded-lg transition"
              >
                Open My Store →
              </a>
            </div>
          </aside>

          {/* ── Main Content ──────────────────────────────────────── */}
          <main className="flex-1 min-w-0 space-y-8">
            {/* Active filter breadcrumb */}
            {isFiltered && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500">
                  {products.length} product{products.length !== 1 ? 's' : ''}
                  {activeCategoryName ? ` in "${activeCategoryName}"` : ''}
                  {debouncedSearch ? ` for "${debouncedSearch}"` : ''}
                </span>
                <button
                  onClick={() => { setActiveCategory('all'); setSearch(''); }}
                  className="flex items-center gap-1 text-xs text-[#FF6000] hover:underline"
                >
                  <X className="w-3 h-3" /> Clear filter
                </button>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
                {error}
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : products.length === 0 ? (
              <div className="grid grid-cols-1">
                <EmptyState hasSearch={isFiltered} />
              </div>
            ) : isFiltered ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {products.map(p => <ProductCard key={p.id} product={p} />)}
              </div>
            ) : (
              <>
                {trending.length > 0 && (
                  <section>
                    <SectionHeader title="🔥 Trending Now" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                      {trending.map(p => <ProductCard key={p.id} product={p} />)}
                    </div>
                  </section>
                )}

                {rest.length > 0 && (
                  <section>
                    <SectionHeader title="All Products" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                      {rest.map(p => <ProductCard key={p.id} product={p} />)}
                    </div>
                  </section>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <Image src="/logo.svg" alt="Prodora" width={22} height={22} />
            <span className="font-semibold text-gray-600">Prodora by ExiusCart</span>
          </div>
          <p>© {new Date().getFullYear()} Fairam Private Limited. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function SidebarCategoryItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
        active
          ? 'bg-[#FF6000] text-white font-semibold'
          : 'text-gray-600 hover:bg-orange-50 hover:text-[#FF6000]'
      }`}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}

function MobileCategoryTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 text-sm font-medium px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
        active
          ? 'border-[#FF6000] text-[#FF6000]'
          : 'border-transparent text-gray-600 hover:text-[#FF6000] hover:border-[#FF6000]/40'
      }`}
    >
      {label}
    </button>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-bold text-gray-800">{title}</h2>
    </div>
  );
}
