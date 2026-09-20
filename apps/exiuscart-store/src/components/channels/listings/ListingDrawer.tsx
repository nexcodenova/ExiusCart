import { useState } from 'react';
import Link from 'next/link';
import { DrawerShell } from '@/components/ui/drawer-shell';
import Image from 'next/image';
import { X, Check, XCircle as XIcon, Copy, Pencil, ExternalLink, Package, AlertTriangle, Loader2, ChevronDown } from 'lucide-react';
import { channelMeta } from '../channelMeta';
import ChannelLogo from '../ChannelLogo';
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

// Channel errors arrive as one long string with a JSON blob inside. Pull the
// readable sentences out so people see the actual reason instead of a wall of
// braces; the full raw text stays available under "Technical details".
function explainError(raw: string | null): { headline: string; messages: string[] } {
  if (!raw) return { headline: '', messages: [] };
  const brace = raw.indexOf('{');
  if (brace === -1) return { headline: '', messages: [raw.trim()] };
  const headline = raw.slice(0, brace).replace(/[:\s]+$/, '').trim();
  const seen = new Set<string>();
  const re = /"(?:longMessage|message)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const text = m[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim();
    if (text) seen.add(text);
  }
  return { headline, messages: Array.from(seen) };
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <h4 className="text-sm font-bold text-foreground">{title}</h4>
      {hint && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function ListingDrawer({ detail, loading, onClose }: {
  detail: ListingDetail | null; loading: boolean; onClose: () => void;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const meta = detail ? channelMeta(detail.channel_type) : null;
  const tips = detail ? fixTips(detail.error_message) : [];
  const issue = detail ? explainError(detail.error_message) : { headline: '', messages: [] as string[] };
  const hasIssue = !!detail && (detail.status === 'failed' || detail.status === 'warning') && !!detail.error_message;

  return (
    <DrawerShell onClose={onClose} width={480}>
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-5 py-4">
        <h2 className="font-bold text-foreground">Listing details</h2>
        <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading || !detail ? (
        <div className="flex flex-1 items-center justify-center gap-2 py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> <span className="text-sm">Loading…</span>
        </div>
      ) : (
        <>
          {/* Only this area scrolls, and only up and down: every block wraps
              its text instead of pushing the panel sideways. */}
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="flex flex-col gap-6 p-5">
              <div className="flex min-w-0 gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {detail.product_image_url ? (
                    <Image src={detail.product_image_url} alt={detail.product_name ?? ''} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center"><Package className="h-6 w-6 text-muted-foreground/40" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-3 break-words text-sm font-bold text-foreground">{detail.product_name ?? `Product #${detail.product_id ?? '—'}`}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={detail.status} />
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground">
                      <ChannelLogo channelType={detail.channel_type} size={14} /> {meta?.label}
                    </span>
                  </div>
                </div>
              </div>

              <dl className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-xl border border-border bg-muted/30 p-4 text-xs">
                <dt className="text-muted-foreground">SKU</dt><dd className="break-all font-semibold text-foreground">{detail.product_sku ?? '—'}</dd>
                <dt className="text-muted-foreground">Product ID</dt><dd className="font-semibold text-foreground">#{detail.product_id ?? '—'}</dd>
                <dt className="text-muted-foreground">Supplier</dt><dd className="font-semibold capitalize text-foreground">{detail.supplier_type ?? '—'}</dd>
                <dt className="text-muted-foreground">Store</dt><dd className="break-words font-semibold text-foreground">{detail.store_name}</dd>
                <dt className="text-muted-foreground">Activity</dt><dd className="font-semibold text-foreground">{ACTION_LABELS[detail.action] ?? detail.action}</dd>
              </dl>

              {hasIssue && (
                <div className="min-w-0 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex gap-2.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-destructive">{detail.status === 'failed' ? 'Sync failed' : 'Listed with warnings'}</p>
                      {issue.headline && <p className="mt-1 break-words text-xs font-medium text-foreground">{issue.headline}</p>}
                      {issue.messages.length > 0 ? (
                        <ul className="mt-2 flex flex-col gap-1.5">
                          {issue.messages.map((msg, i) => (
                            <li key={i} className="break-words text-xs leading-relaxed text-destructive/90 [overflow-wrap:anywhere]">{msg}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 break-words text-xs leading-relaxed text-destructive/90 [overflow-wrap:anywhere]">{detail.error_message}</p>
                      )}
                      {issue.messages.length > 0 && (
                        <>
                          <button type="button" onClick={() => setShowRaw((v) => !v)} className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
                            Technical details <ChevronDown className={`h-3 w-3 transition ${showRaw ? 'rotate-180' : ''}`} />
                          </button>
                          {showRaw && (
                            <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-all rounded-lg bg-card p-3 text-[11px] leading-relaxed text-muted-foreground">{detail.error_message}</pre>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tips.length > 0 && (
                <Section title="What needs fixing?">
                  <ol className="flex flex-col gap-2.5">
                    {tips.map((tip, i) => (
                      <li key={i} className="flex gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground">{i + 1}</span>
                        <p className="min-w-0 break-words text-xs leading-relaxed text-muted-foreground">{tip}</p>
                      </li>
                    ))}
                  </ol>
                </Section>
              )}

              <Section
                title="Attempt history"
                hint={detail.synthetic
                  ? "Custom Website has no push step — your storefront reads this product straight from the ExiusCart API whenever it loads. There's no sync attempt to record: as long as the product is active and Custom Website is connected, it's live."
                  : 'Real attempts recorded for this listing.'}
              >
                <div className="flex flex-col gap-4 border-l-2 border-border pl-4">
                  {detail.history.map((h, i) => {
                    const why = !h.success ? explainError(h.error_message) : null;
                    const reason = why ? (why.messages[0] ?? (why.headline || h.error_message)) : null;
                    return (
                      <div key={i} className="relative min-w-0">
                        <span className={`absolute -left-[25px] top-0 flex h-4 w-4 items-center justify-center rounded-full text-white ${h.success ? 'bg-green-500' : 'bg-destructive'}`}>
                          {h.success ? <Check className="h-2.5 w-2.5" /> : <XIcon className="h-2.5 w-2.5" />}
                        </span>
                        <p className="text-xs font-bold text-foreground">{h.success ? 'Succeeded' : 'Failed'}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{new Date(h.created_at).toLocaleString()}</p>
                        {reason && (
                          <p className="mt-1 line-clamp-3 break-words text-[11px] leading-relaxed text-destructive [overflow-wrap:anywhere]">{reason}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Section>
            </div>
          </div>

          {/* Actions stay in view while the details scroll. */}
          <div className="flex shrink-0 flex-col gap-2 border-t border-border bg-card p-4">
            {detail.product_id && (
              <Link href={`/dashboard/products?edit=${detail.product_id}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90">
                <Pencil className="h-4 w-4" /> Review & Retry
              </Link>
            )}
            {(detail.listing_url || detail.error_message) && (
              <div className="grid grid-cols-2 gap-2">
                {detail.listing_url && (
                  <a href={detail.listing_url} target="_blank" rel="noopener noreferrer"
                    className={`inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2.5 text-xs font-bold text-foreground transition hover:bg-muted ${detail.error_message ? '' : 'col-span-2'}`}>
                    Open live listing <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {detail.error_message && (
                  <button onClick={() => navigator.clipboard.writeText(detail.error_message ?? '')}
                    className={`inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2.5 text-xs font-bold text-foreground transition hover:bg-muted ${detail.listing_url ? '' : 'col-span-2'}`}>
                    <Copy className="h-3.5 w-3.5" /> Copy error
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </DrawerShell>
  );
}
