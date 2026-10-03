'use client';

// Supplier documentation: how to connect every dropshipping and print-on-demand
// supplier, on one page, with a side list to jump between them.

import Link from 'next/link';
import { ArrowLeft, Check, ExternalLink, Info } from 'lucide-react';
import SupplierBadge from '@/components/dropshipping/SupplierBadge';
import { SUPPLIER_GUIDES } from '@/components/dropshipping/supplierGuides';

const GROUPS: { title: string; keys: string[] }[] = [
  { title: 'Dropshipping suppliers', keys: ['cj', 'aliexpress', 'hypersku', 'eprolo', '1688'] },
  { title: 'Print on demand', keys: ['printful', 'printify', 'gelato'] },
];

export default function SupplierDocsPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/dropshipping" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Suppliers
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Supplier documentation</h1>
        <p className="mt-1 text-sm text-muted-foreground">How to connect each supplier, what to have ready, and what works once it is connected.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Side list */}
        <nav className="hidden lg:block">
          <div className="sticky top-20 space-y-5">
            {GROUPS.map((g) => (
              <div key={g.title}>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">{g.title}</p>
                <ul className="space-y-0.5">
                  {g.keys.filter((k) => SUPPLIER_GUIDES[k]).map((k) => (
                    <li key={k}>
                      <a href={`#${k}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition hover:bg-muted">
                        <SupplierBadge supplier={k} label={false} size={18} /> {SUPPLIER_GUIDES[k].name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        {/* Every guide */}
        <div className="space-y-10">
          {GROUPS.map((group) => (
            <section key={group.title} className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground">{group.title}</h2>
              {group.keys.filter((k) => SUPPLIER_GUIDES[k]).map((k) => {
                const g = SUPPLIER_GUIDES[k];
                return (
                  <article key={k} id={k} className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card">
                    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                      <div className="flex items-center gap-3">
                        <SupplierBadge supplier={k} label={false} size={32} />
                        <div>
                          <h3 className="font-semibold text-foreground">{g.name}</h3>
                          <p className="text-xs text-muted-foreground">{g.intro}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a href={g.signupUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition hover:bg-muted">
                          Open {g.name} <ExternalLink className="h-3 w-3" />
                        </a>
                        <Link href={`/dashboard/dropshipping/guide/${k}`}
                          className="inline-flex h-8 items-center rounded-md bg-foreground px-2.5 text-xs font-medium text-background transition hover:opacity-90">
                          Full guide
                        </Link>
                      </div>
                    </header>
                    <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_240px]">
                      <ol className="space-y-3">
                        {g.steps.map((st, i) => (
                          <li key={st.title} className="flex gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-[11px] font-semibold text-foreground">{i + 1}</span>
                            <div>
                              <p className="text-sm font-medium text-foreground">{st.title}</p>
                              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{st.body}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Have ready</p>
                          <ul className="mt-1.5 space-y-1">
                            {g.needs.map((n) => <li key={n} className="text-[13px] text-foreground">· {n}</li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Once connected</p>
                          <ul className="mt-1.5 space-y-1">
                            {g.works.map((w) => <li key={w} className="flex gap-1.5 text-[13px] text-foreground"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{w}</li>)}
                          </ul>
                        </div>
                        {g.limits?.map((l) => (
                          <p key={l} className="flex gap-1.5 rounded-md bg-muted/50 p-2 text-xs leading-relaxed text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{l}</p>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
