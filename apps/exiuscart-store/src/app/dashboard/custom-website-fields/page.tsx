'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, GripVertical, Loader2, Check, ListPlus,
} from 'lucide-react';
import { customProductFieldsApi, CustomProductField } from '@/lib/api';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

const FIELD_TYPES: { value: CustomProductField['type']; label: string; hint: string }[] = [
  { value: 'text', label: 'Text', hint: 'A short line of text' },
  { value: 'number', label: 'Number', hint: 'A numeric value' },
  { value: 'checkbox', label: 'Checkbox', hint: 'Yes / no' },
  { value: 'dropdown', label: 'Dropdown', hint: 'Pick one of a few options' },
  { value: 'quantity_tiers', label: 'Quantity Tiers', hint: 'Buy more, pay a different price per unit — actually affects checkout pricing' },
];

function newField(): CustomProductField {
  return { id: (crypto as any).randomUUID ? crypto.randomUUID() : `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, label: '', type: 'text', required: false };
}

export default function CustomWebsiteFieldsPage() {
  const [shopId, setShopId] = useState('');
  const [fields, setFields] = useState<CustomProductField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  useEffect(() => {
    if (!shopId) return;
    customProductFieldsApi.get(shopId)
      .then((r) => setFields(r.data?.fields ?? []))
      .catch(() => setFields([]))
      .finally(() => setLoading(false));
  }, [shopId]);

  const update = (i: number, patch: Partial<CustomProductField>) => {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  };
  const remove = (i: number) => setFields((prev) => prev.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const target = i + dir;
    if (target < 0 || target >= fields.length) return;
    setFields((prev) => {
      const next = [...prev];
      [next[i], next[target]] = [next[target], next[i]];
      return next;
    });
  };

  const canSave = fields.every((f) => f.label.trim()) &&
    fields.every((f) => f.type !== 'dropdown' || (f.options ?? []).length > 0);

  const save = async () => {
    if (!canSave) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      await customProductFieldsApi.set(shopId, fields);
      setSaved(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Link href="/dashboard/custom-website-integration" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" /> Back to Custom Website
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-foreground">Custom Website Product Fields</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define extra fields for your products on your own website — nothing hardcoded by ExiusCart. Once added here, each field shows up on the Products page so you can fill in a value per product.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">Loading...</span>
        </div>
      ) : (
        <>
          {error && <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">{error}</div>}

          <div className="space-y-3">
            {fields.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-xl">
                <ListPlus className="w-9 h-9 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground text-sm">No custom fields yet.</p>
                <p className="text-muted-foreground/60 text-xs mt-1">Add one below — e.g. Quantity Tiers, Gift Wrap Available, anything your site needs.</p>
              </div>
            )}
            {fields.map((f, i) => (
              <div key={f.id} className="border border-border rounded-lg p-3 space-y-2.5 bg-card">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                  <input type="text" value={f.label} onChange={(e) => update(i, { label: e.target.value })}
                    placeholder="Field name, e.g. Quantity Tiers"
                    className="flex-1 px-2.5 py-1.5 bg-muted border border-border rounded-lg text-sm" />
                  <select value={f.type} onChange={(e) => update(i, { type: e.target.value as CustomProductField['type'] })}
                    className="px-2 py-1.5 bg-muted border border-border rounded-lg text-xs shrink-0">
                    {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground pl-6">{FIELD_TYPES.find((t) => t.value === f.type)?.hint}</p>
                {f.type === 'dropdown' && (
                  <input type="text" value={(f.options ?? []).join(', ')}
                    onChange={(e) => update(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                    placeholder="Options, comma separated"
                    className="w-full ml-6 px-2.5 py-1.5 bg-muted border border-border rounded-lg text-xs" style={{ width: 'calc(100% - 1.5rem)' }} />
                )}
                <div className="flex items-center justify-between pl-6">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input type="checkbox" checked={!!f.required} onChange={(e) => update(i, { required: e.target.checked })} />
                    Required
                  </label>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                      className="p-1 hover:bg-muted rounded text-muted-foreground disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === fields.length - 1}
                      className="p-1 hover:bg-muted rounded text-muted-foreground disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => remove(i)}
                      className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setFields((prev) => [...prev, newField()])}
              className="w-full py-2.5 text-sm font-medium border border-dashed border-border rounded-lg text-muted-foreground hover:text-primary hover:border-primary/40 transition flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4" /> Add field
            </button>
          </div>

          <button type="button" onClick={save} disabled={!canSave || saving}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saved && !saving && <Check className="w-4 h-4" />}
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save Fields'}
          </button>
        </>
      )}
    </div>
  );
}
