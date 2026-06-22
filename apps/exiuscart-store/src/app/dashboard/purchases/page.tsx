'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, Plus, Truck, X, Check, Clock, Loader2, Trash2, ChevronDown } from 'lucide-react';
import { purchasesApi, suppliersApi, productsApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier: string;
  supplier_id?: number;
  items: number;
  total: number;
  status: string;
  date: string;
  received_at?: string;
  line_items?: LineItem[];
}

interface LineItem {
  id: number;
  product_id?: number;
  product_name: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  total_cost: number;
}

interface Supplier { id: number; name: string; }
interface Product { id: string; name: string; costPrice: number; }

const STATUS_STYLES: Record<string, string> = {
  received: 'bg-green-500/10 text-green-600 dark:text-green-400',
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  partial: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedPO, setExpandedPO] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
  const { sym } = useCurrency();

  // New PO form
  const [poForm, setPoForm] = useState({ supplier_id: '', notes: '' });
  const [poItems, setPoItems] = useState<{ product_id: string; product_name: string; quantity_ordered: number; unit_cost: number }[]>([
    { product_id: '', product_name: '', quantity_ordered: 1, unit_cost: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [receivingPO, setReceivingPO] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [poRes, supRes, prodRes] = await Promise.all([
        purchasesApi.getAll(shopId),
        suppliersApi.getAll(shopId),
        productsApi.getAll(shopId),
      ]);
      setPurchases(poRes.data ?? []);
      setSuppliers(supRes.data ?? []);
      setProducts(prodRes.data ?? []);
    } catch {
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = purchases.filter((p) =>
    p.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.supplier.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalValue = purchases.reduce((sum, p) => sum + p.total, 0);
  const pendingCount = purchases.filter((p) => p.status === 'pending').length;

  const addPoItem = () => setPoItems(prev => [...prev, { product_id: '', product_name: '', quantity_ordered: 1, unit_cost: 0 }]);
  const removePoItem = (i: number) => setPoItems(prev => prev.filter((_, idx) => idx !== i));
  const updatePoItem = (i: number, field: string, value: any) => {
    setPoItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      if (field === 'product_id' && value) {
        const prod = products.find(p => p.id === value);
        return { ...item, product_id: value, product_name: prod?.name || '', unit_cost: prod?.costPrice || 0 };
      }
      return { ...item, [field]: value };
    }));
  };

  const poTotal = poItems.reduce((sum, item) => sum + item.quantity_ordered * item.unit_cost, 0);

  const handleCreatePO = async () => {
    setSaving(true);
    try {
      await purchasesApi.create(shopId, {
        supplier_id: poForm.supplier_id ? parseInt(poForm.supplier_id) : null,
        notes: poForm.notes,
        items: poItems.filter(i => i.product_name.trim()).map(i => ({
          product_id: i.product_id ? parseInt(i.product_id) : null,
          product_name: i.product_name,
          quantity_ordered: i.quantity_ordered,
          unit_cost: i.unit_cost,
        })),
      });
      setShowAddModal(false);
      setPoForm({ supplier_id: '', notes: '' });
      setPoItems([{ product_id: '', product_name: '', quantity_ordered: 1, unit_cost: 0 }]);
      fetchData();
    } catch {/* no-op */}
    finally { setSaving(false); }
  };

  const handleMarkReceived = async (po: PurchaseOrder) => {
    setReceivingPO(po.id);
    const receivedQtys: Record<string, number> = {};
    po.line_items?.forEach(item => { receivedQtys[String(item.id)] = item.quantity_ordered; });
    try {
      await purchasesApi.receive(shopId, po.id, receivedQtys);
      fetchData();
    } catch {/* no-op */}
    finally { setReceivingPO(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Purchase Orders</h1>
          <p className="text-muted-foreground text-sm">
            Track orders from suppliers •{' '}
            <Link href="/dashboard/suppliers" className="text-primary hover:underline">
              Manage Suppliers
            </Link>
          </p>
        </div>
        <button type="button" onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition">
          <Plus className="w-4 h-4" /> New Purchase Order
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Orders</p>
          <p className="text-2xl font-bold text-foreground">{loading ? '—' : purchases.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Pending</p>
          <p className="text-2xl font-bold text-yellow-500">{loading ? '—' : pendingCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Value</p>
          <p className="text-2xl font-bold text-foreground">{loading ? '—' : `${totalValue.toLocaleString()} ${sym}`}</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input type="text" placeholder="Search by PO number or supplier..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground placeholder:text-muted-foreground" />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Truck className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold text-foreground mb-1">{searchQuery ? 'No purchase orders found' : 'No purchase orders yet'}</h3>
            <p className="text-sm text-muted-foreground mb-5">{searchQuery ? 'Try a different search' : 'Create your first purchase order to track supplier orders'}</p>
            {!searchQuery && (
              <button type="button" onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
                <Plus className="w-4 h-4" /> New Purchase Order
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((po) => (
              <div key={po.id}>
                <div
                  className="flex items-center gap-4 p-4 hover:bg-muted/30 transition cursor-pointer"
                  onClick={() => setExpandedPO(expandedPO === po.id ? null : po.id)}
                >
                  <span className="font-mono text-sm font-semibold text-foreground min-w-[100px]">{po.po_number}</span>
                  <span className="flex-1 text-sm text-foreground">{po.supplier}</span>
                  <span className="text-sm text-muted-foreground hidden sm:block">{po.items} items</span>
                  <span className="text-sm font-semibold text-foreground hidden sm:block">{po.total.toLocaleString()} {sym}</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[po.status] ?? 'bg-muted text-muted-foreground'}`}>{po.status}</span>
                  <span className="text-xs text-muted-foreground hidden md:block">
                    {new Date(po.date).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedPO === po.id ? 'rotate-180' : ''}`} />
                </div>

                {expandedPO === po.id && po.line_items && (
                  <div className="px-4 pb-4 bg-muted/20">
                    <table className="w-full text-sm mt-2">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="text-left py-2 pr-4">Product</th>
                          <th className="text-center py-2 px-2">Ordered</th>
                          <th className="text-center py-2 px-2">Received</th>
                          <th className="text-right py-2">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {po.line_items.map(item => (
                          <tr key={item.id}>
                            <td className="py-2 pr-4 text-foreground">{item.product_name}</td>
                            <td className="py-2 px-2 text-center text-muted-foreground">{item.quantity_ordered}</td>
                            <td className="py-2 px-2 text-center text-muted-foreground">{item.quantity_received}</td>
                            <td className="py-2 text-right text-foreground">{item.total_cost.toLocaleString()} {sym}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {po.status === 'pending' && (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleMarkReceived(po); }}
                          disabled={receivingPO === po.id}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
                        >
                          {receivingPO === po.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          Mark as Received
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New PO Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">New Purchase Order</h2>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* Supplier */}
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Supplier</label>
                <div className="relative">
                  <select value={poForm.supplier_id} onChange={(e) => setPoForm(prev => ({ ...prev, supplier_id: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none appearance-none">
                    <option value="">Select supplier (optional)</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
                {suppliers.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    No suppliers yet. <Link href="/dashboard/suppliers" className="text-primary hover:underline">Add suppliers first →</Link>
                  </p>
                )}
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-foreground">Items</label>
                  <button type="button" onClick={addPoItem} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add row
                  </button>
                </div>
                <div className="space-y-2">
                  {poItems.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end">
                      {/* Product selector */}
                      <div className="col-span-5">
                        {i === 0 && <p className="text-xs text-muted-foreground mb-1">Product</p>}
                        <div className="relative">
                          <select value={item.product_id} onChange={(e) => updatePoItem(i, 'product_id', e.target.value)}
                            className="w-full px-2 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none appearance-none">
                            <option value="">Custom item</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                      </div>
                      {/* Name (if custom) */}
                      {!item.product_id && (
                        <div className="col-span-3">
                          {i === 0 && <p className="text-xs text-muted-foreground mb-1">Name</p>}
                          <input type="text" value={item.product_name} onChange={(e) => updatePoItem(i, 'product_name', e.target.value)}
                            placeholder="Item name" className="w-full px-2 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
                        </div>
                      )}
                      {/* Qty */}
                      <div className={item.product_id ? 'col-span-2' : 'col-span-2'}>
                        {i === 0 && <p className="text-xs text-muted-foreground mb-1">Qty</p>}
                        <input type="number" min={1} value={item.quantity_ordered} onChange={(e) => updatePoItem(i, 'quantity_ordered', parseInt(e.target.value) || 1)}
                          className="w-full px-2 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
                      </div>
                      {/* Cost */}
                      <div className={item.product_id ? 'col-span-4' : 'col-span-2'}>
                        {i === 0 && <p className="text-xs text-muted-foreground mb-1">Unit Cost ({sym})</p>}
                        <input type="number" min={0} step="0.01" value={item.unit_cost} onChange={(e) => updatePoItem(i, 'unit_cost', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
                      </div>
                      {/* Remove */}
                      <div className="col-span-1 flex justify-end">
                        {poItems.length > 1 && (
                          <button type="button" onClick={() => removePoItem(i)} className="p-2 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-400">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Notes (optional)</label>
                <textarea value={poForm.notes} onChange={(e) => setPoForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Delivery instructions, payment terms..." rows={2}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none resize-none text-sm" />
              </div>

              {/* Total */}
              <div className="bg-muted/50 rounded-lg p-3 flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Order Total</span>
                <span className="text-xl font-bold text-foreground">{poTotal.toLocaleString()} {sym}</span>
              </div>
            </div>
            <div className="p-4 border-t border-border flex gap-3">
              <button type="button" onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={handleCreatePO} disabled={saving}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Purchase Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
