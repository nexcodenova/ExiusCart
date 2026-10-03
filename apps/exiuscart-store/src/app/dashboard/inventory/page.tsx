'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Package, AlertTriangle, Plus, Minus, X, ChevronDown, Loader2 } from 'lucide-react';
import { productsApi, inventoryApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';
import SupplierBadge from '@/components/dropshipping/SupplierBadge';

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  minStock: number;
  cost: number;
  price: number;
  image?: string | null;
  // Set for products a dropship supplier holds and ships (their stock, not yours)
  supplier?: string | null;
  lastUpdated?: string;
}

type StockFilter = 'all' | 'low' | 'out' | 'healthy';

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [newPrice, setNewPrice] = useState<string>('');
  const [savingPrice, setSavingPrice] = useState(false);
  const [generatingSkus, setGeneratingSkus] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
  const { baseSym: sym } = useCurrency();

  const fetchInventory = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const res = await productsApi.getAll(shopId);
      setItems(res.data.map((p: any) => ({
        id: p.id, name: p.name, sku: p.sku ?? '', category: p.category?.name ?? (typeof p.category === 'string' ? p.category : ''),
        stock: p.stock ?? p.quantity ?? 0,
        minStock: p.lowStockAlert ?? p.low_stock_threshold ?? 5,
        cost: p.costPrice ?? p.cost_price ?? 0,
        price: p.sellingPrice ?? p.price ?? 0,
        image: p.image_url ?? p.image ?? null,
        supplier: p.dropship_supplier ?? ((p.stock ?? p.quantity ?? 0) >= 999999 ? 'supplier' : null),
        lastUpdated: p.updatedAt ?? p.updated_at,
      })));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  const handleAdjust = async () => {
    if (!adjustingItem) return;
    setSavingPrice(true);
    try {
      if (adjustQty !== 0) {
        await inventoryApi.adjustStock(shopId, adjustingItem.id, adjustQty, adjustReason);
      }
      const priceNum = parseFloat(newPrice);
      if (newPrice !== '' && !isNaN(priceNum) && priceNum !== adjustingItem.price) {
        await productsApi.update(shopId, adjustingItem.id, { price: priceNum });
      }
      fetchInventory();
    } catch {}
    setSavingPrice(false);
    setAdjustingItem(null);
    setAdjustQty(0);
    setAdjustReason('');
    setNewPrice('');
  };

  const filtered = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStock =
      stockFilter === 'all' ? true :
      stockFilter === 'out' ? !item.supplier && item.stock === 0 :
      stockFilter === 'low' ? !item.supplier && item.stock > 0 && item.stock <= item.minStock :
      item.stock > item.minStock;
    return matchesSearch && matchesStock;
  });

  const outOfStock = items.filter(i => !i.supplier && i.stock === 0).length;
  const lowStock = items.filter(i => !i.supplier && i.stock > 0 && i.stock <= i.minStock).length;
  // Your own stock and supplier-held stock are counted apart: a supplier's warehouse count is not money you have tied up
  const own = items.filter((i) => !i.supplier);
  const supplied = items.filter((i) => !!i.supplier);
  const ownValue = own.reduce((sum, i) => sum + i.price * i.stock, 0);
  const ownCost = own.reduce((sum, i) => sum + i.cost * i.stock, 0);
  const ownUnits = own.reduce((sum, i) => sum + i.stock, 0);
  const money = (n: number) => `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const missingSkuCount = items.filter(i => !i.sku).length;

  const handleGenerateSkus = async () => {
    if (!shopId) return;
    setGeneratingSkus(true);
    try {
      await productsApi.backfillSkus(shopId);
      await fetchInventory();
    } catch {}
    setGeneratingSkus(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your own stock, its value, and what needs restocking. Supplier products are counted apart.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Products', value: loading ? '—' : String(items.length), sub: `${own.length} yours · ${supplied.length} from suppliers`, dot: 'bg-indigo-500' },
          { label: 'Low stock', value: loading ? '—' : String(lowStock), sub: 'At or under the minimum', dot: 'bg-amber-500' },
          { label: 'Out of stock', value: loading ? '—' : String(outOfStock), sub: 'Need restocking', dot: 'bg-red-500' },
          { label: 'Your stock value', value: loading ? '—' : money(ownValue), sub: `${ownUnits.toLocaleString()} units · cost ${money(ownCost)}`, dot: 'bg-emerald-500' },
          { label: 'Supplier products', value: loading ? '—' : String(supplied.length), sub: 'Stock held and shipped by the supplier', dot: 'bg-sky-500' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />{c.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{c.value}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Low stock alert banner — moved here from the Products page, since
          restocking is an Inventory action, not a product-editing one */}
      {!loading && !alertDismissed && (outOfStock > 0 || lowStock > 0) && (
        <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${outOfStock > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-orange-500/10 border-orange-500/30'}`}>
          <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${outOfStock > 0 ? 'text-red-500' : 'text-orange-500'}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${outOfStock > 0 ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
              Stock Alert
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {outOfStock > 0 && <span className="text-red-500 font-medium">{outOfStock} out of stock</span>}
              {outOfStock > 0 && lowStock > 0 && <span className="mx-1">·</span>}
              {lowStock > 0 && <span className="text-orange-500 font-medium">{lowStock} running low</span>}
              <span className="ml-2">— restock before you run out.</span>
            </p>
            <div className="flex gap-2 mt-2">
              {outOfStock > 0 && (
                <button onClick={() => setStockFilter('out')} className="text-xs px-2.5 py-1 bg-red-500/15 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-500/25 transition font-medium">
                  Show out of stock ({outOfStock})
                </button>
              )}
              {lowStock > 0 && (
                <button onClick={() => setStockFilter('low')} className="text-xs px-2.5 py-1 bg-orange-500/15 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-500/25 transition font-medium">
                  Show low stock ({lowStock})
                </button>
              )}
            </div>
          </div>
          <button onClick={() => setAlertDismissed(true)} className="p-1 hover:bg-muted rounded transition shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Missing SKU banner */}
      {!loading && missingSkuCount > 0 && (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-orange-600 dark:text-orange-400">
            <span className="font-semibold">{missingSkuCount}</span> product{missingSkuCount !== 1 ? 's' : ''} {missingSkuCount !== 1 ? "don't" : "doesn't"} have a SKU yet.
          </p>
          <button
            type="button"
            onClick={handleGenerateSkus}
            disabled={generatingSkus}
            className="inline-flex items-center gap-2 text-xs px-3 py-1.5 bg-orange-500/15 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-500/25 transition font-medium disabled:opacity-50"
          >
            {generatingSkus && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Generate missing SKUs
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full pl-10 pr-4 bg-background border border-border rounded-md text-sm focus:ring-2 focus:ring-foreground/10 outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="relative">
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as StockFilter)}
            aria-label="Filter by stock level"
            className="h-9 appearance-none w-full sm:w-44 px-3 pr-9 bg-background border border-border rounded-md text-sm focus:ring-2 focus:ring-foreground/10 outline-none text-foreground"
          >
            <option value="all">All Items</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
            <option value="healthy">Healthy</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <h3 className="font-medium text-foreground mb-1">
              {searchQuery || stockFilter !== 'all' ? 'No items found' : 'No products in inventory'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery || stockFilter !== 'all' ? 'Try adjusting your filters' : 'Add products to start tracking inventory'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="sticky left-0 z-10 w-12 min-w-12 bg-muted px-3 py-2.5 text-left font-medium">#</th>
                  <th className="sticky left-12 z-10 bg-muted px-3 py-2.5 text-left font-medium shadow-[1px_0_0_hsl(var(--border))]">Product</th>
                  <th className="px-3 py-2.5 text-left font-medium">SKU</th>
                  <th className="px-3 py-2.5 text-left font-medium">Category</th>
                  <th className="px-3 py-2.5 text-center font-medium">Stock</th>
                  <th className="px-3 py-2.5 text-center font-medium">Min</th>
                  <th className="px-3 py-2.5 text-right font-medium">Price</th>
                  <th className="px-3 py-2.5 text-right font-medium">Stock value</th>
                  <th className="sticky right-0 z-10 bg-muted px-3 py-2.5 text-right font-medium shadow-[-1px_0_0_hsl(var(--border))]">Adjust</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item, index) => {
                  const isOut = item.stock === 0;
                  const isLow = item.stock > 0 && item.stock <= item.minStock;
                  const bySupplier = !!item.supplier;
                  return (
                    <tr key={item.id} className="group h-[52px] transition hover:bg-muted/30">
                      <td className="sticky left-0 z-[1] w-12 min-w-12 bg-card px-3 py-1.5 text-xs tabular-nums text-muted-foreground group-hover:bg-muted">{index + 1}</td>
                      <td className="sticky left-12 z-[1] bg-card px-3 py-1.5 shadow-[1px_0_0_hsl(var(--border))] group-hover:bg-muted">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <Package className="h-3.5 w-3.5 text-muted-foreground" />}
                          </div>
                          <span className="max-w-[260px] truncate text-[13px] font-medium text-foreground" title={item.name}>{item.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        {item.sku
                          ? <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
                          : <span className="text-xs font-medium text-orange-600 dark:text-orange-400">Missing</span>}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-foreground">{item.category || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-1.5 text-center">
                        {bySupplier ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title="Stock held by the supplier">
                            {item.supplier && item.supplier !== 'supplier' ? <SupplierBadge supplier={item.supplier} label={false} size={16} /> : null} Supplier
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 text-[13px] tabular-nums ${isOut ? 'font-medium text-red-600 dark:text-red-400' : isLow ? 'font-medium text-orange-600 dark:text-orange-400' : 'text-foreground'}`}>
                            {(isOut || isLow) && <span className={`h-1.5 w-1.5 rounded-full ${isOut ? 'bg-red-500' : 'bg-orange-500'}`} />}
                            {item.stock.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center text-xs text-muted-foreground">{bySupplier ? '—' : item.minStock}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-foreground">{money(item.price)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-foreground">{bySupplier ? <span className="text-xs text-muted-foreground">Supplier&apos;s</span> : money(item.price * item.stock)}</td>
                      <td className="sticky right-0 z-[1] bg-card px-3 py-1.5 text-right shadow-[-1px_0_0_hsl(var(--border))] group-hover:bg-muted">
                        <button
                          type="button"
                          onClick={() => { setAdjustingItem(item); setAdjustQty(0); setAdjustReason(''); setNewPrice(''); }}
                          className="h-8 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition hover:bg-muted"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjust Stock Modal */}
      {adjustingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Adjust Stock</h2>
              <button type="button" onClick={() => setAdjustingItem(null)} aria-label="Close" className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="font-medium text-foreground">{adjustingItem.name}</p>
                <p className="text-sm text-muted-foreground">Current stock: <span className="font-medium text-foreground">{adjustingItem.stock}</span> · Current price: <span className="font-medium text-foreground">{adjustingItem.price.toLocaleString()} {sym}</span></p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Quantity Change</label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setAdjustQty(q => q - 1)} className="w-10 h-10 flex items-center justify-center bg-muted rounded-lg hover:bg-muted/80 transition"><Minus className="w-4 h-4" /></button>
                  <input type="number" value={adjustQty} onChange={(e) => setAdjustQty(Number(e.target.value))} className="flex-1 text-center px-3 py-2 bg-muted border border-border rounded-lg outline-none text-foreground text-lg font-bold" />
                  <button type="button" onClick={() => setAdjustQty(q => q + 1)} className="w-10 h-10 flex items-center justify-center bg-muted rounded-lg hover:bg-muted/80 transition"><Plus className="w-4 h-4" /></button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">New stock: <span className={`font-medium ${adjustingItem.stock + adjustQty < 0 ? 'text-red-500' : 'text-foreground'}`}>{Math.max(0, adjustingItem.stock + adjustQty)}</span></p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Update Selling Price ({sym}) <span className="opacity-60 font-normal">— leave blank to keep current</span></label>
                <input type="number" value={newPrice} min={0} onChange={(e) => setNewPrice(e.target.value)} placeholder={String(adjustingItem.price)} className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Reason</label>
                <input type="text" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="e.g. Stock count, price update..." className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setAdjustingItem(null)} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
                <button type="button" onClick={handleAdjust} disabled={savingPrice || (adjustQty === 0 && newPrice === '')} className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg hover:opacity-90 transition font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingPrice && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
