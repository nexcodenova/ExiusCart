'use client';

// "Sell this design": turn a Brand Assets design into a real product at the
// seller's own print-on-demand supplier — Printify, Printful or Gelato.

import { StudioAsset } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PrintifyPanel } from './PrintifyPanel';
import { PrintfulPanel } from './PrintfulPanel';
import { GelatoPanel } from './GelatoPanel';

export default function SendToPodDialog({ shopId, asset, onClose }: { shopId: string; asset: StudioAsset | null; onClose: () => void }) {
  return (
    <Dialog open={!!asset} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Sell this design with print on demand</DialogTitle></DialogHeader>
        {asset && (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset.url} alt="" className="h-14 w-14 rounded-md border border-border bg-muted object-contain" />
            <p className="text-sm text-muted-foreground">Creates the product in your own supplier account. The supplier prints and ships each order.</p>
          </div>
        )}
        <Tabs defaultValue="printify">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="printify">Printify</TabsTrigger>
            <TabsTrigger value="printful">Printful</TabsTrigger>
            <TabsTrigger value="gelato">Gelato</TabsTrigger>
          </TabsList>
          <TabsContent value="printify" className="pt-3"><PrintifyPanel shopId={shopId} asset={asset} onClose={onClose} /></TabsContent>
          <TabsContent value="printful" className="pt-3"><PrintfulPanel shopId={shopId} asset={asset} onClose={onClose} /></TabsContent>
          <TabsContent value="gelato" className="pt-3"><GelatoPanel shopId={shopId} asset={asset} onClose={onClose} /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
