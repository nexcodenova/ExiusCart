'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, BadgeCheck, Infinity as InfinityIcon, PackageX } from 'lucide-react';
import { digitalBundlesApi, prodoraAuth, DigitalBundle } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import PageIntro from '@/components/PageIntro';
import { DigitalBundleCard, SkeletonCard } from '@/components/DigitalBundleCard';

const PERKS = [
  { icon: BadgeCheck, title: 'Buy once, licensed to sell', text: 'Pay one time and get the licence to sell it as your own. No monthly fees or renewals.' },
  { icon: InfinityIcon, title: 'Sell as much as you like', text: 'Sell as many copies as you want. There is no cap on your sales.' },
  { icon: PackageX, title: 'No stock to hold', text: 'These are digital files, so nothing runs out and nothing needs shipping.' },
];

export default function DigitalProductsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [bundles, setBundles] = useState<DigitalBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!prodoraAuth.hasAccess()) { router.replace('/'); return; }
    setAuthorized(true);
    digitalBundlesApi.list()
      .then(setBundles)
      .catch(() => setError('Could not load digital products. Please check your connection and try again.'))
      .finally(() => setLoading(false));
  }, [router]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? bundles.filter((b) => b.name.toLowerCase().includes(q) || (b.description ?? '').toLowerCase().includes(q)) : bundles;
  }, [bundles, search]);

  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-[#F3F5F9]">
      <Sidebar />
      <main className="app-main pt-12">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 pb-8 pt-4 sm:px-6">
          <PageIntro title="Digital Products" subtitle="Ready to sell. Buy once, get the licence, and sell as much as you like." />

          <ul className="grid gap-3 sm:grid-cols-3">
            {PERKS.map((p) => (
              <li key={p.title} className="flex gap-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200/70">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600"><p.icon className="h-5 w-5" /></span>
                <div>
                  <p className="font-semibold text-gray-900">{p.title}</p>
                  <p className="mt-0.5 text-sm leading-snug text-gray-500">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search digital products"
              className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-9 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-600">{error}</div>}

          {loading ? (
            <Grid>{Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}</Grid>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
              <h2 className="text-lg font-bold text-gray-800">{search ? 'No digital products found' : 'No digital products yet'}</h2>
              <p className="max-w-xs text-sm text-gray-400">{search ? 'Try a different search.' : 'New ebooks, coloring books and design bundles are being added. Check back soon!'}</p>
            </div>
          ) : (
            <Grid>{visible.map((b) => <DigitalBundleCard key={b.id} bundle={b} />)}</Grid>
          )}
        </div>
      </main>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5">{children}</div>;
}
