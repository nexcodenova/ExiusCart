'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock, ArrowRight } from 'lucide-react';
import { prodoraAuth } from '@/lib/api';
import Sidebar from '@/components/Sidebar';

// Honest placeholder for sections that have no data behind them yet — says
// what is coming and sends the seller to the parts that already work, rather
// than showing invented content.
export default function ComingSoon({
  icon: Icon, title, description, points,
}: {
  icon: React.ElementType; title: string; description: string; points: string[];
}) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!prodoraAuth.hasAccess()) { router.replace('/'); return; }
    setAuthorized(true);
  }, [router]);

  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-[#F3F5F9]">
      <Sidebar />
      <main className="app-main pt-16">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-[#2563EB]">
            <Icon className="h-8 w-8" />
          </div>
          <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            <Clock className="h-3.5 w-3.5" /> Coming soon
          </span>
          <h1 className="mt-3 text-3xl font-bold text-gray-900">{title}</h1>
          <p className="mx-auto mt-2 max-w-lg text-gray-500">{description}</p>
          <ul className="mx-auto mt-6 max-w-md space-y-2 text-left text-sm text-gray-600">
            {points.map((p) => (
              <li key={p} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2563EB]" />{p}</li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/browse?view=featured" className="inline-flex items-center gap-2 rounded-lg bg-[#0B1D3A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#122C55]">
              Browse Product Picks <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/browse?view=bestsellers" className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
              Global Bestsellers
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
