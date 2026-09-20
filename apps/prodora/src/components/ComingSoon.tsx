'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, MessageSquareText } from 'lucide-react';
import { prodoraAuth } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import PageFooter from '@/components/PageFooter';

// Honest placeholder for sections that have no data behind them yet: what is
// coming, what to look forward to, a way to tell us what you want from it, and
// links to the parts that already work. No invented content, numbers or dates.
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

  const tellUs = () =>
    window.dispatchEvent(new CustomEvent('open-feedback', { detail: { prefill: `${title} — what I would like to see: ` } }));

  return (
    <div className="min-h-screen bg-[#F3F5F9]">
      <Sidebar />
      <main className="app-main pt-12">
        <div className="mx-auto max-w-[1400px] px-4 pb-28 pt-4 sm:px-6">
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-gray-200/70 sm:px-12 sm:py-14">
            <div aria-hidden className="pointer-events-none absolute -top-28 left-1/2 h-64 w-[34rem] max-w-full -translate-x-1/2 rounded-full bg-blue-100/70 blur-3xl" />

            <div className="relative flex flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-[#2563EB] ring-8 ring-blue-50/60">
                <Icon className="h-8 w-8" />
              </div>

              <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3.5 py-1 text-xs font-semibold text-amber-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
                Coming soon
              </span>

              <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">{title}</h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-500">{description}</p>

              <div className="mt-8 w-full text-left">
                <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">What to look forward to</p>
                <ul className="grid gap-3 sm:grid-cols-3">
                  {points.map((p) => (
                    <li key={p} className="flex gap-3 rounded-xl bg-gray-50 p-4 ring-1 ring-gray-200/70">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" />
                      <span className="text-sm font-medium leading-snug text-gray-800">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <button type="button" onClick={tellUs} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2563EB] px-5 text-sm font-semibold text-white transition hover:bg-[#1E4FC2]">
                  <MessageSquareText className="h-4 w-4" /> Tell us what you want
                </button>
                <Link href="/browse" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0B1D3A] px-5 text-sm font-semibold text-white transition hover:bg-[#122C55]">
                  Browse Picked Products <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/browse?view=bestsellers" className="inline-flex h-10 items-center rounded-lg border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                  Global Bestsellers
                </Link>
              </div>
              <p className="mt-5 text-xs text-gray-400">We build what sellers ask for. Your feedback decides what comes first.</p>
            </div>
          </div>
        </div>
      </main>
      <PageFooter />
    </div>
  );
}
