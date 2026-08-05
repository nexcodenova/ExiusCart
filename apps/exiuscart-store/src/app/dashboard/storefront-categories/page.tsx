'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, LayoutGrid, Edit, Trash2, X, Loader2, ArrowUp, ArrowDown,
  ImageIcon, Upload, Link2, CornerDownRight, AlertCircle,
} from 'lucide-react';
import { channelsApi } from '@/lib/api';

interface StorefrontCategory {
  id: number;
  channel_type: string;
  name: string;
  slug: string;
  icon_url: string | null;
  sort_order: number;
  parent_id: number | null;
}

// Only channels with no category system of their own — TheDersi/Daraz/
// Noon/eBay already have their own real category trees on their side,
// this screen is purely for the two channels that had nothing at all.
const CHANNEL_OPTIONS = [
  { value: 'custom', label: 'Custom Website' },
  { value: 'shopify', label: 'Shopify' },
] as const;

type Level = 'main' | 'sub' | 'subsub';

const EMPTY_FORM = { name: '', icon_url: '', level: 'main' as Level, mainId: '', subId: '' };

function siblingsOf(list: StorefrontCategory[], parentId: number | null) {
  return list.filter(c => c.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order);
}

// Walk a category's own parent chain to figure out which level it's
// actually at (Main / Sub / Sub-sub) — needed when opening Edit, since we
// only store parent_id, not the level itself.
function levelOf(cat: StorefrontCategory, list: StorefrontCategory[]): { level: Level; mainId: string; subId: string } {
  if (cat.parent_id === null) return { level: 'main', mainId: '', subId: '' };
  const parent = list.find(c => c.id === cat.parent_id);
  if (!parent || parent.parent_id === null) {
    return { level: 'sub', mainId: String(cat.parent_id), subId: '' };
  }
  return { level: 'subsub', mainId: String(parent.parent_id), subId: String(cat.parent_id) };
}

export default function StorefrontCategoriesPage() {
  const [channelType, setChannelType] = useState<string>('custom');
  const [connected, setConnected] = useState<boolean | null>(null);
  const [categories, setCategories] = useState<StorefrontCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StorefrontCategory | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  const fetchAll = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [connRes, catRes] = await Promise.all([
        channelsApi.getConnections(shopId),
        channelsApi.listStorefrontCategories(shopId, channelType).catch(() => ({ data: [] })),
      ]);
      const conns = connRes.data ?? [];
      setConnected(conns.some((c: any) => c.channel_type === channelType));
      setCategories(catRes.data ?? []);
    } catch {
      setConnected(false);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [shopId, channelType]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const mainCategories = siblingsOf(categories, null);
  const subCategoriesOf = (mainId: string) => mainId ? siblingsOf(categories, Number(mainId)) : [];

  const openAdd = (presetParentId?: number | null) => {
    setEditing(null);
    setUploadError('');
    if (presetParentId === undefined) {
      setForm(EMPTY_FORM);
    } else if (presetParentId === null) {
      setForm({ ...EMPTY_FORM, level: 'main' });
    } else {
      const parent = categories.find(c => c.id === presetParentId);
      if (parent && parent.parent_id === null) {
        setForm({ ...EMPTY_FORM, level: 'sub', mainId: String(parent.id) });
      } else if (parent) {
        setForm({ ...EMPTY_FORM, level: 'subsub', mainId: String(parent.parent_id), subId: String(parent.id) });
      }
    }
    setShowModal(true);
  };

  const openEdit = (c: StorefrontCategory) => {
    setEditing(c);
    setUploadError('');
    const { level, mainId, subId } = levelOf(c, categories);
    setForm({ name: c.name, icon_url: c.icon_url || '', level, mainId, subId });
    setShowModal(true);
  };

  const resolveParentId = (): number | null => {
    if (form.level === 'main') return null;
    if (form.level === 'sub') return form.mainId ? Number(form.mainId) : null;
    return form.subId ? Number(form.subId) : null;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image is too large — keep it under 5MB.');
      return;
    }
    setUploadError('');
    setUploading(true);
    try {
      const url = await channelsApi.uploadStorefrontCategoryIcon(shopId, file);
      setForm(p => ({ ...p, icon_url: url }));
    } catch {
      setUploadError('Upload failed. Try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (form.level === 'sub' && !form.mainId) return;
    if (form.level === 'subsub' && (!form.mainId || !form.subId)) return;
    setSaving(true);
    try {
      const parentId = resolveParentId();
      const siblingCount = siblingsOf(categories, parentId).length;
      const payload = {
        channel_type: channelType,
        name: form.name,
        icon_url: form.icon_url || undefined,
        sort_order: editing ? editing.sort_order : siblingCount,
        parent_id: parentId,
      };
      if (editing) {
        await channelsApi.updateStorefrontCategory(shopId, editing.id, payload);
      } else {
        await channelsApi.createStorefrontCategory(shopId, payload);
      }
      setShowModal(false);
      fetchAll();
    } catch {/* no-op */} finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      await channelsApi.deleteStorefrontCategory(shopId, id);
      fetchAll();
    } catch {/* no-op */}
    setDeleteId(null);
  };

  const move = async (list: StorefrontCategory[], index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    setReordering(true);
    const a = list[index];
    const b = list[target];
    try {
      await Promise.all([
        channelsApi.updateStorefrontCategory(shopId, a.id, { channel_type: channelType, name: a.name, icon_url: a.icon_url || undefined, sort_order: b.sort_order, parent_id: a.parent_id }),
        channelsApi.updateStorefrontCategory(shopId, b.id, { channel_type: channelType, name: b.name, icon_url: b.icon_url || undefined, sort_order: a.sort_order, parent_id: b.parent_id }),
      ]);
      await fetchAll();
    } catch {/* no-op */} finally { setReordering(false); }
  };

  const LEVEL_LABEL: Record<Level, string> = { main: 'Main Category', sub: 'Sub Category', subsub: 'Sub-Sub Category' };

  // ── Row renderer — recursive so Main -> Sub -> Sub-sub all reuse the
  // same UI, just indented further and slightly smaller each level down.
  const renderRow = (c: StorefrontCategory, depth: number) => {
    const kids = siblingsOf(categories, c.id);
    const siblings = siblingsOf(categories, c.parent_id);
    const idx = siblings.findIndex(s => s.id === c.id);
    return (
      <div key={c.id}>
        <div className="flex items-center gap-3 p-4 group" style={{ paddingLeft: `${16 + depth * 28}px` }}>
          {depth > 0 && <CornerDownRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />}
          <div className={`rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden ${depth === 0 ? 'w-10 h-10' : 'w-8 h-8'}`}>
            {c.icon_url
              ? <img src={c.icon_url} alt="" className="w-full h-full object-cover" />
              : <ImageIcon className={depth === 0 ? 'w-4 h-4 text-primary' : 'w-3.5 h-3.5 text-primary'} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-foreground truncate ${depth === 0 ? 'font-medium' : 'text-sm'}`}>{c.name}</p>
            <p className="text-xs text-muted-foreground/60 font-mono truncate">{c.slug}</p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
            {depth < 2 && (
              <button type="button" onClick={() => openAdd(c.id)} title={`Add ${depth === 0 ? 'sub' : 'sub-sub'} category`}
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition">
                <Plus className="w-4 h-4" />
              </button>
            )}
            <button type="button" onClick={() => move(siblings, idx, -1)} disabled={idx === 0 || reordering}
              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition disabled:opacity-30 disabled:cursor-not-allowed">
              <ArrowUp className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => move(siblings, idx, 1)} disabled={idx === siblings.length - 1 || reordering}
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
        {kids.map(k => renderRow(k, depth + 1))}
      </div>
    );
  };

  const channelLabel = CHANNEL_OPTIONS.find(o => o.value === channelType)?.label;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Storefront Categories</h1>
          <p className="text-muted-foreground text-sm">
            The category list shoppers see — powers your storefront's category grid and navigation live.
          </p>
        </div>
        <button type="button" onClick={() => openAdd()} disabled={!connected}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-40 disabled:cursor-not-allowed">
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
          TheDersi, Daraz, Noon and eBay already have their own category systems on their side — this is only for channels with none.
        </p>
      </div>

      {!loading && connected === false ? (
        <div className="bg-card rounded-xl border border-border p-16 text-center">
          <Link2 className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="font-semibold text-foreground mb-1">{channelLabel} isn't connected yet</h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
            Connect {channelLabel} under Channels first — categories only matter once there's a storefront to show them on.
          </p>
          <a href="/dashboard/channels"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
            Go to Channels
          </a>
        </div>
      ) : loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-card rounded-xl border border-border animate-pulse" />)}</div>
      ) : mainCategories.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-16 text-center">
          <LayoutGrid className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="font-semibold text-foreground mb-1">No categories yet</h3>
          <p className="text-sm text-muted-foreground mb-5">
            Add categories for {channelLabel} — they'll show up on your storefront immediately.
          </p>
          <button type="button" onClick={() => openAdd()}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
            <Plus className="w-4 h-4" /> Add Category
          </button>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {mainCategories.map(c => renderRow(c, 0))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{editing ? 'Edit Category' : 'Add Category'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Level *</label>
                <select value={form.level} onChange={(e) => setForm(p => ({ ...p, level: e.target.value as Level, mainId: '', subId: '' }))}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none">
                  <option value="main">Main Category</option>
                  <option value="sub">Sub Category</option>
                  <option value="subsub">Sub-Sub Category</option>
                </select>
              </div>

              {(form.level === 'sub' || form.level === 'subsub') && (
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Under which Main Category? *</label>
                  <select value={form.mainId} onChange={(e) => setForm(p => ({ ...p, mainId: e.target.value, subId: '' }))}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none">
                    <option value="">Select a main category…</option>
                    {mainCategories.filter(m => !editing || m.id !== editing.id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              )}

              {form.level === 'subsub' && form.mainId && (
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Under which Sub Category? *</label>
                  <select value={form.subId} onChange={(e) => setForm(p => ({ ...p, subId: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none">
                    <option value="">Select a sub category…</option>
                    {subCategoriesOf(form.mainId).filter(s => !editing || s.id !== editing.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {subCategoriesOf(form.mainId).length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">This main category has no sub categories yet — add one first.</p>
                  )}
                </div>
              )}

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{LEVEL_LABEL[form.level]} Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., Fragrances" autoFocus
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none" />
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Image</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0 overflow-hidden">
                    {uploading
                      ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      : form.icon_url
                        ? <img src={form.icon_url} alt="" className="w-full h-full object-cover" />
                        : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1">
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="cat-icon-upload" />
                    <label htmlFor="cat-icon-upload"
                      className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition cursor-pointer">
                      <Upload className="w-3.5 h-3.5" /> {form.icon_url ? 'Replace image' : 'Upload image'}
                    </label>
                    {form.icon_url && (
                      <button type="button" onClick={() => setForm(p => ({ ...p, icon_url: '' }))}
                        className="ml-2 text-xs text-muted-foreground hover:text-red-400 transition">Remove</button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  One image per category. Square works best — around 200×200px, under 5MB.
                </p>
                {uploadError && (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {uploadError}</p>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-border flex gap-3">
              <button type="button" onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={handleSave}
                disabled={saving || uploading || !form.name.trim() || (form.level === 'sub' && !form.mainId) || (form.level === 'subsub' && !form.subId)}
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
              It'll disappear from your storefront immediately, along with any sub categories under it. Products already assigned stay as they are.
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
