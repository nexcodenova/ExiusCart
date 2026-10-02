'use client';

// Pick one of the shop's products (search by name or SKU) for the AI pages.

import { useEffect, useState } from 'react';
import { Search, Package, Loader2, X } from 'lucide-react';
import { productsApi } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PickedProduct {
  id: number;
  name: string;
  sku?: string | null;
  image_url?: string | null;
  description?: string | null;
}

export default function ProductPicker({ shopId, value, onChange }: {
  shopId: string;
  value: PickedProduct | null;
  onChange: (p: PickedProduct | null) => void;
}) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<PickedProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!shopId || value) return;
    setLoading(true);
    const t = setTimeout(() => {
      productsApi.getAll(shopId, { search: q.trim() || undefined })
        .then((r) => setItems((r.data ?? []).slice(0, 24)))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [shopId, q, value]);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border p-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value.image_url ? <img src={value.image_url} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{value.name}</p>
          {value.sku && <p className="text-xs text-muted-foreground">SKU {value.sku}</p>}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}><X className="h-4 w-4" /> Change</Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your products by name or SKU…" className="pl-9" />
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading products…</div>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{q ? `No products match "${q}".` : 'You have no products yet.'}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 max-h-80 overflow-y-auto pr-1">
          {items.map((p) => (
            <button key={p.id} type="button" onClick={() => onChange(p)}
              className={cn('flex items-center gap-3 rounded-lg border border-border p-2.5 text-left transition hover:border-primary/50 hover:bg-primary/5')}>
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : <Package className="h-4 w-4 text-muted-foreground" />}
              </div>
              <span className="min-w-0 truncate text-sm text-foreground">{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
