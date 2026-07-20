'use client';

import { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { channelsApi } from '@/lib/api';

interface DarazAttribute {
  name: string;
  label: string;
  isMandatory: number | boolean;
  isSaleProp: number | boolean;
  attributeType: 'normal' | 'sku';
  inputType: 'text' | 'richText' | 'singleSelect' | 'multiSelect' | 'numeric' | 'date' | 'img';
  options?: { name: string }[];
}

interface DarazBrand {
  BrandId: number | string;
  Name: string;
}

interface DarazListingFieldsProps {
  shopId: string;
  categoryId: string;
  values: Record<string, string>;
  brand: string;
  onChange: (values: Record<string, string>, brand: string) => void;
}

// Fields the backend already fills in from the product's own name/description,
// and SKU-level fields (handled by the product's own variants) — no need to
// ask the seller for these again.
const SKIP_FIELDS = new Set(['name', 'short_description', 'description']);

export function DarazListingFields({ shopId, categoryId, values, brand, onChange }: DarazListingFieldsProps) {
  const [attributes, setAttributes] = useState<DarazAttribute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [brandQuery, setBrandQuery] = useState(brand);
  const [brandResults, setBrandResults] = useState<DarazBrand[]>([]);
  const [brandOpen, setBrandOpen] = useState(false);
  const [brandLoading, setBrandLoading] = useState(false);

  useEffect(() => {
    if (!categoryId) { setAttributes([]); return; }
    setLoading(true);
    setError('');
    channelsApi.getDarazCategoryAttributes(shopId, categoryId)
      .then((r) => setAttributes((r.data?.attributes ?? []).filter(
        (a: DarazAttribute) => a.attributeType === 'normal' && !SKIP_FIELDS.has(a.name) && a.name !== 'brand',
      )))
      .catch(() => setError("Could not load Daraz's requirements for this category — try reselecting it."))
      .finally(() => setLoading(false));
  }, [shopId, categoryId]);

  useEffect(() => {
    if (!brandOpen) return;
    setBrandLoading(true);
    const t = setTimeout(() => {
      channelsApi.getDarazBrands(shopId, brandQuery)
        .then((r) => setBrandResults((r.data?.brands ?? []).slice(0, 20)))
        .catch(() => setBrandResults([]))
        .finally(() => setBrandLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [shopId, brandQuery, brandOpen]);

  const setValue = (name: string, value: string) => {
    onChange({ ...values, [name]: value }, brand);
  };

  if (!categoryId) return null;

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Daraz requires a few more details for this category
      </p>

      {loading && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading Daraz's requirements…</p>
      )}
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {error}</p>
      )}

      {/* Brand — searched from Daraz's real brand list, not free text */}
      <div className="relative">
        <label className="text-xs font-medium text-foreground mb-1 block">Brand *</label>
        <input
          type="text"
          value={brandQuery}
          onChange={(e) => { setBrandQuery(e.target.value); setBrandOpen(true); onChange(values, ''); }}
          onFocus={() => setBrandOpen(true)}
          placeholder="Search Daraz brands…"
          className="w-full px-2.5 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
        />
        {brandOpen && (
          <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-card border border-border rounded-lg shadow-lg">
            {brandLoading ? (
              <p className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Searching…</p>
            ) : brandResults.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No matching brands</p>
            ) : (
              brandResults.map((b) => (
                <button
                  key={b.BrandId}
                  type="button"
                  onClick={() => { setBrandQuery(b.Name); setBrandOpen(false); onChange(values, b.Name); }}
                  className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition"
                >
                  {b.Name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {attributes.map((attr) => {
        const required = attr.isMandatory === 1 || attr.isMandatory === true;
        const label = `${attr.label}${required ? ' *' : ''}`;
        const value = values[attr.name] ?? '';

        if (attr.inputType === 'singleSelect' && attr.options?.length) {
          return (
            <div key={attr.name}>
              <label className="text-xs font-medium text-foreground mb-1 block">{label}</label>
              <select
                value={value}
                onChange={(e) => setValue(attr.name, e.target.value)}
                className="w-full px-2.5 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="">Select…</option>
                {attr.options.map((o) => <option key={o.name} value={o.name}>{o.name}</option>)}
              </select>
            </div>
          );
        }
        if (attr.inputType === 'numeric') {
          return (
            <div key={attr.name}>
              <label className="text-xs font-medium text-foreground mb-1 block">{label}</label>
              <input type="number" value={value} onChange={(e) => setValue(attr.name, e.target.value)}
                className="w-full px-2.5 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none" />
            </div>
          );
        }
        if (attr.inputType === 'date') {
          return (
            <div key={attr.name}>
              <label className="text-xs font-medium text-foreground mb-1 block">{label}</label>
              <input type="date" value={value} onChange={(e) => setValue(attr.name, e.target.value)}
                className="w-full px-2.5 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none" />
            </div>
          );
        }
        // text, richText, multiSelect, img — plain text input is a fine catch-all here
        return (
          <div key={attr.name}>
            <label className="text-xs font-medium text-foreground mb-1 block">{label}</label>
            <input type="text" value={value} onChange={(e) => setValue(attr.name, e.target.value)}
              className="w-full px-2.5 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none" />
          </div>
        );
      })}
    </div>
  );
}
