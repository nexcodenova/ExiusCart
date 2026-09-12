'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, Sparkles } from 'lucide-react';

// Shared "not built yet" page for any sidebar item that doesn't have a real
// feature behind it — used instead of a raw 404 so navigation never dead-ends,
// and instead of faking data/functionality that doesn't exist. Honest by
// design: no fabricated charts, counts, or controls, just what this will be
// and a way back.
export default function ComingSoon({
  icon: Icon = Sparkles,
  group,
  title,
  description,
  accentClass = 'bg-primary/10 text-primary',
}: {
  icon?: LucideIcon;
  group: string;
  title: string;
  description: string;
  accentClass?: string;
}) {
  return (
    <div className="max-w-2xl mx-auto py-16 px-6 text-center space-y-6">
      <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${accentClass}`}>
        <Icon className="w-8 h-8" />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group}</p>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Sparkles className="w-3 h-3" /> Coming soon
        </span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">{description}</p>
      <Link href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
      </Link>
    </div>
  );
}
