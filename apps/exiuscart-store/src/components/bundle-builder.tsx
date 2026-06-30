'use client';

import { Plus, Trash2, Package } from 'lucide-react';

export interface BundleComponent {
  component_product_id: number;
  component_product_name?: string;
  variant_size: string;
  variant_color: string;
  quantity: number;
}

interface Product {
  id: number;
  name: string;
}

interface BundleBuilderProps {
  enabled: boolean;
  onToggle: (val: boolean) => void;
  components: BundleComponent[];
  onChange: (components: BundleComponent[]) => void;
  availableProducts: Product[];
  currentProductId?: number;
}

function emptyComponent(): BundleComponent {
  return { component_product_id: 0, variant_size: '', variant_color: '', quantity: 1 };
}

export function BundleBuilder({ enabled, onToggle, components, onChange, availableProducts, currentProductId }: BundleBuilderProps) {
  const selectable = availableProducts.filter(p => p.id !== currentProductId);

  function update(index: number, patch: Partial<BundleComponent>) {
    onChange(components.map((c, i) => i === index ? { ...c, ...patch } : c));
  }

  function remove(index: number) {
    onChange(components.filter((_, i) => i !== index));
  }

  function add() {
    onChange([...components, emptyComponent()]);
  }

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Bundle / Kit Product
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Combine multiple products into one sellable bundle. Stock deducted from each component on sale.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onToggle(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-primary' : 'bg-muted'}`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Component list */}
      {enabled && (
        <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/30">
          {components.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">No components yet — add at least one product below.</p>
          )}

          {components.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-start">
              {/* Product selector */}
              <div className="space-y-1.5">
                <select
                  value={c.component_product_id || ''}
                  onChange={e => update(i, { component_product_id: Number(e.target.value) })}
                  className="w-full px-2.5 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="">Select product…</option>
                  {selectable.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={c.variant_size}
                    onChange={e => update(i, { variant_size: e.target.value })}
                    placeholder="Size (optional)"
                    className="flex-1 px-2.5 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground focus:ring-2 focus:ring-primary outline-none"
                  />
                  <input
                    type="text"
                    value={c.variant_color}
                    onChange={e => update(i, { variant_color: e.target.value })}
                    placeholder="Color (optional)"
                    className="flex-1 px-2.5 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              {/* Qty */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">Qty</span>
                <input
                  type="number"
                  min={1}
                  value={c.quantity}
                  onChange={e => update(i, { quantity: Math.max(1, Number(e.target.value)) })}
                  className="w-14 px-2 py-2 bg-card border border-border rounded-lg text-sm text-center text-foreground focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              {/* Remove */}
              <div className="flex flex-col justify-end pb-0.5">
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition mt-5"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={add}
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add component
          </button>

          {components.length > 0 && (
            <p className="text-xs text-muted-foreground pt-1 border-t border-border">
              Total items per bundle: <strong>{components.reduce((s, c) => s + c.quantity, 0)}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
