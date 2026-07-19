'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Package, Loader2 } from 'lucide-react';
import { variantsApi } from '@/lib/api';

export interface BundleComponent {
  component_product_id: number;
  component_product_name?: string;
  allowed_variant_ids: number[];
  quantity: number;
}

interface Variant {
  id: number;
  size: string | null;
  color: string | null;
  quantity: number;
}

interface Product {
  id: number | string;
  name: string;
}

interface BundleBuilderProps {
  shopId: string;
  enabled: boolean;
  onToggle: (val: boolean) => void;
  components: BundleComponent[];
  onChange: (components: BundleComponent[]) => void;
  availableProducts: Product[];
  currentProductId?: number | string;
}

function emptyComponent(): BundleComponent {
  return { component_product_id: 0, allowed_variant_ids: [], quantity: 1 };
}

function variantLabel(v: Variant): string {
  return [v.size, v.color].filter(Boolean).join(' / ') || 'Default';
}

export function BundleBuilder({ shopId, enabled, onToggle, components, onChange, availableProducts, currentProductId }: BundleBuilderProps) {
  const selectable = availableProducts.filter(p => p.id !== currentProductId);
  const noProducts = selectable.length === 0;

  // Variants of each component product currently in the bundle, keyed by
  // product id — fetched on demand so the seller can tick which real
  // size/color options a buyer is allowed to choose between for that slot.
  const [variantsByProduct, setVariantsByProduct] = useState<Record<string, Variant[]>>({});
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    components.forEach((c) => {
      const key = String(c.component_product_id);
      if (!c.component_product_id || variantsByProduct[key] !== undefined) return;
      setLoadingProductId(key);
      variantsApi.getAll(shopId, key)
        .then((res) => setVariantsByProduct((prev) => ({ ...prev, [key]: res.data ?? [] })))
        .catch(() => setVariantsByProduct((prev) => ({ ...prev, [key]: [] })))
        .finally(() => setLoadingProductId(null));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, components.map(c => c.component_product_id).join(',')]);

  function update(index: number, patch: Partial<BundleComponent>) {
    const updated = { ...components[index], ...patch };
    // Block duplicate product selection (same product already used in another row)
    if (patch.component_product_id !== undefined) {
      const alreadyUsed = components.some((c, i) => i !== index && c.component_product_id === patch.component_product_id && patch.component_product_id !== 0);
      if (alreadyUsed) return;
    }
    onChange(components.map((c, i) => i === index ? updated : c));
  }

  function toggleVariant(index: number, variantId: number) {
    const current = components[index].allowed_variant_ids;
    const next = current.includes(variantId)
      ? current.filter((id) => id !== variantId)
      : [...current, variantId];
    update(index, { allowed_variant_ids: next });
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
            {noProducts
              ? 'Save this product first, then add other products to create a bundle.'
              : 'Combine multiple products into one sellable bundle. Stock deducted from each component on sale.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => !noProducts && onToggle(!enabled)}
          disabled={noProducts}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${enabled && !noProducts ? 'bg-primary' : 'bg-muted'} ${noProducts ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${enabled && !noProducts ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Component list */}
      {enabled && (
        <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/30">
          {components.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">No components yet — add at least one product below.</p>
          )}

          {components.map((c, i) => {
            const usedIds = new Set(components.filter((_, j) => j !== i).map(x => String(x.component_product_id)));
            const available = selectable.filter(p => !usedIds.has(String(p.id)) || String(p.id) === String(c.component_product_id));
            const productKey = String(c.component_product_id);
            const variants = variantsByProduct[productKey] ?? [];
            const isLoadingVariants = loadingProductId === productKey;
            return (
            <div key={i} className="border border-border rounded-lg p-3 bg-card space-y-2.5">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-start">
                {/* Product selector */}
                <select
                  value={c.component_product_id || ''}
                  onChange={e => update(i, { component_product_id: Number(e.target.value), allowed_variant_ids: [] })}
                  className="w-full px-2.5 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="">Select product…</option>
                  {available.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

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
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition mt-5"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Which real size/color options the buyer may pick between for this slot */}
              {c.component_product_id > 0 && (
                <div className="pl-0.5">
                  {isLoadingVariants ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading options…
                    </p>
                  ) : variants.length === 0 ? (
                    <p className="text-xs text-muted-foreground">This product has no size/color options — it's added as-is.</p>
                  ) : (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">
                        Which options can the buyer choose between? (leave none ticked to just use the product as-is)
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {variants.map((v) => {
                          const checked = c.allowed_variant_ids.includes(v.id);
                          const outOfStock = v.quantity <= 0;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              disabled={outOfStock}
                              onClick={() => toggleVariant(i, v.id)}
                              className={`px-2.5 py-1 rounded-full text-xs border transition ${
                                outOfStock
                                  ? 'border-border text-muted-foreground/50 cursor-not-allowed line-through'
                                  : checked
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-card border-border text-foreground hover:border-primary/50'
                              }`}
                            >
                              {variantLabel(v)}{outOfStock ? ' (out of stock)' : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            );
          })}

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
