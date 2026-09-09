'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, Package, MoreHorizontal, Loader2 } from 'lucide-react';
import { productsApi } from '@/lib/api';

interface Product {
  id: number;
  name: string;
  sku?: string;
  price: number;
  quantity: number;
  is_active?: boolean;
  image_url?: string;
}

// Every active product is automatically reachable through the public
// storefront API — there's no separate "website product" concept or
// per-product sync state for this channel, so this is just the shop's
// real product list (same data the Products page shows), not a duplicate
// synced copy with its own fake "Last sync" column.
export default function WebsiteProductsTable({ shopId }: { shopId: string }) {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId) return;
    const t = setTimeout(() => {
      setLoading(true);
      productsApi.getAll(shopId, { search: search || undefined })
        .then((r) => setProducts((r.data?.products ?? r.data ?? []).slice(0, 8)))
        .catch(() => setProducts([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [shopId, search]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-border">
        <h3 className="text-base font-bold text-foreground">Website products</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..."
              className="h-8 w-44 pl-8 pr-2 bg-muted border border-border rounded-lg text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <Link href="/dashboard/products" className="text-xs font-semibold text-primary hover:opacity-80 whitespace-nowrap">View all →</Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-xs">Loading…</span>
        </div>
      ) : products.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No products found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {['Product', 'SKU', 'Price', 'Inventory', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="relative w-8 h-8 rounded-lg bg-muted overflow-hidden shrink-0">
                        {p.image_url ? (
                          <Image src={p.image_url} alt="" fill className="object-cover" unoptimized />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center"><Package className="w-3.5 h-3.5 text-muted-foreground/40" /></div>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-foreground line-clamp-1 max-w-[140px]">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{p.sku ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs font-semibold text-foreground whitespace-nowrap">${Number(p.price).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{p.quantity}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                      p.quantity === 0 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : p.is_active === false ? 'bg-muted text-muted-foreground' : 'bg-green-500/10 text-green-600 dark:text-green-400'
                    }`}>
                      {p.quantity === 0 ? 'Out of stock' : p.is_active === false ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/dashboard/products?edit=${p.id}`} className="text-muted-foreground hover:text-foreground">
                      <MoreHorizontal className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
