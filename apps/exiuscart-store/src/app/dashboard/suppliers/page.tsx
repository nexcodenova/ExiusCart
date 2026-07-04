'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, Truck, Edit, Trash2, X, Loader2,
  Phone, Mail, MapPin, User, MessageCircle, Lock, Crown, Package, Star,
  ShoppingBag,
} from 'lucide-react';
import { suppliersApi, subscriptionApi } from '@/lib/api';

// ── Edit this list to add / remove TheDersi wholesale suppliers ───────────────
const THEDERSI_WHOLESALE = [
  {
    id: 'ws-1',
    name: 'Colombo Fabric House',
    category: 'Fabrics & Textiles',
    description: 'Premium cotton, silk, and synthetic fabrics. Minimum order 10 meters.',
    location: 'Colombo 10',
    whatsapp: '94771234567',
    badge: '',
  },
  {
    id: 'ws-2',
    name: 'Pettah Garments Wholesale',
    category: 'Ready-made Clothing',
    description: 'Bulk ready-made garments — men\'s, women\'s, and kids. MOQ 50 pieces per design.',
    location: 'Pettah, Colombo',
    whatsapp: '94777654321',
    badge: 'Popular',
  },
  {
    id: 'ws-3',
    name: 'Lanka Accessories Hub',
    category: 'Fashion Accessories',
    description: 'Bags, belts, jewellery, and hair accessories. Low MOQ for TheDersi sellers.',
    location: 'Nugegoda',
    whatsapp: '94779876543',
    badge: '',
  },
  {
    id: 'ws-4',
    name: 'Textile Direct SL',
    category: 'Fabrics & Textiles',
    description: 'Imported lace, chiffon, and embroidered materials at wholesale prices.',
    location: 'Maradana, Colombo',
    whatsapp: '947123456789',
    badge: 'New',
  },
  {
    id: 'ws-5',
    name: 'Fashion Forward Wholesale',
    category: 'Ready-made Clothing',
    description: 'Trendy women\'s fashion. New designs weekly. TheDersi exclusive pricing.',
    location: 'Kandy',
    whatsapp: '94768765432',
    badge: '',
  },
  {
    id: 'ws-6',
    name: 'SL Footwear Hub',
    category: 'Footwear',
    description: 'Sandals, heels, sneakers, and flats. All sizes. MOQ 12 pairs per style.',
    location: 'Dehiwala',
    whatsapp: '94752345678',
    badge: '',
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  'Fabrics & Textiles':   'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  'Ready-made Clothing':  'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  'Fashion Accessories':  'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'Footwear':             'bg-blue-500/10 text-blue-600 dark:text-blue-400',
};

// ── Private supplier type ─────────────────────────────────────────────────────
interface Supplier {
  id: number;
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

const EMPTY_FORM = { name: '', contact_name: '', phone: '', email: '', address: '', notes: '' };

export default function SuppliersPage() {
  const [suppliers, setSuppliers]       = useState<Supplier[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [deleteId, setDeleteId]         = useState<number | null>(null);
  const [planType, setPlanType]         = useState('');

  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  useEffect(() => {
    if (!shopId) return;
    subscriptionApi.getCurrent(shopId)
      .then((r) => setPlanType(r.data?.plan?.plan_type || ''))
      .catch(() => {});
  }, [shopId]);

  const isTheDersiPro   = planType === 'thedersi_pro';
  const isTheDersiBasic = planType === 'thedersi_basic';
  const isTheDersiUser  = isTheDersiPro || isTheDersiBasic;

  const fetchSuppliers = useCallback(async () => {
    if (!shopId) return;
    try {
      const res = await suppliersApi.getAll(shopId, { search: search || undefined });
      setSuppliers(res.data ?? []);
    } catch {
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [shopId, search]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const openAdd  = () => { setEditingSupplier(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setForm({ name: s.name, contact_name: s.contact_name || '', phone: s.phone || '', email: s.email || '', address: s.address || '', notes: s.notes || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingSupplier) {
        await suppliersApi.update(shopId, editingSupplier.id, form);
      } else {
        await suppliersApi.create(shopId, form);
      }
      setShowModal(false);
      fetchSuppliers();
    } catch {/* no-op */} finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      await suppliersApi.delete(shopId, id);
      setSuppliers(prev => prev.filter(s => s.id !== id));
    } catch {/* no-op */}
    setDeleteId(null);
  };

  const f = (key: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="space-y-8">

      {/* ── TheDersi Wholesale — Pro access ────────────────────────────────── */}
      {isTheDersiPro && (
        <div className="space-y-4">
          {/* Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-[1px]">
            <div className="relative rounded-2xl bg-gradient-to-br from-indigo-950/90 via-purple-950/90 to-pink-950/90 px-6 py-5 overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 relative">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 shrink-0">
                    <ShoppingBag className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white">TheDersi Wholesale Network</p>
                      <span className="text-xs bg-green-400/20 text-green-300 border border-green-400/30 px-2 py-0.5 rounded-full">Connected</span>
                    </div>
                    <p className="text-xs text-indigo-200 mt-0.5">
                      Exclusive wholesale suppliers for TheDersi Pro sellers — tap WhatsApp to order
                    </p>
                  </div>
                </div>
                <div className="sm:ml-auto shrink-0">
                  <span className="text-xs bg-white/10 text-white border border-white/20 px-3 py-1.5 rounded-full font-medium">
                    {THEDERSI_WHOLESALE.length} Suppliers
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Supplier cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {THEDERSI_WHOLESALE.map((ws) => {
              const catColor = CATEGORY_COLORS[ws.category] ?? 'bg-muted text-muted-foreground';
              const waMsg = encodeURIComponent(
                `Hi, I'm a TheDersi Pro seller on ExiusCart. I'd like to inquire about wholesale pricing from ${ws.name}.`
              );
              return (
                <div key={ws.id} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 hover:border-primary/40 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {ws.badge === 'Popular' && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                          <Star className="w-3 h-3" /> Popular
                        </span>
                      )}
                      {ws.badge === 'New' && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-500/10 text-green-600 dark:text-green-400">
                          New
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>
                        {ws.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{ws.name}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{ws.description}</p>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {ws.location}
                  </div>

                  <a
                    href={`https://wa.me/${ws.whatsapp}?text=${waMsg}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 flex items-center justify-center gap-2 bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/30 rounded-lg text-sm font-medium hover:bg-[#25D366]/20 transition"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TheDersi Wholesale — Basic locked ──────────────────────────────── */}
      {isTheDersiBasic && (
        <div className="rounded-2xl border border-border bg-card p-6 flex flex-col sm:flex-row items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="font-semibold text-foreground">TheDersi Wholesale Network</p>
            <p className="text-sm text-muted-foreground mt-1">
              Access exclusive wholesale suppliers and order directly via WhatsApp. Available for TheDersi Pro sellers.
            </p>
          </div>
          <a
            href="https://thedersi.lk/seller/upgrade?plan=pro&ref=exiuscart"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition"
          >
            <Crown className="w-4 h-4" />
            Upgrade to Pro
          </a>
        </div>
      )}

      {/* ── My Suppliers (all users) ────────────────────────────────────────── */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isTheDersiUser ? 'My Suppliers' : 'Suppliers'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isTheDersiUser ? 'Your private supplier contacts' : 'Manage your product suppliers'}
            </p>
          </div>
          <button type="button" onClick={openAdd}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition">
            <Plus className="w-4 h-4" /> Add Supplier
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Suppliers</p>
            <p className="text-2xl font-bold text-foreground">{loading ? '—' : suppliers.length}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground mb-1">Active</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{loading ? '—' : suppliers.length}</p>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input type="text" placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground placeholder:text-muted-foreground" />
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-card rounded-xl border border-border animate-pulse" />)}</div>
        ) : suppliers.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-16 text-center">
            <Truck className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold text-foreground mb-1">{search ? 'No suppliers found' : 'No suppliers yet'}</h3>
            <p className="text-sm text-muted-foreground mb-5">
              {search ? 'Try a different search term' : 'Add your first supplier to start tracking purchase orders'}
            </p>
            {!search && (
              <button type="button" onClick={openAdd}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
                <Plus className="w-4 h-4" /> Add Supplier
              </button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((s) => (
              <div key={s.id} className="bg-card rounded-xl border border-border p-5 hover:border-primary/50 transition group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Truck className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button type="button" onClick={() => openEdit(s)}
                      className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => setDeleteId(s.id)}
                      className="p-1.5 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-400 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-foreground mb-2">{s.name}</h3>
                <div className="space-y-1.5">
                  {s.contact_name && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{s.contact_name}</span>
                    </div>
                  )}
                  {s.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" /><span>{s.phone}</span>
                    </div>
                  )}
                  {s.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{s.email}</span>
                    </div>
                  )}
                  {s.address && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{s.address}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
              </h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {([
                { key: 'name',         label: 'Supplier Name *',  placeholder: 'e.g., Tech Supply Co.' },
                { key: 'contact_name', label: 'Contact Person',   placeholder: 'Name of your contact' },
                { key: 'phone',        label: 'Phone',            placeholder: '+XX XX XXX XXXX' },
                { key: 'email',        label: 'Email',            placeholder: 'supplier@example.com' },
                { key: 'address',      label: 'Address',          placeholder: 'Business address' },
              ] as const).map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-sm text-muted-foreground mb-1 block">{label}</label>
                  <input type="text" value={form[key]} onChange={f(key)} placeholder={placeholder}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none" />
                </div>
              ))}
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={f('notes')} placeholder="Payment terms, lead times, etc." rows={3}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none resize-none" />
              </div>
            </div>
            <div className="p-4 border-t border-border flex gap-3">
              <button type="button" onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.name.trim()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingSupplier ? 'Save Changes' : 'Add Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-foreground mb-2">Remove Supplier?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              The supplier will be removed from your list. Existing purchase orders won&apos;t be affected.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteId(null)}
                className="flex-1 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={() => handleDelete(deleteId)}
                className="flex-1 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
