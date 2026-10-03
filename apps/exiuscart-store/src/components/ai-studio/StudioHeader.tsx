'use client';

// One branded header for every Product Studio page (Apify-console style):
// a small "ExiusCart Studio" label, a calm title and line, an optional
// right-side badge or action, then a banner and a three-step "how it works"
// row so each tool explains itself the same way.

import type { LucideIcon } from 'lucide-react';
import { Sparkles } from 'lucide-react';
import SectionBanner from '@/components/directory/SectionBanner';

export interface StudioStep { title: string; body: string }

export default function StudioHeader({
  icon: Icon, title, subtitle, right, banner, steps, bannerVariant = 0, eyebrow = 'ExiusCart Studio',
}: {
  eyebrow?: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  right?: React.ReactNode;
  banner?: { title: string; description: string; actionLabel?: string; onAction?: () => void; href?: string };
  steps?: StudioStep[];
  bannerVariant?: number;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3 w-3 text-indigo-500" /> {eyebrow}
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>

      {banner && <SectionBanner title={banner.title} description={banner.description} actionLabel={banner.actionLabel}
        onAction={banner.onAction} href={banner.href} variant={bannerVariant} />}

      {steps && steps.length > 0 && (
        <div className={`grid gap-3 ${steps.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          {steps.map((s, i) => (
            <div key={s.title} className="flex gap-3 rounded-xl border border-border bg-card p-4">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium text-foreground">{i + 1}</span>
              <div>
                <p className="text-sm font-medium text-foreground">{s.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The quiet usage pill shown top-right on the AI pages
export function UsagePill({ text }: { text: string }) {
  return <span className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs text-muted-foreground">{text}</span>;
}
