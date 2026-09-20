'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, Sparkles, Zap, Layers, ShieldCheck, Plug, Wand2, MessageSquareText } from 'lucide-react';

type Highlight = { icon: LucideIcon; title: string; text: string };

// A few honest, group-level promises so every "coming soon" page has
// something to look forward to. No dates, no invented numbers.
const DEFAULT_HIGHLIGHTS: Highlight[] = [
  { icon: Zap, title: 'Built into ExiusCart', text: 'Lives inside your dashboard. No extra app, no extra login.' },
  { icon: Layers, title: 'Uses your own data', text: 'Works with the products, orders and customers you already have.' },
  { icon: ShieldCheck, title: 'You stay in control', text: 'Nothing changes on your store until you say so.' },
];

const GROUP_HIGHLIGHTS: Record<string, Highlight[]> = {
  'AI Commerce': [
    { icon: Wand2, title: 'Less busywork', text: 'Let AI handle the repetitive parts of running your store.' },
    { icon: Layers, title: 'Knows your store', text: 'Works from your real products, orders and customers.' },
    { icon: ShieldCheck, title: 'You approve first', text: 'Review what AI suggests before anything goes live.' },
  ],
  'Product Studio': [
    { icon: Wand2, title: 'Product visuals, fast', text: 'Create graphics, mockups and scenes without a design tool.' },
    { icon: Layers, title: 'Made for your catalogue', text: 'Start from your own products and reuse the results.' },
    { icon: Zap, title: 'Straight to your listings', text: 'Use what you create on your store and sales channels.' },
  ],
  'MCP & AI Connections': [
    { icon: Plug, title: 'Connect once', text: 'Link your AI tools to your store in a few clicks.' },
    { icon: ShieldCheck, title: 'Permissions you set', text: 'Choose exactly what each connection can see and do.' },
    { icon: Layers, title: 'Your real data', text: 'Ask about and act on your live products and orders.' },
  ],
  Integrations: [
    { icon: Plug, title: 'One place to connect', text: 'Manage payments, shipping and marketing tools together.' },
    { icon: ShieldCheck, title: 'Secure by default', text: 'Credentials are stored encrypted, never shown in full.' },
    { icon: Zap, title: 'Works store-wide', text: 'Set it up once and use it across your whole store.' },
  ],
};

// Descriptions on the placeholder pages end with a developer note ("Not built
// yet."). Keep the useful part, drop the note.
function cleanDescription(text: string): string {
  const [head, ...rest] = text.split(/\s*Not built yet\.?\s*[—–-]*\s*/i);
  const tail = rest.join(' ').trim();
  const capitalised = tail ? tail.charAt(0).toUpperCase() + tail.slice(1) : '';
  return [head.trim(), capitalised].filter(Boolean).join(' ');
}

// Shared "not built yet" page for any sidebar item that doesn't have a real
// feature behind it — used instead of a raw 404 so navigation never dead-ends,
// and instead of faking data/functionality that doesn't exist. Honest by
// design: no fabricated charts, counts or dates. It says what the feature is
// for, what to look forward to, and lets people tell us what they want from
// it (that opens the Feedback popover in the top bar).
export default function ComingSoon({
  icon: Icon = Sparkles,
  group,
  title,
  description,
  accentClass = 'bg-primary/10 text-primary',
  embedded = false,
}: {
  icon?: LucideIcon;
  group: string;
  title: string;
  description: string;
  accentClass?: string;
  /** Inside a tab of another page: smaller, no "what to expect" cards. */
  embedded?: boolean;
}) {
  const highlights = GROUP_HIGHLIGHTS[group] ?? DEFAULT_HIGHLIGHTS;

  const tellUs = () =>
    window.dispatchEvent(new CustomEvent('open-feedback', { detail: { prefill: `${title} — what I would like to see: ` } }));

  return (
    <div className={embedded ? 'py-2' : 'mx-auto max-w-3xl py-6 sm:py-10'}>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-10 text-center sm:px-12 sm:py-14">
        <div aria-hidden className="pointer-events-none absolute -top-28 left-1/2 h-64 w-[34rem] max-w-full -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative flex flex-col items-center">
          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ring-8 ring-primary/5 ${accentClass}`}>
            <Icon className="h-8 w-8" />
          </div>

          <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
            Coming soon
          </span>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{cleanDescription(description)}</p>

          {!embedded && (
            <ul className="mt-8 grid w-full gap-3 text-left sm:grid-cols-3">
              {highlights.map((h) => (
                <li key={h.title} className="rounded-xl border border-border bg-muted/30 p-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><h.icon className="h-4 w-4" /></span>
                  <p className="mt-3 text-sm font-semibold text-foreground">{h.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{h.text}</p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button" onClick={tellUs}
              className="hidden h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 md:inline-flex"
            >
              <MessageSquareText className="h-4 w-4" /> Tell us what you want
            </button>
            {!embedded && (
              <Link href="/dashboard" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-5 text-sm font-medium text-foreground transition hover:bg-muted">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
              </Link>
            )}
          </div>
          <p className="mt-5 text-xs text-muted-foreground">We build what sellers ask for. Your feedback decides what comes first.</p>
        </div>
      </div>
    </div>
  );
}
