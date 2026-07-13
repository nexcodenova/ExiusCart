'use client';

import { useState, useEffect } from 'react';
import { Truck, Loader2, Trash2, CheckCircle2, ExternalLink } from 'lucide-react';
import { dropshipApi } from '@/lib/api';
import Link from 'next/link';

interface SupplierLink {
  id: number;
  supplier_type: string;
  supplier_product_id: string | null;
  supplier_product_url: string | null;
  supplier_sku: string | null;
  supplier_product_name: string | null;
  cost_price: number | null;
  is_primary: boolean;
}

const SUPPLIER_LABELS: Record<string, string> = {
  cj: 'CJ Dropshipping',
  zendrop: 'Zendrop',
  hypersku: 'HyperSKU',
  wiio: 'Wiio',
};

interface Props {
  shopId: string;
  productId: number | string | undefined;
}

export function DropshipSupplierSection({ shopId, productId }: Props) {
  const [connectedSuppliers, setConnectedSuppliers] = useState<string[]>([]);
  const [links, setLinks] = useState<SupplierLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplierType, setSupplierType] = useState('');
  const [sku, setSku] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = () => {
    if (!shopId || !productId) return;
    setLoading(true);
    Promise.all([
      dropshipApi.getConnections(shopId).then((r) => {
        const active = (r.data?.suppliers ?? []).filter((s: any) => s.connected).map((s: any) => s.supplier_type as string);
        setConnectedSuppliers(active);
      }).catch(() => {}),
      dropshipApi.getProductLink(shopId, String(productId)).then((r) => setLinks(r.data?.links ?? [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [shopId, productId]);

  useEffect(() => {
    if (connectedSuppliers.length > 0 && !supplierType) setSupplierType(connectedSuppliers[0]);
  }, [connectedSuppliers]);

  if (!productId) return null;

  const save = async () => {
    if (!supplierType || !sku.trim()) { setError('Supplier and SKU are required.'); return; }
    setSaving(true); setError('');
    try {
      await dropshipApi.saveProductLink(shopId, String(productId), {
        supplier_type: supplierType,
        supplier_sku: sku.trim(),
        supplier_product_url: productUrl.trim() || undefined,
        cost_price: costPrice ? Number(costPrice) : undefined,
        is_primary: true,
      });
      setSku(''); setProductUrl(''); setCostPrice('');
      load();
    } catch (e: any) {
      setError(e?.response?.data?.detail?.message ?? e?.response?.data?.detail ?? 'Failed to save supplier link.');
    } finally { setSaving(false); }
  };

  const remove = async (type: string) => {
    if (!confirm(`Remove the ${SUPPLIER_LABELS[type] ?? type} link for this product?`)) return;
    setRemovingId(type);
    try {
      await dropshipApi.removeProductLink(shopId, String(productId), type);
      load();
    } finally { setRemovingId(null); }
  };

  const availableToAdd = connectedSuppliers.filter((s) => !links.some((l) => l.supplier_type === s));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Truck className="w-4 h-4 text-primary" />
        <p className="text-sm font-medium text-foreground">Dropship Supplier</p>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Link this product to a supplier SKU so it can be fulfilled automatically when an order comes in.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : connectedSuppliers.length === 0 ? (
        <div className="bg-muted/40 border border-border rounded-lg px-4 py-3 text-sm text-muted-foreground">
          No suppliers connected yet.{' '}
          <Link href="/dashboard/dropshipping" className="text-primary hover:underline font-medium">
            Connect a supplier
          </Link>{' '}
          to link this product for automatic fulfillment.
        </div>
      ) : (
        <>
          {links.length > 0 && (
            <div className="space-y-2">
              {links.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 bg-muted/40 border border-border rounded-lg px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <p className="text-sm font-medium text-foreground">{SUPPLIER_LABELS[l.supplier_type] ?? l.supplier_type}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">SKU: {l.supplier_sku}{l.cost_price ? ` · Cost $${l.cost_price.toFixed(2)}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {l.supplier_product_url && (
                      <a href={l.supplier_product_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-muted-foreground hover:text-foreground transition">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button type="button" onClick={() => remove(l.supplier_type)} disabled={removingId === l.supplier_type}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {availableToAdd.length > 0 && (
            <div className="border border-dashed border-border rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Supplier</label>
                  <select value={supplierType} onChange={(e) => setSupplierType(e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground outline-none">
                    {availableToAdd.map((s) => <option key={s} value={s}>{SUPPLIER_LABELS[s] ?? s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Supplier SKU / Variant ID *</label>
                  <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. CJ variant ID"
                    className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Product URL (optional)</label>
                  <input value={productUrl} onChange={(e) => setProductUrl(e.target.value)} placeholder="https://cjdropshipping.com/product/..."
                    className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground outline-none" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Cost Price (optional)</label>
                  <input type="number" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0.00"
                    className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground outline-none" />
                </div>
              </div>
              {error && <p className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
              <button type="button" onClick={save} disabled={saving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center gap-2">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Saving...' : 'Link Supplier'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
