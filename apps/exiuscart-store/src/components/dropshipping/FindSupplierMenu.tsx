'use client';

import { useState } from 'react';
import { ChevronDown, ExternalLink, Loader2, Package } from 'lucide-react';
import { dropshipApi } from '@/lib/api';
import SupplierBadge, { SUPPLIER_NAMES } from './SupplierBadge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Opens each marketplace's own search for the product, so a seller can compare
// the same item elsewhere before importing. These are plain links: nothing is
// fetched or compared here. `key` matches our supplier keys, so the supplier a
// product already comes from can be left out.
const SOURCES: { key: string; label: string; group: 'import' | 'research'; url: (q: string) => string }[] = [
  { key: 'cj',         label: 'CJ Dropshipping', group: 'import',   url: (q) => `https://cjdropshipping.com/search/${encodeURIComponent(q)}.html` },
  { key: 'aliexpress', label: 'AliExpress',      group: 'import',   url: (q) => `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(q)}` },
  { key: 'alibaba',    label: 'Alibaba',         group: 'research', url: (q) => `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(q)}` },
  { key: '1688',       label: '1688',            group: 'research', url: (q) => `https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(q)}` },
  { key: 'globalsources', label: 'Global Sources', group: 'research', url: (q) => `https://www.globalsources.com/searchList/products?keyWord=${encodeURIComponent(q)}` },
  { key: 'dhgate',     label: 'DHgate',          group: 'research', url: (q) => `https://www.dhgate.com/wholesale/search.do?act=search&searchkey=${encodeURIComponent(q)}` },
  { key: 'amazon',     label: 'Amazon (retail price check)', group: 'research', url: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}` },
];

// Supplier titles are long and stuffed with keywords; marketplaces search far
// better on the first few plain words.
function searchTerm(name: string): string {
  return name.replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 5).join(' ');
}

export interface CJMatch { pid: string; name: string; image: string; cost_price: number; category: string }

// `compare` (Level 2): live CJ catalog search for similar items, with the real
// cost difference against this product. Only offered where CJ isn't the source.
export default function FindSupplierMenu({ name, exclude, compare }: {
  name: string; exclude?: string;
  compare?: { shopId: string; cost?: number; onPick: (p: CJMatch) => void };
}) {
  const q = searchTerm(name);
  const [matches, setMatches] = useState<CJMatch[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const loadMatches = (isOpen: boolean) => {
    if (!isOpen || !compare || matches !== null || loading) return;
    setLoading(true); setFailed(false);
    dropshipApi.cjSearch(compare.shopId, q)
      .then((r) => setMatches((r.data?.products ?? []).slice(0, 3)))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };
  const list = SOURCES.filter((s) => s.key !== exclude);
  const open = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');
  return (
    <DropdownMenu onOpenChange={loadMatches}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          Find best supplier <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {compare && (
          <>
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Similar on CJ (live)</DropdownMenuLabel>
            {loading && <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching CJ&hellip;</div>}
            {failed && <div className="px-2 py-2 text-xs text-destructive">CJ could not be reached. Try again shortly.</div>}
            {matches && matches.length === 0 && <div className="px-2 py-2 text-xs text-muted-foreground">No similar item found on CJ.</div>}
            {matches?.map((m) => {
              const diff = compare.cost !== undefined ? m.cost_price - compare.cost : null;
              return (
                <DropdownMenuItem key={m.pid} onSelect={() => compare.onPick(m)} className="gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                    {m.image
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={m.image} alt="" className="h-full w-full object-cover" />
                      : <Package className="h-4 w-4 text-muted-foreground" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs" title={m.name}>{m.name}</span>
                    <span className="text-xs font-semibold">${m.cost_price.toFixed(2)}
                      {diff !== null && Math.abs(diff) >= 0.005 && (
                        <span className={`ml-1.5 font-medium ${diff < 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                          {diff < 0 ? '-' : '+'}${Math.abs(diff).toFixed(2)} vs this
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="text-xs font-medium text-primary">Import</span>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Search &ldquo;{q}&rdquo; on</DropdownMenuLabel>
        {(['import', 'research'] as const).map((group, gi) => (
          <div key={group}>
            {gi > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="pt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              {group === 'import' ? 'You can import from' : 'Research only'}
            </DropdownMenuLabel>
            {list.filter((s) => s.group === group).map((s) => (
              <DropdownMenuItem key={s.key} onSelect={() => open(s.url(q))} className="justify-between">
                {SUPPLIER_NAMES[s.key] ? <SupplierBadge supplier={s.key} size={18} /> : s.label} <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
