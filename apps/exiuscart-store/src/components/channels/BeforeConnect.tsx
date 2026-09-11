'use client';

import type { LucideIcon } from 'lucide-react';

export interface FeatureBadge { icon: LucideIcon; label: string; desc: string; }
export interface HowItWorksStep { icon: LucideIcon; title: string; desc: string; }

// Shared shell for every channel's "before connect" page — feature badges,
// the connect form (channel-specific, passed as children) + a sidebar,
// then a real "How it works" strip. Keeps all ~12 channels visually
// consistent without copy-pasting the same layout into every file.
export default function BeforeConnectLayout({
  badges, sidebar, steps, children, accentClass = 'bg-primary/10 text-primary',
}: {
  badges: FeatureBadge[];
  sidebar: React.ReactNode;
  steps: HowItWorksStep[];
  children: React.ReactNode; // the connect form card
  accentClass?: string; // icon chip colour, per-channel brand tint
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {badges.map((f) => (
          <div key={f.label} className="rounded-xl border border-border bg-card p-3.5 flex items-start gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${accentClass}`}>
              <f.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground">{f.label}</p>
              <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)] items-start">
        {children}
        <div className="space-y-4">{sidebar}</div>
      </div>

      <div id="how-it-works" className="rounded-xl border border-border bg-muted/30 p-5 scroll-mt-6">
        <h2 className="text-sm font-bold text-foreground mb-4">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s) => (
            <div key={s.title} className="flex items-start gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${accentClass}`}>
                <s.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground">{s.title}</p>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SidebarCard({ icon: Icon, iconClass, title, desc, action }: {
  icon: LucideIcon; iconClass: string; title: string; desc: string; action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
