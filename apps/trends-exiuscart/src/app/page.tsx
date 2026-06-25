'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, X, ChevronRight } from 'lucide-react';
import { shoppingApi, Product, Category } from '@/lib/api';
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
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    shoppingApi.getCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
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
  }, [debouncedSearch, activeCategory]);

  const trending = products.filter(p => p.is_trending);
  const rest = products.filter(p => !p.is_trending);
  const isFiltered = !!(debouncedSearch || activeCategory !== 'all');

  return (
    <div className="min-h-screen bg-[#f3f3f3]">
      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <header className="bg-[#FF6000] shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0 flex items-center gap-2 mr-2">
            <Image src="/logo.svg" alt="ExiusCart" width={30} height={30} />
            <div className="leading-none">
              <span className="text-white font-extrabold text-lg tracking-tight block leading-none">
                ExiusCart
              </span>
              <span className="text-orange-100 text-[10px] font-medium tracking-widest uppercase">
                Trends
              </span>
            </div>
          </Link>

          {/* Search bar */}
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

        {/* Category tabs */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 flex gap-0 overflow-x-auto scrollbar-none">
            <CategoryTab
              label="All Products"
              active={activeCategory === 'all'}
              onClick={() => setActiveCategory('all')}
            />
            {categories.map(cat => (
              <CategoryTab
                key={cat.id}
                label={cat.name}
                active={activeCategory === cat.slug}
                onClick={() => setActiveCategory(cat.slug)}
              />
            ))}
          </div>
        </div>
      </header>

      {/* ── Hero Banner ───────────────────────────────────────────────── */}
      {!isFiltered && !loading && (
        <div className="bg-gradient-to-r from-[#FF6000] to-[#ff8c3f] text-white">
          <div className="max-w-7xl mx-auto px-4 py-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold leading-tight">
                Dropshipping Products
                <br />
                <span className="text-orange-100">Ready to Sell</span>
              </h1>
              <p className="text-orange-100 text-sm mt-2 max-w-sm">
                Source trending products and start selling from your ExiusCart store today.
              </p>
            </div>
            <div className="hidden sm:block text-6xl select-none">🔥</div>
          </div>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : products.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            <EmptyState hasSearch={isFiltered} />
          </div>
        ) : isFiltered ? (
          <section>
            <p className="text-sm text-gray-500 mb-4">
              {products.length} product{products.length !== 1 ? 's' : ''} found
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {products.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        ) : (
          <>
            {trending.length > 0 && (
              <section>
                <SectionHeader title="🔥 Trending Now" />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                  {trending.map(p => <ProductCard key={p.id} product={p} />)}
                </div>
              </section>
            )}

            {rest.length > 0 && (
              <section>
                <SectionHeader title="All Products" />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                  {rest.map(p => <ProductCard key={p.id} product={p} />)}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <Image src="/logo.svg" alt="ExiusCart" width={22} height={22} />
            <span className="font-semibold text-gray-600">ExiusCart Trends</span>
          </div>
          <p>© {new Date().getFullYear()} Fairam Private Limited. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function CategoryTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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
      <span className="flex items-center gap-1 text-xs text-[#FF6000] font-medium">
        View all <ChevronRight className="w-3.5 h-3.5" />
      </span>
    </div>
  );
}
