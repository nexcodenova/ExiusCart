'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, AlertCircle, X, Plus } from 'lucide-react';
import { noonApi } from '@/lib/api';

interface NoonAttribute {
  attribute_code: string;
  attribute_type: string; // ATTRIBUTE_TYPE_TEXT | ATTRIBUTE_TYPE_SELECT | ...
  attribute_options: string[];
  is_mandatory: boolean;
  is_localizable: boolean;
  is_multivalued: boolean;
  is_html_allowed: boolean;
  max_characters: number | null;
}

export type NoonAttributeValues = Record<string, { value: string; language?: string; sort?: number }[]>;

interface NoonListingFieldsProps {
  shopId: string;
  categoryCode: string;
  onCategorySelect: (code: string) => void;
  values: NoonAttributeValues;
  onChange: (values: NoonAttributeValues) => void;
}

// Noon categories are a flat list of ~6,800 codes with no search endpoint —
// fetched once and filtered client-side as the seller types.
function CategoryPicker({ shopId, categoryCode, onSelect }: {
  shopId: string; categoryCode: string; onSelect: (code: string) => void;
}) {
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    noonApi.getCategories(shopId)
      .then((r) => setAllCategories(r.data?.categories ?? []))
      .catch(() => setAllCategories([]))
      .finally(() => setLoading(false));
  }, [shopId]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allCategories.filter((c) => c.toLowerCase().includes(q)).slice(0, 30);
  }, [query, allCategories]);

  return (
    <div className="relative">
      <label className="text-xs font-medium text-foreground mb-1 block">Noon Category *</label>
      <input
        type="text"
        value={open ? query : categoryCode}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={loading ? 'Loading categories…' : 'Search Noon categories…'}
        disabled={loading}
        className="w-full px-2.5 py-2 bg-card border border-border rounded-lg text-sm text-foreground font-mono focus:ring-2 focus:ring-primary outline-none"
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-card border border-border rounded-lg shadow-lg">
          {query.trim() === '' ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Type to search {allCategories.length.toLocaleString()} categories…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No matching categories</p>
          ) : (
            results.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { onSelect(c); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs font-mono text-foreground hover:bg-muted transition"
              >
                {c}
              </button>
            ))
          )}
          <button type="button" onClick={() => setOpen(false)}
            className="w-full text-center px-3 py-1.5 text-xs text-muted-foreground border-t border-border hover:bg-muted transition">
            Close
          </button>
        </div>
      )}
    </div>
  );
}

export function NoonListingFields({ shopId, categoryCode, onCategorySelect, values, onChange }: NoonListingFieldsProps) {
  const [attributes, setAttributes] = useState<NoonAttribute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!categoryCode) { setAttributes([]); return; }
    setLoading(true);
    setError('');
    noonApi.getCategoryAttributes(shopId, categoryCode)
      .then((r) => setAttributes(r.data?.attributes ?? []))
      .catch(() => setError("Could not load Noon's requirements for this category — try reselecting it."))
      .finally(() => setLoading(false));
  }, [shopId, categoryCode]);

  const setSingleValue = (attr: NoonAttribute, value: string) => {
    onChange({
      ...values,
      [attr.attribute_code]: [{
        value,
        language: attr.is_localizable ? 'LANGUAGE_EN' : undefined,
      }],
    });
  };

  const setMultiValue = (attr: NoonAttribute, index: number, value: string) => {
    const current = values[attr.attribute_code] ?? [];
    const next = [...current];
    next[index] = { value, language: attr.is_localizable ? 'LANGUAGE_EN' : undefined, sort: index + 1 };
    onChange({ ...values, [attr.attribute_code]: next });
  };

  const addMultiValue = (attr: NoonAttribute) => {
    const current = values[attr.attribute_code] ?? [];
    onChange({ ...values, [attr.attribute_code]: [...current, { value: '', sort: current.length + 1 }] });
  };

  const removeMultiValue = (attr: NoonAttribute, index: number) => {
    const current = values[attr.attribute_code] ?? [];
    onChange({ ...values, [attr.attribute_code]: current.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Noon requires a few more details
      </p>

      <CategoryPicker shopId={shopId} categoryCode={categoryCode} onSelect={onCategorySelect} />

      {!categoryCode ? null : loading ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading Noon's requirements…</p>
      ) : error ? (
        <p className="text-xs text-destructive flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {error}</p>
      ) : (
        attributes.map((attr) => {
          const required = attr.is_mandatory;
          const label = `${attr.attribute_code}${required ? ' *' : ''}`;
          const isSelect = attr.attribute_type === 'ATTRIBUTE_TYPE_SELECT' && attr.attribute_options?.length > 0;
          const isLong = (attr.max_characters ?? 0) > 300;

          if (attr.is_multivalued) {
            const entries = values[attr.attribute_code] ?? [];
            return (
              <div key={attr.attribute_code}>
                <label className="text-xs font-medium text-foreground mb-1 block">{label}</label>
                <div className="space-y-1.5">
                  {entries.map((entry, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      {isSelect ? (
                        <select value={entry.value} onChange={(e) => setMultiValue(attr, i, e.target.value)}
                          className="flex-1 px-2.5 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none">
                          <option value="">Select…</option>
                          {attr.attribute_options.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input type="text" value={entry.value} onChange={(e) => setMultiValue(attr, i, e.target.value)}
                          className="flex-1 px-2.5 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none" />
                      )}
                      <button type="button" onClick={() => removeMultiValue(attr, i)}
                        className="p-1.5 text-muted-foreground hover:text-destructive shrink-0"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addMultiValue(attr)}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>
            );
          }

          const value = values[attr.attribute_code]?.[0]?.value ?? '';

          if (isSelect) {
            return (
              <div key={attr.attribute_code}>
                <label className="text-xs font-medium text-foreground mb-1 block">{label}</label>
                <select value={value} onChange={(e) => setSingleValue(attr, e.target.value)}
                  className="w-full px-2.5 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none">
                  <option value="">Select…</option>
                  {attr.attribute_options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            );
          }

          if (isLong) {
            return (
              <div key={attr.attribute_code}>
                <label className="text-xs font-medium text-foreground mb-1 block">{label}</label>
                <textarea value={value} onChange={(e) => setSingleValue(attr, e.target.value)} rows={3}
                  className="w-full px-2.5 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none" />
              </div>
            );
          }

          return (
            <div key={attr.attribute_code}>
              <label className="text-xs font-medium text-foreground mb-1 block">{label}</label>
              <input type="text" value={value} onChange={(e) => setSingleValue(attr, e.target.value)}
                className="w-full px-2.5 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none" />
            </div>
          );
        })
      )}
    </div>
  );
}
