'use client';

// "How to connect" guide for one dropshipping supplier.

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Check, ExternalLink, Info } from 'lucide-react';
import SupplierBadge from '@/components/dropshipping/SupplierBadge';
import { SUPPLIER_GUIDES } from '@/components/dropshipping/supplierGuides';

export default function SupplierGuidePage() {
  const { supplier } = useParams<{ supplier: string }>();
  const g = SUPPLIER_GUIDES[supplier];

  if (!g) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/dropshipping" className="text-xs text-muted-foreground hover:text-foreground">← Suppliers</Link>
        <p className="text-sm text-muted-foreground">No guide for this supplier yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/dropshipping" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Suppliers
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <SupplierBadge supplier={supplier} label={false} size={36} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">How to connect {g.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{g.intro}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Steps */}
        <ol className="space-y-3">
          {g.steps.map((st, i) => (
            <li key={st.title} className="flex gap-4 rounded-xl border border-border bg-card p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold text-foreground">{i + 1}</span>
              <div>
                <p className="text-sm font-semibold text-foreground">{st.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{st.body}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* Side panel */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Have ready</p>
            <ul className="mt-2 space-y-1.5">
              {g.needs.map((n) => <li key={n} className="flex gap-2 text-sm text-foreground"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/50" />{n}</li>)}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Once connected</p>
            <ul className="mt-2 space-y-1.5">
              {g.works.map((w) => <li key={w} className="flex gap-2 text-sm text-foreground"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{w}</li>)}
            </ul>
          </div>
          {g.limits && (
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              {g.limits.map((l) => <p key={l} className="flex gap-2 text-xs leading-relaxed text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{l}</p>)}
            </div>
          )}
          <div className="flex flex-col gap-2">
            {g.keyUrl && (
              <a href={g.keyUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-foreground px-3 text-sm font-medium text-background transition hover:opacity-90">
                Open {g.name} key page <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <a href={g.signupUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-muted">
              {g.name} sign up / sign in <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Link href="/dashboard/dropshipping"
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-muted">
              Back to connect
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
