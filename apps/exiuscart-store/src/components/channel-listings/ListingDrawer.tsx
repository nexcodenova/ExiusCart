import Link from 'next/link';
import Image from 'next/image';
import { X, Check, XCircle as XIcon, Copy, Pencil, ExternalLink, Package, AlertTriangle, Loader2 } from 'lucide-react';
import { channelMeta } from './channelMeta';
import ChannelLogo from './ChannelLogo';
import StatusBadge, { ListingStatus } from './StatusBadge';

export interface ListingDetail {
  id: number;
  product_id: number | null;
  product_name: string | null;
  product_sku: string | null;
  product_image_url: string | null;
  channel_type: string;
  store_name: string;
  supplier_type: string | null;
  action: string;
  status: ListingStatus;
  external_id: string | null;
  listing_url: string | null;
  error_message: string | null;
  history: { success: boolean; error_message: string | null; created_at: string }[];
  synthetic?: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  create_listing: 'Create Listing', update_stock: 'Update Stock', update_price: 'Update Price',
  sync_order: 'Sync Order', listing_status: 'Listing Status', listing: 'Listing', available: 'Available',
};

// Real tips for the specific failure patterns this codebase's own channel
// integrations are actually known to hit — not a generic invented
// checklist. Matched against the real error text; anything that doesn't
// match one of these just shows the raw error with no fabricated advice.
function fixTips(errorMessage: string | null): string[] {
  if (!errorMessage) return [];
  const e = errorMessage.toLowerCase();
  const tips: string[] = [];
  if (e.includes('category')) tips.push('Assign a category for this product on this channel, then retry.');
  if (e.includes('description') && (e.includes('4000') || e.includes('too long') || e.includes('exceed'))) tips.push("This channel's description length limit was hit — shorten the product description.");
  if (e.includes('image')) tips.push('Check every product image loads at a public URL and is a supported format (JPEG/PNG).');
  if (e.includes('price')) tips.push("This channel rejected the price — check it's within the range this channel allows.");
  if (e.includes('sku')) tips.push('This channel needs a unique SKU for this product — check for a duplicate.');
  if (e.includes('stock') || e.includes('quantity') || e.includes('inventory')) tips.push('Update the available stock for this product, then retry.');
  return tips;
}

export default function ListingDrawer({ detail, loading, onClose }: {
  detail: ListingDetail | null; loading: boolean; onClose: () => void;
}) {
  const meta = detail ? channelMeta(detail.channel_type) : null;
  const tips = detail ? fixTips(detail.error_message) : [];

  return (
    <aside className="fixed inset-y-0 right-0 z-30 w-full sm:w-[380px] overflow-y-auto border-l border-border bg-card shadow-2xl">
      <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-4 z-10">
        <h2 className="font-bold text-foreground">Listing details</h2>
        <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted text-muted-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading || !detail ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">Loading…</span>
        </div>
      ) : (
        <div className="p-5">
          <div className="flex gap-3">
            <div className="relative w-16 h-16 rounded-lg bg-muted overflow-hidden shrink-0">
              {detail.product_image_url ? (
                <Image src={detail.product_image_url} alt={detail.product_name ?? ''} fill className="object-cover" unoptimized />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center"><Package className="w-5 h-5 text-muted-foreground/40" /></div>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground line-clamp-2">{detail.product_name ?? `Product #${detail.product_id ?? '—'}`}</h3>
              <dl className="mt-2 grid grid-cols-[80px_1fr] gap-y-1 text-xs">
                <dt className="text-muted-foreground">SKU</dt><dd className="font-semibold text-foreground">{detail.product_sku ?? '—'}</dd>
                <dt className="text-muted-foreground">Product ID</dt><dd className="font-semibold text-foreground">#{detail.product_id ?? '—'}</dd>
                <dt className="text-muted-foreground">Supplier</dt><dd className="font-semibold text-foreground capitalize">{detail.supplier_type ?? '—'}</dd>
                <dt className="text-muted-foreground">Store</dt><dd className="font-semibold text-foreground">{detail.store_name}</dd>
              </dl>
              <div className="mt-2 flex items-center gap-1.5">
                <ChannelLogo channelType={detail.channel_type} size={14} />
                <span className="text-xs font-medium text-foreground">{meta?.label}</span>
              </div>
            </div>
          </div>

          <div className="my-5 border-t border-border" />

          <h4 className="text-sm font-bold text-foreground">Attempt history</h4>
          {detail.synthetic ? (
            <p className="text-xs text-muted-foreground mt-0.5 mb-3 leading-relaxed">
              Custom Website has no push step — your storefront reads this product straight from the ExiusCart API whenever it loads. There's no sync attempt to record: as long as the product is active and Custom Website is connected, it's live.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">{ACTION_LABELS[detail.action] ?? detail.action} — real attempts recorded for this listing</p>
          )}
          <div className="space-y-4 border-l-2 border-border pl-4">
            {detail.history.map((h, i) => (
              <div key={i} className="relative">
                <span className={`absolute -left-[21px] top-0 w-4 h-4 rounded-full flex items-center justify-center text-white ${h.success ? 'bg-green-500' : 'bg-destructive'}`}>
                  {h.success ? <Check className="w-2.5 h-2.5" /> : <XIcon className="w-2.5 h-2.5" />}
                </span>
                <p className="text-xs font-bold text-foreground">{h.success ? 'Succeeded' : 'Failed'}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(h.created_at).toLocaleString()}</p>
                {!h.success && h.error_message && <p className="text-[11px] text-destructive mt-0.5">{h.error_message}</p>}
              </div>
            ))}
          </div>

          {(detail.status === 'failed' || detail.status === 'warning') && detail.error_message && (
            <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex gap-2">
                <AlertTriangle className="shrink-0 text-destructive w-4 h-4 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-destructive">{detail.status === 'failed' ? 'Sync failed' : 'Listed with warnings'}</p>
                  <p className="mt-1 text-xs text-destructive/90 leading-relaxed">{detail.error_message}</p>
                </div>
              </div>
            </div>
          )}

          {tips.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-bold text-foreground mb-2">What needs fixing?</h4>
              <ol className="space-y-2.5">
                {tips.map((tip, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-muted text-foreground flex items-center justify-center text-[11px] font-bold shrink-0">{i + 1}</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">{tip}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            {detail.product_id && (
              <Link href={`/dashboard/products?edit=${detail.product_id}`}
                className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-bold hover:bg-primary/90 transition">
                <Pencil className="w-4 h-4" /> Review & Retry
              </Link>
            )}
            {detail.listing_url && (
              <a href={detail.listing_url} target="_blank" rel="noopener noreferrer"
                className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition">
                Open live listing <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            {detail.error_message && (
              <button onClick={() => navigator.clipboard.writeText(detail.error_message ?? '')}
                className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition">
                <Copy className="w-3.5 h-3.5" /> Copy error message
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
