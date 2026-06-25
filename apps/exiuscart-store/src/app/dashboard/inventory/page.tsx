'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Package, AlertTriangle, Plus, Minus, X, ChevronDown, Loader2, DollarSign, PackageX } from 'lucide-react';
import { productsApi, inventoryApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  minStock: number;
  cost: number;
  price: number;
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
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
  const { sym } = useCurrency();

  const fetchInventory = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const res = await productsApi.getAll(shopId);
      setItems(res.data.map((p: any) => ({
        id: p.id, name: p.name, sku: p.sku, category: p.category,
        stock: p.stock ?? p.quantity ?? 0,
        minStock: p.lowStockAlert ?? p.low_stock_threshold ?? 5,
        cost: p.costPrice ?? p.cost_price ?? 0,
        price: p.sellingPrice ?? p.price ?? 0,
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
      stockFilter === 'out' ? item.stock === 0 :
      stockFilter === 'low' ? item.stock > 0 && item.stock <= item.minStock :
      item.stock > item.minStock;
    return matchesSearch && matchesStock;
  });

  const outOfStock = items.filter(i => i.stock === 0).length;
  const lowStock = items.filter(i => i.stock > 0 && i.stock <= i.minStock).length;
  const inventoryValue = items.reduce((sum, i) => sum + i.price * i.stock, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
        <p className="text-muted-foreground text-sm">Track and manage your stock levels</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total SKUs', icon: Package, value: loading ? '—' : String(items.length), color: '' },
          { label: 'Low Stock', icon: AlertTriangle, value: loading ? '—' : String(lowStock), color: 'text-orange-600 dark:text-orange-400' },
          { label: 'Out of Stock', icon: PackageX, value: loading ? '—' : String(outOfStock), color: 'text-red-600 dark:text-red-400' },
          { label: 'Inventory Value', icon: DollarSign, value: loading ? '—' : `${inventoryValue.toLocaleString()} ${sym}`, color: '' },
        ].map(({ label, icon: Icon, value, color }) => (
          <div key={label} className="bg-card rounded-2xl border border-border p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><Icon className="h-5 w-5 text-foreground/70" /></div>
            <p className="mt-4 text-sm text-muted-foreground">{label}</p>
            <p className={`mt-0.5 text-2xl font-bold tracking-tight tabular-nums ${color || 'text-foreground'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card rounded-2xl border border-border p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-muted border border-border rounded-xl focus:ring-2 focus:ring-foreground/10 outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="relative">
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as StockFilter)}
            aria-label="Filter by stock level"
            className="appearance-none w-full sm:w-44 px-4 py-2.5 pr-10 bg-muted border border-border rounded-xl focus:ring-2 focus:ring-foreground/10 outline-none text-foreground"
          >
            <option value="all">All Items</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
            <option value="healthy">Healthy</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Package className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold text-foreground mb-1">
              {searchQuery || stockFilter !== 'all' ? 'No items found' : 'No products in inventory'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery || stockFilter !== 'all' ? 'Try adjusting your filters' : 'Add products to start tracking inventory'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Product</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">SKU</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Category</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Stock</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Min</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Price</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Total Value</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Adjust</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item) => {
                  const isOut = item.stock === 0;
                  const isLow = item.stock > 0 && item.stock <= item.minStock;
                  return (
                    <tr key={item.id} className="hover:bg-muted/30 transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {(isOut || isLow) && <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${isOut ? 'text-red-500' : 'text-orange-500'}`} />}
                          <span className="font-medium text-foreground">{item.name}</span>
                        </div>
                      </td>
                      <td className="p-4"><span className="text-sm text-muted-foreground font-mono">{item.sku}</span></td>
                      <td className="p-4"><span className="text-sm text-foreground">{item.category}</span></td>
                      <td className="p-4 text-center">
                        <span className={`text-sm font-semibold px-2 py-1 rounded-full ${isOut ? 'bg-red-500/10 text-red-600 dark:text-red-400' : isLow ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400' : 'bg-green-500/10 text-green-600 dark:text-green-400'}`}>
                          {item.stock}
                        </span>
                      </td>
                      <td className="p-4 text-center"><span className="text-sm text-muted-foreground">{item.minStock}</span></td>
                      <td className="p-4 text-right"><span className="text-sm font-medium text-foreground">{item.price.toLocaleString()} {sym}</span></td>
                      <td className="p-4 text-right"><span className="text-sm text-foreground">{(item.price * item.stock).toLocaleString()} {sym}</span></td>
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => { setAdjustingItem(item); setAdjustQty(0); setAdjustReason(''); setNewPrice(''); }}
                          className="text-xs px-3 py-1.5 bg-muted rounded-lg text-foreground hover:bg-muted/80 transition"
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
