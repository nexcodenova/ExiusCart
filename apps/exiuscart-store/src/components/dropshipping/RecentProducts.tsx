import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';

export interface RecentProduct {
  id: number;
  name: string;
  image_url: string | null;
  price: number;
  cost_price: number | null;
  supplier_type: string;
}

const SUPPLIER_NAMES: Record<string, string> = {
  cj: 'CJ Dropshipping', hypersku: 'HyperSKU', eprolo: 'EPROLO', aliexpress: 'AliExpress',
  '1688': '1688', printful: 'Printful', printify: 'Printify', gelato: 'Gelato',
};

// Real products actually imported via a supplier (DropshipProductLink),
// most recent first — a lightweight preview, not a duplicate of the full
// Import Products browsing/search experience which stays on its own page.
export default function RecentProducts({ products }: { products: RecentProduct[] }) {
  return (
    <div>
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Source products faster</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Discover products, compare supplier costs and import them directly into ExiusCart.</p>
        </div>
        <Button asChild variant="ghost" className="hidden md:flex shrink-0">
          <Link href="/dashboard/dropshipping/import">View all products</Link>
        </Button>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <div className="mx-auto w-11 h-11 rounded-2xl bg-muted flex items-center justify-center mb-3">
              <Package className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No products imported yet.</p>
            <Button asChild size="sm" className="mt-3">
              <Link href="/dashboard/dropshipping/import">Browse supplier catalogs</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <div className="relative aspect-square bg-muted">
                {p.image_url ? (
                  <Image src={p.image_url} alt={p.name} fill className="object-cover" unoptimized />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center"><Package className="w-6 h-6 text-muted-foreground/40" /></div>
                )}
                <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-bold text-foreground backdrop-blur">
                  {SUPPLIER_NAMES[p.supplier_type] ?? p.supplier_type}
                </span>
              </div>
              <CardContent className="p-3">
                <p className="text-xs font-semibold text-foreground line-clamp-1">{p.name}</p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  {p.cost_price != null && <span className="text-muted-foreground">Cost ${p.cost_price.toFixed(2)}</span>}
                  <span className="font-bold text-foreground">${p.price.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
