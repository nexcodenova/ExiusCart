'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Plus, ClipboardList, Clock, CheckCircle2, FileText,
  X, Trash2, Package, ChevronDown,
} from 'lucide-react';
import { quotationsApi, productsApi, customersApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';
import { UsageBanner } from '@/components/usage-banner';

interface QuotationItem {
  product_id?: number;
  name: string;
  sku?: string;
  quantity_available?: number;
  qty: number;
  unit_price: number;
  total: number;
}

interface Quotation {
  id: number;
  quote_number: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  items: QuotationItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: 'pending' | 'accepted' | 'expired' | 'rejected';
  valid_until: string;
  created_at: string;
  currency: string;
}

interface Product {
  id: number;
  name: string;
  sku?: string;
  price: number;
  quantity: number;
}

interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
}

const STATUS_STYLES: Record<string, string> = {
  accepted: 'bg-green-500/10 text-green-600 dark:text-green-400',
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  expired: 'bg-red-500/10 text-red-600 dark:text-red-400',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export default function QuotationsPage() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const { sym } = useCurrency();

  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  const load = useCallback(() => {
    if (!shopId) return;
    setLoading(true);
    quotationsApi.getAll(shopId)
      .then((res) => setQuotations(res.data ?? []))
      .catch(() => setQuotations([]))
      .finally(() => setLoading(false));
  }, [shopId]);

  useEffect(() => { load(); }, [load]);

  const filtered = quotations.filter((q) =>
    q.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.quote_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quotations</h1>
          <p className="text-muted-foreground text-sm">Create and manage price quotes for customers</p>
        </div>
        <button type="button" onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2.5 rounded-lg font-semibold hover:opacity-90 transition text-sm">
          <Plus className="w-4 h-4" /> New Quotation
        </button>
      </div>

      <UsageBanner shopId={shopId} show={['quotation_emails']} />

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total quotes', icon: FileText, value: quotations.length, color: '' },
          { label: 'Pending', icon: Clock, value: quotations.filter(q => q.status === 'pending').length, color: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Accepted', icon: CheckCircle2, value: quotations.filter(q => q.status === 'accepted').length, color: 'text-green-600 dark:text-green-400' },
        ].map(({ label, icon: Icon, value, color }) => (
          <div key={label} className="bg-card rounded-2xl border border-border p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <Icon className="h-5 w-5 text-foreground/70" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{label}</p>
            <p className={`mt-0.5 text-2xl font-bold tracking-tight tabular-nums ${color || 'text-foreground'}`}>
              {loading ? '—' : value}
            </p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Search by customer or quote number..."
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-2.5 bg-card border border-border rounded-xl focus:ring-2 focus:ring-foreground/10 outline-none text-foreground placeholder:text-muted-foreground" />
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <ClipboardList className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold text-foreground mb-1">
              {searchQuery ? 'No quotations found' : 'No quotations yet'}
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              {searchQuery ? 'Try a different search' : 'Create your first quotation to send price quotes to customers'}
            </p>
            {!searchQuery && (
              <button type="button" onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition">
                <Plus className="w-4 h-4" /> New Quotation
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Quote #</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Customer</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Items</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Total</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Valid Until</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((q) => (
                  <tr key={q.id}
                    className="hover:bg-muted/30 transition cursor-pointer"
                    onClick={() => router.push(`/dashboard/quotations/${q.id}`)}>
                    <td className="p-4"><span className="font-mono text-sm text-foreground">{q.quote_number}</span></td>
                    <td className="p-4">
                      <p className="text-sm font-medium text-foreground">{q.customer_name}</p>
                      {q.customer_phone && <p className="text-xs text-muted-foreground">{q.customer_phone}</p>}
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-sm text-muted-foreground">{q.items.length}</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-sm font-semibold text-foreground">
                        {q.total.toLocaleString()} {sym}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-sm text-muted-foreground">{q.valid_until}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[q.status] ?? 'bg-muted text-muted-foreground'}`}>
                        {q.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <CreateQuotationModal
          shopId={shopId}
          onClose={() => setShowModal(false)}
          onCreated={(id) => {
            setShowModal(false);
            router.push(`/dashboard/quotations/${id}`);
          }}
        />
      )}
    </div>
  );
}

// ── Create Quotation Modal ─────────────────────────────────────────────────────

function CreateQuotationModal({
  shopId,
  onClose,
  onCreated,
}: {
  shopId: string;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const { sym } = useCurrency();

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [notes, setNotes] = useState('');
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    productsApi.getAll(shopId).then(r => setProducts(r.data?.products ?? r.data ?? [])).catch(() => {});
    customersApi.getAll(shopId).then(r => setCustomers(r.data ?? [])).catch(() => {});
  }, [shopId]);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.sku ?? '').toLowerCase().includes(productSearch.toLowerCase())
  );

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone ?? '').includes(customerSearch) ||
    (c.email ?? '').toLowerCase().includes(customerSearch.toLowerCase())
  );

  const addProduct = (p: Product) => {
    const exists = items.find(i => i.product_id === p.id);
    if (exists) {
      setItems(items.map(i =>
        i.product_id === p.id
          ? { ...i, qty: i.qty + 1, total: (i.qty + 1) * i.unit_price }
          : i
      ));
    } else {
      setItems([...items, {
        product_id: p.id,
        name: p.name,
        sku: p.sku,
        quantity_available: p.quantity,
        qty: 1,
        unit_price: p.price,
        total: p.price,
      }]);
    }
    setShowProductPicker(false);
    setProductSearch('');
  };

  const updateQty = (idx: number, qty: number) => {
    if (qty < 1) return;
    setItems(items.map((it, i) => i === idx ? { ...it, qty, total: qty * it.unit_price } : it));
  };

  const updatePrice = (idx: number, price: number) => {
    setItems(items.map((it, i) => i === idx ? { ...it, unit_price: price, total: it.qty * price } : it));
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const total = subtotal - discount + tax;

  const handleSubmit = async () => {
    if (!customerName.trim()) { setError('Customer name is required'); return; }
    if (items.length === 0) { setError('Add at least one product'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await quotationsApi.create(shopId, {
        customer_name: customerName,
        customer_email: customerEmail || undefined,
        customer_phone: customerPhone || undefined,
        items,
        subtotal,
        discount,
        tax,
        total,
        notes: notes || undefined,
        valid_until: validUntil,
      });
      onCreated(res.data.id);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to create quotation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto py-6">
      <div className="bg-card rounded-2xl border border-border w-full max-w-2xl mx-4 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">New Quotation</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Customer */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Customer</label>
            <div className="relative mb-2">
              <input type="text" placeholder="Search existing customers..."
                value={customerSearch}
                onFocus={() => setShowCustomerPicker(true)}
                onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerPicker(true); }}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/10 text-foreground placeholder:text-muted-foreground" />
              {showCustomerPicker && filteredCustomers.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-xl shadow-lg z-10 max-h-40 overflow-y-auto">
                  {filteredCustomers.slice(0, 6).map(c => (
                    <button key={c.id} type="button"
                      onClick={() => {
                        setCustomerName(c.name);
                        setCustomerPhone(c.phone ?? '');
                        setCustomerEmail(c.email ?? '');
                        setShowCustomerPicker(false);
                        setCustomerSearch('');
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-muted transition text-sm">
                      <span className="font-medium text-foreground">{c.name}</span>
                      {c.phone && <span className="text-muted-foreground ml-2 text-xs">{c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input type="text" placeholder="Full name *" value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/10 text-foreground placeholder:text-muted-foreground" />
              <input type="email" placeholder="Email (optional)" value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/10 text-foreground placeholder:text-muted-foreground" />
              <input type="tel" placeholder="Phone (optional)" value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/10 text-foreground placeholder:text-muted-foreground" />
            </div>
          </div>

          {/* Products */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-foreground">Products</label>
              <button type="button" onClick={() => setShowProductPicker(!showProductPicker)}
                className="inline-flex items-center gap-1.5 text-xs bg-muted hover:bg-muted/70 border border-border text-foreground px-3 py-1.5 rounded-lg transition">
                <Package className="w-3.5 h-3.5" /> Add Product
              </button>
            </div>

            {showProductPicker && (
              <div className="mb-3 border border-border rounded-xl overflow-hidden">
                <div className="p-2 border-b border-border">
                  <input type="text" placeholder="Search products..." value={productSearch}
                    autoFocus
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full px-3 py-2 bg-muted rounded-lg text-sm outline-none text-foreground placeholder:text-muted-foreground" />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No products found</p>
                  ) : filteredProducts.slice(0, 10).map(p => (
                    <button key={p.id} type="button" onClick={() => addProduct(p)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted transition border-b border-border/50 last:border-0">
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">{p.name}</p>
                        {p.sku && <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>}
                        <p className={`text-xs ${p.quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                          Stock: {p.quantity}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{p.price.toLocaleString()} {sym}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {items.length === 0 ? (
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">No products added yet</p>
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Product</th>
                      <th className="text-center p-3 text-xs font-medium text-muted-foreground">Stock</th>
                      <th className="text-center p-3 text-xs font-medium text-muted-foreground">Qty</th>
                      <th className="text-right p-3 text-xs font-medium text-muted-foreground">Price</th>
                      <th className="text-right p-3 text-xs font-medium text-muted-foreground">Total</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-3">
                          <p className="font-medium text-foreground">{item.name}</p>
                          {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-xs font-medium ${(item.quantity_available ?? 0) > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                            {item.quantity_available ?? '—'}
                          </span>
                        </td>
                        <td className="p-3">
                          <input type="number" min={1} value={item.qty}
                            onChange={(e) => updateQty(idx, parseInt(e.target.value) || 1)}
                            className="w-16 text-center px-2 py-1 bg-muted border border-border rounded-lg text-sm outline-none text-foreground" />
                        </td>
                        <td className="p-3">
                          <input type="number" min={0} step={0.01} value={item.unit_price}
                            onChange={(e) => updatePrice(idx, parseFloat(e.target.value) || 0)}
                            className="w-24 text-right px-2 py-1 bg-muted border border-border rounded-lg text-sm outline-none text-foreground" />
                        </td>
                        <td className="p-3 text-right font-semibold text-foreground">
                          {item.total.toLocaleString()} {sym}
                        </td>
                        <td className="p-3">
                          <button type="button" onClick={() => removeItem(idx)}
                            className="text-muted-foreground hover:text-red-500 transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Totals row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Discount ({sym})</label>
              <input type="number" min={0} step={0.01} value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/10 text-foreground" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Tax ({sym})</label>
              <input type="number" min={0} step={0.01} value={tax}
                onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/10 text-foreground" />
            </div>
          </div>

          {/* Total display */}
          {items.length > 0 && (
            <div className="bg-muted/50 rounded-xl p-4 space-y-1.5">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span><span>{subtotal.toLocaleString()} {sym}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-red-500">
                  <span>Discount</span><span>-{discount.toLocaleString()} {sym}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Tax</span><span>+{tax.toLocaleString()} {sym}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border">
                <span>Total</span><span>{total.toLocaleString()} {sym}</span>
              </div>
            </div>
          )}

          {/* Valid Until + Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Valid Until *</label>
              <input type="date" value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/10 text-foreground" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Notes (optional)</label>
              <input type="text" placeholder="e.g. Prices valid for 7 days" value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/10 text-foreground placeholder:text-muted-foreground" />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-500/10 px-4 py-2.5 rounded-lg">{error}</p>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-border">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg text-sm font-semibold hover:opacity-90 transition disabled:opacity-50">
            {saving ? 'Creating...' : 'Create Quotation'}
          </button>
        </div>
      </div>
    </div>
  );
}
