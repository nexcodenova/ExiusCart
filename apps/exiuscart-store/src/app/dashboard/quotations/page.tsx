'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Plus, ClipboardList, Clock, CheckCircle2, FileText,
  X, Trash2, Package, GripVertical, Info, Lock,
} from 'lucide-react';
import { quotationsApi, productsApi, customersApi, subscriptionApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';
import { UsageBanner } from '@/components/usage-banner';

// Only ExiusCart Premium gets advanced. Everyone else (including TheDersi Pro) gets basic.
const isAdvancedPlan = (p: string) => p === 'premium';
const canCreateQuote = (p: string) => p !== 'free_trial' && p !== '';

// ── Types ──────────────────────────────────────────────────────────────────────

type RowType = 'item' | 'section';

interface ItemRow {
  _id: string;
  type: 'item';
  product_id?: number;
  name: string;
  description: string;
  unit: string;
  qty: number;
  unit_price: number;
  total: number;
  is_optional: boolean;
  sku?: string;
  quantity_available?: number;
}

interface SectionRow {
  _id: string;
  type: 'section';
  section_title: string;
}

type QuoteRow = ItemRow | SectionRow;

interface Quotation {
  id: number;
  quote_number: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  items: QuoteRow[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: 'pending' | 'accepted' | 'expired' | 'rejected';
  valid_until: string;
  created_at: string;
  currency: string;
}

interface Product { id: number; name: string; sku?: string; price: number; quantity: number; }
interface Customer { id: number; name: string; phone?: string; email?: string; }

const STATUS_STYLES: Record<string, string> = {
  accepted: 'bg-green-500/10 text-green-600 dark:text-green-400',
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  expired: 'bg-red-500/10 text-red-600 dark:text-red-400',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

const UNITS = ['pcs', 'hrs', 'days', 'months', 'words', 'posts', 'tasks', 'pages', 'kg', 'sessions', 'fixed', 'custom'];

let _rowId = 0;
const uid = () => `r${++_rowId}`;

const blankItem = (): ItemRow => ({
  _id: uid(), type: 'item', name: '', description: '', unit: 'pcs',
  qty: 1, unit_price: 0, total: 0, is_optional: false,
});

// ── Main page ──────────────────────────────────────────────────────────────────

export default function QuotationsPage() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [plan, setPlan] = useState('');
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

  useEffect(() => {
    if (!shopId) return;
    subscriptionApi.getCurrent(shopId)
      .then(r => setPlan(r.data?.plan_type ?? 'free_trial'))
      .catch(() => setPlan('free_trial'));
  }, [shopId]);

  const filtered = quotations.filter((q) =>
    q.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.quote_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quotations</h1>
          <p className="text-muted-foreground text-sm">Create and send professional price quotes to any client</p>
        </div>
        {canCreateQuote(plan) ? (
          <button type="button" onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2.5 rounded-lg font-semibold hover:opacity-90 transition text-sm">
            <Plus className="w-4 h-4" /> New Quotation
          </button>
        ) : plan !== '' && (
          <div className="inline-flex items-center gap-2 bg-muted border border-border px-4 py-2.5 rounded-lg text-sm text-muted-foreground">
            <Lock className="w-4 h-4" />
            Upgrade to ExiusCart Premium to create quotations
          </div>
        )}
      </div>

      {plan === 'free_trial' && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 px-4 py-3 flex items-start gap-3">
          <Lock className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Quotations require ExiusCart Premium</p>
            <p className="text-xs text-indigo-600/80 dark:text-indigo-400/80 mt-0.5">Create unlimited professional quotations, share client links, and more — available on ExiusCart Premium.</p>
          </div>
        </div>
      )}

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
              {searchQuery ? 'Try a different search' : 'Create your first quotation for any client — products, services, freelance work, anything.'}
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
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Client</th>
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
                      <span className="text-sm text-muted-foreground">
                        {q.items.filter((i: any) => i.type !== 'section').length}
                      </span>
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
          plan={plan}
          onClose={() => setShowModal(false)}
          onCreated={(id) => { setShowModal(false); router.push(`/dashboard/quotations/${id}`); }}
        />
      )}
    </div>
  );
}

// ── Advanced Create Modal ──────────────────────────────────────────────────────

function UpgradeLock({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 border border-border rounded-lg px-3 py-2.5">
      <Lock className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
      <span>{message} — <span className="font-semibold text-indigo-500">Upgrade to ExiusCart Premium</span></span>
    </div>
  );
}

function CreateQuotationModal({ shopId, plan, onClose, onCreated }: {
  shopId: string;
  plan: string;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const { sym } = useCurrency();
  const advanced = isAdvancedPlan(plan);

  // Client
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');

  // Rows
  const [rows, setRows] = useState<QuoteRow[]>([blankItem()]);

  // Pricing
  const [discount, setDiscount] = useState(0);
  const [taxType, setTaxType] = useState<'fixed' | 'percent'>('fixed');
  const [taxValue, setTaxValue] = useState(0);

  // Details
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyTrn, setCompanyTrn] = useState('');
  const [companyBank, setCompanyBank] = useState('');

  // Inventory picker
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showInvPicker, setShowInvPicker] = useState(false);

  // Customer picker
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustPicker, setShowCustPicker] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    productsApi.getAll(shopId).then(r => setProducts(r.data?.products ?? r.data ?? [])).catch(() => {});
    customersApi.getAll(shopId).then(r => setCustomers(r.data ?? [])).catch(() => {});
  }, [shopId]);

  // Computed totals
  const subtotal = rows.reduce((s, r) => r.type === 'item' && !r.is_optional ? s + r.total : s, 0);
  const taxAmount = taxType === 'percent' ? subtotal * taxValue / 100 : taxValue;
  const total = subtotal - discount + taxAmount;

  // Row actions
  const addItem = () => setRows(r => [...r, blankItem()]);
  const addSection = () => setRows(r => [...r, { _id: uid(), type: 'section', section_title: '' }]);
  const addFromInventory = (p: Product) => {
    const item: ItemRow = {
      _id: uid(), type: 'item',
      product_id: p.id, name: p.name, description: '', unit: 'pcs',
      qty: 1, unit_price: Number(p.price), total: Number(p.price),
      is_optional: false, sku: p.sku, quantity_available: p.quantity,
    };
    setRows(r => [...r, item]);
    setShowInvPicker(false); setProductSearch('');
  };
  const removeRow = (id: string) => setRows(r => r.filter(x => x._id !== id));

  const updateItem = (id: string, patch: Partial<ItemRow>) => {
    setRows(rows.map(r => {
      if (r._id !== id || r.type !== 'item') return r;
      const updated = { ...r, ...patch };
      updated.total = updated.qty * updated.unit_price;
      return updated;
    }));
  };

  const updateSection = (id: string, title: string) => {
    setRows(rows.map(r => r._id === id && r.type === 'section' ? { ...r, section_title: title } : r));
  };

  const handleSubmit = async () => {
    if (!customerName.trim()) { setError('Client name is required'); return; }
    const itemRows = rows.filter(r => r.type === 'item') as ItemRow[];
    if (itemRows.length === 0) { setError('Add at least one item'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        customer_name: customerName,
        customer_email: customerEmail || undefined,
        customer_phone: customerPhone || undefined,
        customer_company: customerCompany || undefined,
        items: rows.map(({ _id, ...rest }) => rest),
        subtotal,
        discount,
        tax: taxAmount,
        tax_rate: taxValue,
        tax_type: taxType,
        total,
        notes: notes || undefined,
        terms: terms || undefined,
        payment_schedule: undefined,
        company_address: companyAddress || undefined,
        company_trn: companyTrn || undefined,
        company_bank: companyBank || undefined,
        valid_until: validUntil,
      };
      const res = await quotationsApi.create(shopId, payload);
      onCreated(res.data.id);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to create quotation');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.sku ?? '').toLowerCase().includes(productSearch.toLowerCase())
  );
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone ?? '').includes(customerSearch) ||
    (c.email ?? '').toLowerCase().includes(customerSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto py-4 px-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-4xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-foreground">New Quotation</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">

          {/* ── Client ── */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Client</h3>
            <div className="relative mb-3">
              <input type="text" placeholder="Search existing clients..."
                value={customerSearch}
                onFocus={() => setShowCustPicker(true)}
                onChange={(e) => { setCustomerSearch(e.target.value); setShowCustPicker(true); }}
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-sm outline-none text-foreground placeholder:text-muted-foreground" />
              {showCustPicker && filteredCustomers.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-xl shadow-lg z-20 max-h-40 overflow-y-auto">
                  {filteredCustomers.slice(0, 6).map(c => (
                    <button key={c.id} type="button"
                      onClick={() => {
                        setCustomerName(c.name); setCustomerPhone(c.phone ?? '');
                        setCustomerEmail(c.email ?? ''); setShowCustPicker(false); setCustomerSearch('');
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-muted transition text-sm">
                      <span className="font-medium text-foreground">{c.name}</span>
                      {c.phone && <span className="text-muted-foreground ml-2 text-xs">{c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Full Name *', value: customerName, set: setCustomerName, type: 'text' },
                { label: 'Company', value: customerCompany, set: setCustomerCompany, type: 'text' },
                { label: 'Email', value: customerEmail, set: setCustomerEmail, type: 'email' },
                { label: 'Phone', value: customerPhone, set: setCustomerPhone, type: 'tel' },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs text-muted-foreground mb-1">{f.label}</label>
                  <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/10 text-foreground" />
                </div>
              ))}
            </div>
          </section>

          {/* ── Line Items ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Line Items</h3>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowInvPicker(v => !v)}
                  className="inline-flex items-center gap-1.5 text-xs border border-border text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg transition">
                  <Package className="w-3.5 h-3.5" /> From Inventory
                </button>
                {advanced ? (
                  <button type="button" onClick={addSection}
                    className="inline-flex items-center gap-1.5 text-xs border border-border text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg transition">
                    + Section
                  </button>
                ) : (
                  <span title="Upgrade to ExiusCart Premium"
                    className="inline-flex items-center gap-1.5 text-xs border border-border/50 text-muted-foreground/40 px-3 py-1.5 rounded-lg cursor-not-allowed select-none">
                    <Lock className="w-3 h-3" /> Section
                  </span>
                )}
                <button type="button" onClick={addItem}
                  className="inline-flex items-center gap-1.5 text-xs bg-foreground text-background px-3 py-1.5 rounded-lg transition hover:opacity-90">
                  + Add Item
                </button>
              </div>
            </div>

            {/* Inventory picker */}
            {showInvPicker && (
              <div className="mb-3 border border-border rounded-xl overflow-hidden">
                <div className="p-2 border-b border-border">
                  <input type="text" placeholder="Search inventory..." value={productSearch} autoFocus
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full px-3 py-2 bg-muted rounded-lg text-sm outline-none text-foreground placeholder:text-muted-foreground" />
                </div>
                <div className="max-h-44 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No products found</p>
                  ) : filteredProducts.slice(0, 10).map(p => (
                    <button key={p.id} type="button" onClick={() => addFromInventory(p)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted transition border-b border-border/50 last:border-0">
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">{p.name}</p>
                        {p.sku && <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>}
                      </div>
                      <span className="text-sm font-semibold text-foreground">{Number(p.price).toLocaleString()} {sym}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Rows */}
            <div className="space-y-2">
              {rows.map((row) =>
                row.type === 'section' ? (
                  <div key={row._id} className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-muted/60 border border-border rounded-xl px-3 py-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground w-16">Section</span>
                      <input type="text" placeholder="Section title e.g. Design, Development..."
                        value={row.section_title}
                        onChange={e => updateSection(row._id, e.target.value)}
                        className="flex-1 bg-transparent outline-none text-sm font-semibold text-foreground placeholder:text-muted-foreground" />
                    </div>
                    <button type="button" onClick={() => removeRow(row._id)} className="text-muted-foreground hover:text-red-500 transition p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div key={row._id} className="border border-border rounded-xl p-3 space-y-2 bg-card">
                    <div className="flex gap-2">
                      {/* Name */}
                      <div className="flex-1">
                        <input type="text" placeholder="Item name / service *"
                          value={row.name}
                          onChange={e => updateItem(row._id, { name: e.target.value })}
                          className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/10 text-foreground placeholder:text-muted-foreground font-medium" />
                      </div>
                      {/* Unit */}
                      {advanced ? (
                        <div className="w-28">
                          <select value={row.unit} onChange={e => updateItem(row._id, { unit: e.target.value })}
                            className="w-full px-2 py-2 bg-muted border border-border rounded-lg text-sm outline-none text-foreground">
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div className="w-20 flex items-center px-2">
                          <span className="text-xs text-muted-foreground/60">pcs</span>
                        </div>
                      )}
                      {/* Qty */}
                      <div className="w-20">
                        <input type="number" min={0} step={0.5} placeholder="Qty"
                          value={row.qty}
                          onChange={e => updateItem(row._id, { qty: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-2 bg-muted border border-border rounded-lg text-sm outline-none text-center text-foreground" />
                      </div>
                      {/* Price */}
                      <div className="w-28">
                        <input type="number" min={0} step={0.01} placeholder="Price"
                          value={row.unit_price}
                          onChange={e => updateItem(row._id, { unit_price: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-2 bg-muted border border-border rounded-lg text-sm outline-none text-right text-foreground" />
                      </div>
                      {/* Total */}
                      <div className="w-28 flex items-center justify-end">
                        <span className="text-sm font-bold text-foreground tabular-nums">
                          {row.total.toLocaleString()} {sym}
                        </span>
                      </div>
                      {/* Delete */}
                      <button type="button" onClick={() => removeRow(row._id)}
                        className="text-muted-foreground hover:text-red-500 transition flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Description — advanced only */}
                    {advanced && (
                      <input type="text" placeholder="Description (optional) — e.g. Includes 3 revisions, delivered in 5 days"
                        value={row.description}
                        onChange={e => updateItem(row._id, { description: e.target.value })}
                        className="w-full px-3 py-1.5 bg-transparent text-xs text-muted-foreground outline-none placeholder:text-muted-foreground/50 border-t border-border/50 pt-2" />
                    )}
                    {/* Optional toggle — advanced only */}
                    {advanced && (
                      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                          <input type="checkbox" checked={row.is_optional}
                            onChange={e => updateItem(row._id, { is_optional: e.target.checked })}
                            className="rounded" />
                          Mark as optional add-on (excluded from total)
                        </label>
                        {row.is_optional && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">Optional</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>

            {rows.length === 0 && (
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">No items yet — add items or sections above</p>
              </div>
            )}
          </section>

          {/* ── Pricing ── */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Pricing</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Discount ({sym})</label>
                <input type="number" min={0} step={0.01} value={discount}
                  onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/10 text-foreground" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Tax</label>
                <div className="flex gap-2">
                  <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                    {(['fixed', 'percent'] as const).map(t => (
                      <button key={t} type="button" onClick={() => setTaxType(t)}
                        className={`px-3 py-2 font-medium transition ${taxType === t ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                        {t === 'fixed' ? `${sym} Fixed` : '% VAT'}
                      </button>
                    ))}
                  </div>
                  <input type="number" min={0} step={0.01} value={taxValue}
                    onChange={e => setTaxValue(parseFloat(e.target.value) || 0)}
                    placeholder={taxType === 'percent' ? 'e.g. 5' : '0.00'}
                    className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/10 text-foreground" />
                </div>
              </div>
            </div>
            {/* Totals summary */}
            <div className="bg-muted/40 rounded-xl p-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span>{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {sym}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Discount</span><span>-{discount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {sym}</span>
                </div>
              )}
              {taxValue > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax{taxType === 'percent' ? ` (${taxValue}%)` : ''}</span>
                  <span>+{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {sym}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-foreground text-base border-t border-border pt-2 mt-1">
                <span>Total</span>
                <span className="text-indigo-500">{total.toLocaleString(undefined, { minimumFractionDigits: 2 })} {sym}</span>
              </div>
            </div>
          </section>

          {/* ── Details ── */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Details</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Valid Until *</label>
                <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                  className="w-full sm:w-48 px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/10 text-foreground" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Notes (shown on PDF)</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Prices are valid for 14 days from issue date"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/10 text-foreground placeholder:text-muted-foreground" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Terms & Conditions</label>
                {advanced ? (
                  <textarea rows={3} value={terms} onChange={e => setTerms(e.target.value)}
                    placeholder="e.g. 50% deposit required to begin. All work is subject to our standard T&C. Revisions: 2 rounds included."
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/10 text-foreground placeholder:text-muted-foreground resize-none" />
                ) : (
                  <UpgradeLock message="Terms & Conditions on PDF" />
                )}
              </div>
            </div>
          </section>

          {/* ── Company Info ── */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Company Info on PDF</h3>
            {advanced ? (
              <>
                <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Optional — appears below your shop name on the PDF
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Address</label>
                    <textarea rows={2} value={companyAddress} onChange={e => setCompanyAddress(e.target.value)}
                      placeholder="e.g. NexCode Nova LLC, Business Bay, Dubai, UAE"
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/10 text-foreground placeholder:text-muted-foreground resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">TRN / VAT Number</label>
                      <input type="text" value={companyTrn} onChange={e => setCompanyTrn(e.target.value)}
                        placeholder="e.g. 100123456789003"
                        className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/10 text-foreground placeholder:text-muted-foreground" />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Bank / Payment Details</label>
                      <input type="text" value={companyBank} onChange={e => setCompanyBank(e.target.value)}
                        placeholder="e.g. Emirates NBD IBAN: AE070331234567890123456"
                        className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/10 text-foreground placeholder:text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <UpgradeLock message="Address, TRN/VAT, bank details on PDF" />
            )}
          </section>

          {error && (
            <p className="text-sm text-red-500 bg-red-500/10 px-4 py-2.5 rounded-lg">{error}</p>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-border sticky bottom-0 bg-card rounded-b-2xl">
          <button type="button" onClick={onClose}
            className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition">
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
