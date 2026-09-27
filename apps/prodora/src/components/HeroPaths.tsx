'use client';

import { ArrowRight, Flame, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AiCtaButton from '@/components/AiCtaButton';
import { useLoginModal } from '@/components/providers/LoginModalProvider';

// The two ways into Prodora, side by side: ask the AI in plain words, or browse the hand-picked winning products.
export default function HeroPaths() {
  const { open } = useLoginModal();
  return (
    <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
      <div className="flex flex-col rounded-2xl border border-primary/30 bg-primary/[0.05] p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></span>
          Ask Prodora AI
        </div>
        <p className="mb-4 flex-1 text-sm text-muted-foreground">Say what you want to sell. Get products with real margin, competition and shipping scores, then launch in one click.</p>
        <AiCtaButton className="w-full">Try Prodora AI <ArrowRight className="h-4 w-4" /></AiCtaButton>
      </div>
      <div className="flex flex-col rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground"><Flame className="h-4 w-4" /></span>
          Browse winning products
        </div>
        <p className="mb-4 flex-1 text-sm text-muted-foreground">Trending, ready-to-sell products with the supplier cost and your profit shown up front. Import in one click.</p>
        <Button variant="outline" className="w-full" onClick={() => open()}>Browse winning products <ArrowRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
