'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ExternalLink, Lock, Rocket, Scale, Search, Sparkles } from 'lucide-react';
import { priceCoachApi, type CoachHome } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const STEPS = [
  { icon: Search, title: 'Ask in plain words', text: 'For example "products for US pet owners under $30". Prodora AI understands the sentence and searches the catalogue.' },
  { icon: Sparkles, title: 'Read real scores', text: 'Each result shows margin, competition, shipping and a clear verdict. Anything we cannot measure yet says Not measured.' },
  { icon: Rocket, title: 'Launch with ExiusCart', text: 'One click brings the product into this store as a draft, priced and with a listing written for it. You review it, then publish.' },
];

// Prodora AI itself lives on Prodora (where sellers already find products). This page is the way in from the store, and
// where the drafts it creates show up.
export default function ProdoraAiPage() {
  const [home, setHome] = useState<CoachHome | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const shopId = localStorage.getItem('shop_id') || '';
    if (!shopId) { setLoading(false); return; }
    priceCoachApi.home(shopId).then((r) => setHome(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // The header owns the plan and TheDersi rules and the login handover; it opens Prodora on this page.
  const open = () => window.dispatchEvent(new CustomEvent('open-prodora', { detail: { path: '/ai' } }));
  const locked = home?.locked === true;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Prodora AI</h1>
        <p className="text-sm text-muted-foreground">Find products in plain words, see real scores, and launch one in a click</p>
      </div>

      {loading ? (
        <Skeleton className="h-56 w-full" />
      ) : (
        <Card>
          <CardContent className="space-y-6 p-6">
            <div className="grid gap-3 sm:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.title} className="rounded-xl border border-border bg-muted/30 p-4">
                  <s.icon className="mb-2 h-5 w-5 text-primary" />
                  <p className="text-sm font-semibold text-foreground">{s.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.text}</p>
                </div>
              ))}
            </div>

            {locked ? (
              <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2 text-sm text-foreground"><Lock className="h-4 w-4 text-primary" /> Prodora AI is included in the Growth and Scale plans.</p>
                <Button asChild><Link href="/dashboard/billing">See plans <ArrowRight className="h-4 w-4" /></Link></Button>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <Button onClick={open}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/prodora-logo.png" alt="" className="h-4 w-4 rounded-[3px]" /> Open Prodora AI <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button asChild variant="outline"><Link href="/dashboard/price-coach"><Scale className="h-4 w-4" /> Your drafts in Price Coach</Link></Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Products you launch from Prodora AI arrive here as private drafts. They stay hidden until you publish them, and they appear in Price Coach with their price check.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
