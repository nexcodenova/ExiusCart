'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, LayoutGrid, Edit, Trash2, X, Loader2, ArrowUp, ArrowDown, ImageIcon,
} from 'lucide-react';
import { channelsApi } from '@/lib/api';

interface StorefrontCategory {
  id: number;
  channel_type: string;
  name: string;
  slug: string;
  icon_url: string | null;
  sort_order: number;
}

// Only channels with no category system of their own — TheDersi/Daraz/
// Noon/eBay already have their own real category trees, this is purely
// for the two channels that had nothing at all.
const CHANNEL_OPTIONS = [
  { value: 'custom', label: 'Custom Website' },
  { value: 'shopify', label: 'Shopify' },
] as const;

const EMPTY_FORM = { name: '', icon_url: '', sort_order: 0 };

export default function StorefrontCategoriesPage() {
  const [channelType, setChannelType] = useState<string>('custom');
  const [categories, setCategories] = useState<StorefrontCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StorefrontCategory | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);

  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  const fetchCategories = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const res = await channelsApi.listStorefrontCategories(shopId, channelType);
      setCategories(res.data ?? []);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [shopId, channelType]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, sort_order: categories.length });
    setShowModal(true);
  };
  const openEdit = (c: StorefrontCategory) => {
    setEditing(c);
    setForm({ name: c.name, icon_url: c.icon_url || '', sort_order: c.sort_order });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = { channel_type: channelType, name: form.name, icon_url: form.icon_url || undefined, sort_order: form.sort_order };
      if (editing) {
        await channelsApi.updateStorefrontCategory(shopId, editing.id, payload);
      } else {
        await channelsApi.createStorefrontCategory(shopId, payload);
      }
      setShowModal(false);
      fetchCategories();
    } catch {/* no-op */} finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      await channelsApi.deleteStorefrontCategory(shopId, id);
      setCategories(prev => prev.filter(c => c.id !== id));
    } catch {/* no-op */}
    setDeleteId(null);
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    setReordering(true);
    const a = categories[index];
    const b = categories[target];
    try {
      await Promise.all([
        channelsApi.updateStorefrontCategory(shopId, a.id, { channel_type: channelType, name: a.name, icon_url: a.icon_url || undefined, sort_order: b.sort_order }),
        channelsApi.updateStorefrontCategory(shopId, b.id, { channel_type: channelType, name: b.name, icon_url: b.icon_url || undefined, sort_order: a.sort_order }),
      ]);
      await fetchCategories();
    } catch {/* no-op */} finally { setReordering(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Storefront Categories</h1>
          <p className="text-muted-foreground text-sm">
            The category list shoppers see — powers your storefront's category grid and navigation live.
          </p>
        </div>
        <button type="button" onClick={openAdd}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition">
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border p-4">
        <label className="text-sm text-muted-foreground mb-1.5 block">Channel</label>
        <select value={channelType} onChange={(e) => setChannelType(e.target.value)}
          className="w-full sm:w-64 px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none">
          {CHANNEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="text-xs text-muted-foreground mt-1.5">
          TheDersi, Daraz, Noon and eBay already have their own category systems on their side — this list is only for channels with none.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-card rounded-xl border border-border animate-pulse" />)}</div>
      ) : categories.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-16 text-center">
          <LayoutGrid className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="font-semibold text-foreground mb-1">No categories yet</h3>
          <p className="text-sm text-muted-foreground mb-5">
            Add categories for {CHANNEL_OPTIONS.find(o => o.value === channelType)?.label} — they'll show up on your storefront immediately.
          </p>
          <button type="button" onClick={openAdd}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
            <Plus className="w-4 h-4" /> Add Category
          </button>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {categories.map((c, i) => (
            <div key={c.id} className="flex items-center gap-4 p-4 group">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                {c.icon_url
                  ? <img src={c.icon_url} alt="" className="w-full h-full object-cover" />
                  : <ImageIcon className="w-4 h-4 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground/60 font-mono truncate">{c.slug}</p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || reordering}
                  className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition disabled:opacity-30 disabled:cursor-not-allowed">
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === categories.length - 1 || reordering}
                  className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition disabled:opacity-30 disabled:cursor-not-allowed">
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => openEdit(c)}
                  className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
                  <Edit className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setDeleteId(c.id)}
                  className="p-1.5 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-400 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-md">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{editing ? 'Edit Category' : 'Add Category'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Category Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., Fragrances" autoFocus
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Icon/Image URL</label>
                <input type="text" value={form.icon_url} onChange={(e) => setForm(p => ({ ...p, icon_url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none" />
                <p className="text-xs text-muted-foreground mt-1">Optional — shown on the category grid on your storefront.</p>
              </div>
            </div>
            <div className="p-4 border-t border-border flex gap-3">
              <button type="button" onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.name.trim()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing ? 'Save Changes' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-foreground mb-2">Remove Category?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              It'll disappear from your storefront immediately. Products already in it stay as they are.
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
