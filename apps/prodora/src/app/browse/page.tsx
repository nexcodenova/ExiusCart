'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X, Download, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import { shoppingApi, prodoraAuth, Product, Category, digitalBundlesApi, DigitalBundle } from '@/lib/api';
import ProductCard from '@/components/ProductCard';
import Sidebar from '@/components/Sidebar';

function DigitalBundleCard({ bundle }: { bundle: DigitalBundle }) {
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<{ product_id: number; name: string } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [links, setLinks] = useState<{ editable_file_url: string | null; pdf_file_url: string | null } | null>(null);
  const [error, setError] = useState('');

  const handleDownload = async () => {
    setDownloading(true); setError('');
    try {
      const r = await digitalBundlesApi.download(bundle.id);
      setLinks(r);
    } catch {
      setError('Could not load download links.');
    } finally { setDownloading(false); }
  };

  const handleImport = async () => {
    setImporting(true); setError('');
    try {
      const r = await digitalBundlesApi.import(bundle.id);
      setImported(r);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Import failed.');
    } finally { setImporting(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col">
      <div className="relative aspect-video bg-gray-50">
        {bundle.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bundle.cover_image_url} alt={bundle.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Download className="w-8 h-8 text-gray-300" /></div>
        )}
        {bundle.purchased && (
          <span className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-semibold px-2 py-1 bg-green-500 text-white rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Purchased
          </span>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="text-sm font-semibold text-gray-800 line-clamp-2">{bundle.name}</p>
        {bundle.description && <p className="text-xs text-gray-500 line-clamp-2">{bundle.description}</p>}
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-gray-800">${bundle.price.toFixed(2)}</span>
          {bundle.suggested_resale_price && (
            <span className="text-green-600 font-medium">Resell ~${bundle.suggested_resale_price.toFixed(2)}</span>
          )}
        </div>
        {bundle.resale_notes && <p className="text-[11px] text-gray-400 line-clamp-2">{bundle.resale_notes}</p>}

        {error && <p className="text-[11px] text-red-500">{error}</p>}

        <div className="mt-auto pt-1 space-y-1.5">
          {!bundle.purchased ? (
            <a href={bundle.whop_checkout_url || '#'} target="_blank" rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition">
              Buy on Whop <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <>
              {!links ? (
                <button onClick={handleDownload} disabled={downloading}
                  className="w-full flex items-center justify-center gap-1.5 py-2 border border-gray-200 hover:bg-gray-50 rounded-lg text-xs font-semibold text-gray-700 transition disabled:opacity-60">
                  {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {downloading ? 'Loading…' : 'Get Download Links'}
                </button>
              ) : (
                <div className="flex gap-1.5">
                  {links.editable_file_url && (
                    <a href={links.editable_file_url} target="_blank" rel="noopener noreferrer"
                      className="flex-1 text-center py-2 border border-gray-200 hover:bg-gray-50 rounded-lg text-[11px] font-semibold text-gray-700">Editable</a>
                  )}
                  {links.pdf_file_url && (
                    <a href={links.pdf_file_url} target="_blank" rel="noopener noreferrer"
                      className="flex-1 text-center py-2 border border-gray-200 hover:bg-gray-50 rounded-lg text-[11px] font-semibold text-gray-700">PDF</a>
                  )}
                </div>
              )}
              {imported ? (
                <p className="text-center text-[11px] text-green-600 font-medium py-1.5">Added to your store as &ldquo;{imported.name}&rdquo; ✓</p>
              ) : (
                <button onClick={handleImport} disabled={importing}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-60 flex items-center justify-center gap-1.5">
                  {importing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {importing ? 'Adding…' : 'Import to My Store'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

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

  const [bundles, setBundles] = useState<DigitalBundle[]>([]);
  const [loadingBundles, setLoadingBundles] = useState(true);
  const [bundleError, setBundleError] = useState<string | null>(null);

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
    if (!authorized || view === 'digital') return;
    setLoading(true);
    setError(null);
    const params: Parameters<typeof shoppingApi.getProducts>[0] = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (view === 'trending') params.trending = true;
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

  useEffect(() => {
    if (!authorized || view !== 'digital') return;
    setLoadingBundles(true);
    setBundleError(null);
    digitalBundlesApi
      .list()
      .then(setBundles)
      .catch(() => {
        setBundleError('Could not load digital products. Please check your connection and try again.');
        setBundles([]);
      })
      .finally(() => setLoadingBundles(false));
  }, [authorized, view]);

  if (!authorized) return null;

  const isDigital = view === 'digital';
  const activeCategoryName = categories.find(c => c.slug === view)?.name;
  const heading = isDigital ? '📦 Digital Products' : view === 'trending' ? '🔥 Trending' : activeCategoryName || 'All Products';

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar />

      <main className="lg:pl-60">
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

          {/* Mobile category/trending tabs — sidebar is desktop-only */}
          <div className="lg:hidden -mx-4 px-4 flex gap-0 overflow-x-auto scrollbar-none border-b border-gray-200 pb-px">
            <MobileTab href="/browse" label="All" active={view === 'all'} />
            <MobileTab href="/browse?view=trending" label="🔥 Trending" active={view === 'trending'} />
            <MobileTab href="/browse?view=digital" label="📦 Digital" active={isDigital} />
            {categories.map(cat => (
              <MobileTab key={cat.id} href={`/browse?view=${cat.slug}`} label={cat.name} active={view === cat.slug} />
            ))}
          </div>

          {/* Search — not applicable to digital bundles (small, fixed catalog) */}
          {!isDigital && (
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search for products..."
                className="w-full bg-white border border-[#E5E7EB] rounded-lg pl-9 pr-9 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-800">{heading}</h1>
            <span className="text-sm text-gray-400">
              {isDigital
                ? !loadingBundles && `${bundles.length} bundle${bundles.length !== 1 ? 's' : ''}`
                : !loading && `${products.length} product${products.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          {isDigital ? (
            <>
              {bundleError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
                  {bundleError}
                </div>
              )}
              {loadingBundles ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : bundles.length === 0 ? (
                <div className="grid grid-cols-1">
                  <div className="col-span-full flex flex-col items-center justify-center py-24 text-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-4xl select-none">📦</div>
                    <h2 className="text-xl font-bold text-gray-800">No digital products yet</h2>
                    <p className="text-gray-400 max-w-xs text-sm">New ebooks, coloring books and design bundles are being added. Check back soon!</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {bundles.map(b => <DigitalBundleCard key={b.id} bundle={b} />)}
                </div>
              )}
            </>
          ) : (
            <>
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
                  <EmptyState hasSearch={!!debouncedSearch} />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {products.map(p => <ProductCard key={p.id} product={p} />)}
                </div>
              )}
            </>
          )}
        </div>

        <footer className="border-t border-gray-200 mt-12">
          <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <Image src="/prodora-logo.png" alt="Prodora" width={22} height={22} />
              <span className="font-semibold text-gray-600">Prodora by ExiusCart</span>
            </div>
            <p>© {new Date().getFullYear()} Fairam Private Limited. All rights reserved.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

function MobileTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex-shrink-0 text-sm font-medium px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
        active ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-gray-600 hover:text-[#2563EB] hover:border-[#2563EB]/40'
      }`}
    >
      {label}
    </Link>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <BrowseContent />
    </Suspense>
  );
}
