'use client';

import { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { ebayApi } from '@/lib/api';

interface EbayAspect {
  name: string;
  label: string;
  isMandatory: boolean;
  inputType: 'text' | 'singleSelect';
  options?: { name: string }[];
}

const EBAY_CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'NEW_OTHER', label: 'New (other)' },
  { value: 'USED_EXCELLENT', label: 'Used — Excellent' },
  { value: 'USED_GOOD', label: 'Used — Good' },
  { value: 'USED_ACCEPTABLE', label: 'Used — Acceptable' },
];

interface EbayListingFieldsProps {
  shopId: string;
  categoryId: string;
  values: Record<string, string>;
  condition: string;
  onChange: (values: Record<string, string>, condition: string) => void;
}

// eBay aspects are normalized server-side into the same {name, label,
// isMandatory, inputType, options} shape Daraz's category attributes use,
// so this component's render logic is a near copy of DarazListingFields —
// no new shape-translation logic needed on the frontend.
export function EbayListingFields({ shopId, categoryId, values, condition, onChange }: EbayListingFieldsProps) {
  const [aspects, setAspects] = useState<EbayAspect[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!categoryId) { setAspects([]); return; }
    setLoading(true);
    setError('');
    ebayApi.getCategoryAttributes(shopId, categoryId)
      .then((r) => setAspects(r.data?.attributes ?? []))
      .catch(() => setError("Could not load eBay's requirements for this category — try reselecting it."))
      .finally(() => setLoading(false));
  }, [shopId, categoryId]);

  const setValue = (name: string, value: string) => {
    onChange({ ...values, [name]: value }, condition);
  };

  if (!categoryId) return null;

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        eBay requires a few more details for this category
      </p>

      {loading && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading eBay's requirements…</p>
      )}
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {error}</p>
      )}

      <div>
        <label className="text-xs font-medium text-foreground mb-1 block">Condition *</label>
        <select
          value={condition}
          onChange={(e) => onChange(values, e.target.value)}
          className="w-full px-2.5 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
        >
          {EBAY_CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {aspects.map((aspect) => {
        const label = `${aspect.label}${aspect.isMandatory ? ' *' : ''}`;
        const value = values[aspect.name] ?? '';

        if (aspect.inputType === 'singleSelect' && aspect.options?.length) {
          return (
            <div key={aspect.name}>
              <label className="text-xs font-medium text-foreground mb-1 block">{label}</label>
              <select
                value={value}
                onChange={(e) => setValue(aspect.name, e.target.value)}
                className="w-full px-2.5 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="">Select…</option>
                {aspect.options.map((o) => <option key={o.name} value={o.name}>{o.name}</option>)}
              </select>
            </div>
          );
        }
        return (
          <div key={aspect.name}>
            <label className="text-xs font-medium text-foreground mb-1 block">{label}</label>
            <input type="text" value={value} onChange={(e) => setValue(aspect.name, e.target.value)}
              className="w-full px-2.5 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none" />
          </div>
        );
      })}
    </div>
  );
}
