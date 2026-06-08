'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, X, Flame } from 'lucide-react';
import { shoppingApi, Product, Category } from '@/lib/api';
import ProductCard from '@/components/ProductCard';

function SkeletonCard() {
  return (
    <div className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden animate-pulse">
      <div className="aspect-square bg-[#1e1e1e]" />
      <div className="p-3 flex flex-col gap-2">
        <div className="h-3 bg-[#1e1e1e] rounded w-1/3" />
        <div className="h-4 bg-[#1e1e1e] rounded w-3/4" />
        <div className="h-4 bg-[#1e1e1e] rounded w-1/2" />
      </div>
    </div>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-24 text-center gap-4">
      <div className="text-6xl select-none">🔥</div>
      <h2 className="text-xl font-bold text-white">
        {hasSearch ? 'No products found' : 'No trending products yet'}
      </h2>
      <p className="text-[#999] max-w-xs">
        {hasSearch ? 'Try adjusting your search or filters.' : 'Check back soon — new drops coming!'}
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

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/90 backdrop-blur border-b border-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0 flex items-center gap-2">
            <Image src="/logo.svg" alt="ExiusCart" width={28} height={28} />
            <span className="text-xl font-extrabold tracking-tight">
              <span className="text-[#6B3FD9]">Exius</span>
              <span className="text-white">Cart</span>
            </span>
          </Link>

          {/* Trends badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 flex-shrink-0">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-orange-400 text-xs font-bold">Trends</span>
          </div>

          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search trending products..."
              className="w-full bg-[#111] border border-[#222] rounded-xl pl-9 pr-9 py-2 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#6B3FD9]/60 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Premium badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7B4FE9]/10 border border-[#7B4FE9]/30 flex-shrink-0">
            <span className="text-[#7B4FE9] text-xs font-bold">Premium</span>
          </div>
        </div>

        {/* Category pills */}
        {(categories.length > 0 || !loading) && (
          <div className="max-w-7xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveCategory('all')}
              className={`flex-shrink-0 text-sm font-semibold px-4 py-1.5 rounded-full border transition-colors ${
                activeCategory === 'all'
                  ? 'bg-[#6B3FD9] text-white border-[#6B3FD9]'
                  : 'bg-transparent text-[#999] border-[#333] hover:border-[#6B3FD9]/50 hover:text-white'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.slug)}
                className={`flex-shrink-0 text-sm font-semibold px-4 py-1.5 rounded-full border transition-colors ${
                  activeCategory === cat.slug
                    ? 'bg-[#6B3FD9] text-white border-[#6B3FD9]'
                    : 'bg-transparent text-[#999] border-[#333] hover:border-[#6B3FD9]/50 hover:text-white'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : products.length === 0
            ? <EmptyState hasSearch={!!(debouncedSearch || activeCategory !== 'all')} />
            : products.map(product => (
                <ProductCard key={product.id} product={product} />
              ))
          }
        </div>
      </main>
    </div>
  );
}
