'use client';

import { useEffect, useState } from 'react';
import { Plus, X, Loader2, Trash2, Edit2, Upload, ImageOff, Tag } from 'lucide-react';
import { adminApi } from '@/lib/api';

interface ProdoraCategory {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  product_count: number;
}

// The Prodora Marketplace shows a category tile only when the category has an
// image (and at least one active product), so this page is where those tiles
// are managed.
export default function ProdoraCategoriesPage() {
  const [categories, setCategories] = useState<ProdoraCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ProdoraCategory | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = () => {
    setLoading(true);
    adminApi.getProdoraCategories()
      .then((r) => setCategories(r.data ?? []))
      .catch(() => setError('Could not load categories.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openNew = () => { setEditing(null); setName(''); setImageUrl(''); setFormError(''); setShowForm(true); };
  const openEdit = (c: ProdoraCategory) => { setEditing(c); setName(c.name); setImageUrl(c.image_url ?? ''); setFormError(''); setShowForm(true); };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true); setFormError('');
    try {
      const r = await adminApi.uploadShoppingImage(file);
      setImageUrl(r.data?.url ?? '');
    } catch {
      setFormError('Image upload failed. Use a JPG or PNG under 10 MB.');
    } finally { setUploading(false); }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setFormError('Enter a category name.'); return; }
    setSaving(true); setFormError('');
    try {
      const payload = { name: name.trim(), image_url: imageUrl || null };
      if (editing) await adminApi.updateProdoraCategory(editing.id, payload);
      else await adminApi.createProdoraCategory(payload);
      setShowForm(false);
      load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setFormError(typeof detail === 'string' ? detail : 'Could not save the category.');
    } finally { setSaving(false); }
  };

  const remove = async (c: ProdoraCategory) => {
    if (!window.confirm(`Delete the category "${c.name}"?`)) return;
    try {
      await adminApi.deleteProdoraCategory(c.id);
      load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Could not delete the category.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="mt-1 text-sm text-gray-600">
            Only categories with an image appear as tiles in the Prodora Marketplace.
          </p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 rounded-lg bg-[#6B3FD9] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5A2EC9]">
          <Plus className="h-4 w-4" /> Add Category
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#6B3FD9]" /></div>
      ) : categories.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <Tag className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-3 font-medium text-gray-900">No categories yet</p>
          <p className="mt-1 text-sm text-gray-500">Add one, upload its image, then assign products to it.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((c) => (
            <div key={c.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="relative flex aspect-[4/3] items-center justify-center bg-gray-50">
                {c.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-gray-400">
                    <ImageOff className="h-7 w-7" />
                    <span className="text-xs">No image</span>
                  </div>
                )}
                {!c.image_url && (
                  <span className="absolute left-2 top-2 rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600">Hidden from Marketplace</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900" title={c.name}>{c.name}</p>
                  <p className="text-xs text-gray-500">{c.product_count} product{c.product_count !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => openEdit(c)} aria-label={`Edit ${c.name}`} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"><Edit2 className="h-4 w-4" /></button>
                  <button onClick={() => remove(c)} aria-label={`Delete ${c.name}`} className="rounded-lg p-2 text-gray-600 hover:bg-red-500/10 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowForm(false)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-4 rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{editing ? 'Edit category' : 'Add category'}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-900"><X className="h-5 w-5" /></button>
            </div>

            <div>
              <label htmlFor="cat-name" className="mb-1 block text-xs font-medium text-gray-600">Name</label>
              <input
                id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pets"
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#6B3FD9]"
              />
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-gray-600">Tile image</p>
              <div className="flex items-center gap-3">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-300 bg-gray-50">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageOff className="h-6 w-6 text-gray-400" />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {imageUrl ? 'Replace image' : 'Upload image'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
                  </label>
                  {imageUrl && (
                    <button type="button" onClick={() => setImageUrl('')} className="block text-xs text-gray-500 hover:text-red-600">Remove image</button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">A square image works best. Without one, this category is hidden from the Marketplace.</p>
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button type="submit" disabled={saving || uploading} className="inline-flex items-center gap-2 rounded-lg bg-[#6B3FD9] px-5 py-2 text-sm font-semibold text-white hover:bg-[#5A2EC9] disabled:opacity-60">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
