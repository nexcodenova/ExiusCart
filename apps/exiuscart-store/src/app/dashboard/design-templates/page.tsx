'use client';

import Link from 'next/link';
import { LayoutTemplate } from 'lucide-react';
import StudioHeader from '@/components/ai-studio/StudioHeader';

export default function Page() {
  return (
    <div className="space-y-6">
      <StudioHeader icon={LayoutTemplate} title="Templates"
        subtitle="Ready-made layouts for listings, ads and social posts. Coming soon."
        banner={{ title: 'Templates are on the way', description: 'Reusable layouts for listing photos, ad images and social posts are being built. Until then, Design Studio and Mockup Studio cover designs and product photos.', actionLabel: 'Open Design Studio', href: '/dashboard/design-studio' }}
        bannerVariant={2} />
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { t: 'Listing photo layouts', d: 'Product photo plus feature callouts, sized for Etsy, Amazon and your store.' },
          { t: 'Ad and social posts', d: 'Square and story formats with your brand colours and a headline.' },
          { t: 'Your brand kit', d: 'Logo, colours and fonts applied to every template automatically.' },
        ].map((x) => (
          <div key={x.t} className="rounded-xl border border-dashed border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">{x.t}</p>
            <p className="mt-1 text-xs text-muted-foreground">{x.d}</p>
            <span className="mt-3 inline-block rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">Coming soon</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Need something now? <Link href="/dashboard/mockup-studio" className="font-medium text-foreground hover:underline">Make mockups</Link> or <Link href="/dashboard/brand-assets" className="font-medium text-foreground hover:underline">open Brand Assets</Link>.</p>
    </div>
  );
}
