'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search, MousePointerClick, Download, PencilLine, Truck, Wallet, ArrowRight, HelpCircle, TrendingUp, Users, Globe2, Store, Megaphone,
} from 'lucide-react';
import { prodoraAuth, accountApi, ProdoraAccount } from '@/lib/api';
import Sidebar from '@/components/Sidebar';

const BILLING = 'https://store.exiuscart.com/dashboard/billing';

// Same numbers the backend enforces (shopping.py PRODORA_MONTHLY_IMPORT_LIMIT
// and usage.py PRODUCT_LIMITS).
const PLANS = [
  { key: 'launch', name: 'Launch', imports: '100', products: '1,000', trial: '7 days free' },
  { key: 'growth', name: 'Growth', imports: '500', products: '10,000', trial: '$1 for 7 days' },
  { key: 'scale', name: 'Scale', imports: 'Unlimited', products: 'Unlimited', trial: '$1 for 7 days' },
];

const STEPS = [
  { icon: Search, title: 'Find a product', text: 'Browse Picked Products, Global Bestsellers and Current Trends, or open the Marketplace to see the full catalogue by category. Use search, Category, Filters and Sort to narrow it down.' },
  { icon: MousePointerClick, title: 'Open it and read the data', text: 'Click any product to see its photos, videos, supplier details, shipping estimate and the research behind it. The section below explains every number.' },
  { icon: Download, title: 'Import it to your store', text: 'Press Import. Prodora copies the name, description, price, cost, photos and videos into your ExiusCart store as a normal product that you own. It counts as one import for the month.' },
  { icon: PencilLine, title: 'Make it yours', text: 'Open the product in your ExiusCart dashboard and set your own selling price, rewrite the title and description, and choose the photos to show.' },
  { icon: Truck, title: 'Connect a supplier to fulfil orders', text: 'An imported product shows stock 0 until you connect the matching supplier (for example CJ) in your ExiusCart store. Once connected, the product is always available and the supplier fulfils each order.' },
  { icon: Wallet, title: 'Sell and earn the difference', text: 'When a customer orders, you pay the supplier cost and keep the rest of the selling price, before shipping, taxes, ads and payment fees.' },
];

const DATA_GUIDE = [
  { icon: Wallet, term: 'Profit, Pay and Sell', text: 'Pay is the supplier cost. Sell is the price on your store. Profit is Sell minus Pay. It does not include shipping, which is extra and differs by country, or taxes, ads and payment fees.' },
  { icon: TrendingUp, term: 'Orders and demand trend', text: 'How many orders the product has received, and how interest has moved over time. Rising demand with steady orders is what you want to see.' },
  { icon: Users, term: 'Competition and saturation', text: 'How many other sellers are already promoting it. Lower competition and lower saturation leave more room for a new store.' },
  { icon: Globe2, term: 'Top countries and shipping', text: 'Where the product sells best, plus a real shipping estimate for the country you pick. Check it before you set your price.' },
  { icon: Store, term: 'Supplier details', text: 'The supplier name, rating, fulfilment rate, processing time and warehouse country, so you know who ships the order and how fast.' },
  { icon: Megaphone, term: 'Ad examples', text: 'Links to real ads for the product on Facebook, TikTok, Instagram and Pinterest, where available, to see how others sell it.' },
];

const FAQ = [
  { q: 'What counts as an import?', a: 'Every time you press Import on a product. Importing the same product again counts again, and deleting an imported product from your store does not give the import back.' },
  { q: 'When does my import count reset?', a: 'On the first day of every month. The exact date is shown in your usage card above.' },
  { q: 'What happens when I reach my limit?', a: 'You can still browse and research every product. Importing pauses until your count resets, or until you upgrade to a plan with a higher limit.' },
  { q: 'Do trials get Prodora?', a: 'Yes. A trial is a real plan, so you get that plan\'s Prodora access and its monthly import limit until the trial ends.' },
  { q: 'Is there a limit on the products in my store?', a: 'Yes, your plan also caps the total active products in your store. Imported products count towards it, as do products you add yourself.' },
];

export default function InstructionsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [account, setAccount] = useState<ProdoraAccount | null>(null);

  useEffect(() => {
    if (!prodoraAuth.hasAccess()) { router.replace('/'); return; }
    setAuthorized(true);
    accountApi.me().then(setAccount).catch(() => {});
  }, [router]);

  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-[#F3F5F9]">
      <Sidebar />
      <main className="app-main pt-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-12 pt-4 sm:px-6">
          <div>
            <h1 className="text-[22px] font-bold leading-tight text-gray-900">Instructions</h1>
            <p className="mt-0.5 text-sm text-gray-500">Everything you need to find a product, read its data and get it selling on your store.</p>
          </div>

          <PlanUsage account={account} />

          <Section title="How Prodora works">
            <ol className="grid gap-3 sm:grid-cols-2">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200/70">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600"><s.icon className="h-5 w-5" /></span>
                  <div>
                    <p className="font-semibold text-gray-900">{i + 1}. {s.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-500">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="How to read a product's data">
            <div className="grid gap-3 sm:grid-cols-2">
              {DATA_GUIDE.map((d) => (
                <div key={d.term} className="flex gap-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200/70">
                  <d.icon className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />
                  <div>
                    <p className="font-semibold text-gray-900">{d.term}</p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-500">{d.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="What each plan includes">
            <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-gray-200/70">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Plan</th>
                    <th className="px-4 py-3 font-semibold">Prodora imports / month</th>
                    <th className="px-4 py-3 font-semibold">Active store products</th>
                    <th className="px-4 py-3 font-semibold">Trial</th>
                  </tr>
                </thead>
                <tbody>
                  {PLANS.map((p) => {
                    const current = account?.plan_type === p.key;
                    return (
                      <tr key={p.key} className={`border-b border-gray-50 last:border-0 ${current ? 'bg-blue-50/60' : ''}`}>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {p.name} {current && <span className="ml-1.5 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Your plan</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{p.imports}</td>
                        <td className="px-4 py-3 text-gray-700">{p.products}</td>
                        <td className="px-4 py-3 text-gray-700">{p.trial}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <a href={BILLING} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
              Change plan in Subscription <ArrowRight className="h-4 w-4" />
            </a>
          </Section>

          <Section title="Common questions">
            <div className="divide-y divide-gray-100 rounded-lg bg-white shadow-sm ring-1 ring-gray-200/70">
              {FAQ.map((f) => (
                <div key={f.q} className="flex gap-3 p-4">
                  <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
                  <div>
                    <p className="font-semibold text-gray-900">{f.q}</p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-500">{f.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <div className="flex justify-center">
            <Link href="/browse" className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#2563EB] px-6 text-sm font-semibold text-white transition hover:bg-[#1E4FC2]">
              Start browsing products <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

function Meter({ label, used, limit, note }: { label: string; used: number; limit: number | null; note?: string }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const nf = new Intl.NumberFormat('en-US');
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-sm tabular-nums text-gray-600">
          <span className="font-bold text-gray-900">{nf.format(used)}</span> / {limit == null ? 'Unlimited' : nf.format(limit)}
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: limit == null ? '0%' : `${pct}%` }} />
      </div>
      {note && <p className="mt-1.5 text-xs text-gray-500">{note}</p>}
    </div>
  );
}

function PlanUsage({ account }: { account: ProdoraAccount | null }) {
  if (!account) {
    return <div className="h-40 animate-pulse rounded-lg bg-white shadow-sm ring-1 ring-gray-200/70" />;
  }
  const onTrial = account.status === 'trial' || account.status === 'trial_dollar';
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Your subscription</p>
          <p className="mt-1 text-xl font-bold text-gray-900">
            {account.plan_name} plan
            {onTrial && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 align-middle text-xs font-semibold text-amber-700">Trial</span>}
          </p>
          {onTrial && account.trial_ends_at && <p className="mt-0.5 text-sm text-gray-500">Trial ends {fmtDate(account.trial_ends_at)}</p>}
        </div>
        <a href={BILLING} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-200 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
          Manage subscription <ArrowRight className="h-4 w-4" />
        </a>
      </div>
      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <Meter
          label="Prodora imports this month"
          used={account.imports.used}
          limit={account.imports.limit}
          note={`Resets on ${fmtDate(account.imports.resets_at)}`}
        />
        <Meter
          label="Active products in your store"
          used={account.store_products.used}
          limit={account.store_products.limit}
          note="Includes imported products and ones you added yourself"
        />
      </div>
    </section>
  );
}
