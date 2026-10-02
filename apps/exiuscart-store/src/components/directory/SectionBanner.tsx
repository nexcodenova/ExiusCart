'use client';

// Apify-store style section banner: a light block with a large title, one line
// of text, an outline button and quiet line art on the right. Each directory
// section (sales channels, suppliers) opens with one, then its cards follow.

import { cn } from '@/lib/utils';

const ART = [
  // folded paper planes
  <g key="a"><polygon points="20,10 260,60 90,120" /><polyline points="90,120 120,70 260,60" /><polygon points="300,90 520,40 420,230" /><polyline points="300,90 380,150 520,40" /></g>,
  // stacked tiles
  <g key="b"><polygon points="60,80 200,30 340,80 200,130" /><polygon points="200,150 340,100 480,150 340,200" /><polygon points="340,60 480,10 560,40 420,90" /><line x1="200" y1="130" x2="200" y2="150" /></g>,
  // linked nodes
  <g key="c"><circle cx="90" cy="90" r="40" /><circle cx="300" cy="60" r="28" /><circle cx="470" cy="150" r="50" /><line x1="128" y1="80" x2="272" y2="64" /><line x1="326" y1="72" x2="430" y2="125" /><rect x="180" y="150" width="120" height="70" rx="12" /></g>,
];

export default function SectionBanner({ title, description, actionLabel, onAction, href, variant = 0, count }: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  href?: string;
  variant?: number;
  count?: number;
}) {
  const button = actionLabel && (href ? (
    <a href={href} className="inline-flex items-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted">{actionLabel}</a>
  ) : (
    <button type="button" onClick={onAction} className="inline-flex items-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted">{actionLabel}</button>
  ));
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-muted/40">
      <svg aria-hidden viewBox="0 0 580 240" preserveAspectRatio="xMidYMid meet"
        className="pointer-events-none absolute right-0 top-0 hidden h-full w-[48%] fill-none stroke-indigo-300/80 dark:stroke-indigo-400/30 md:block" strokeWidth="1.5">
        {ART[variant % ART.length]}
      </svg>
      <div className="relative max-w-2xl px-6 py-8 sm:px-10 sm:py-10">
        <h2 className={cn('text-3xl font-normal tracking-tight text-indigo-950 sm:text-4xl dark:text-indigo-100')}>{title}</h2>
        {description && <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">{description}</p>}
        <div className="mt-5 flex items-center gap-4">
          {button}
          {typeof count === 'number' && <span className="text-sm text-muted-foreground">{count} {count === 1 ? 'option' : 'options'}</span>}
        </div>
      </div>
    </div>
  );
}
