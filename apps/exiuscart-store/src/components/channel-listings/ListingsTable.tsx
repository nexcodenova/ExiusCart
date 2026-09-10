import Image from 'next/image';
import Link from 'next/link';
import { Package, ExternalLink, MoreHorizontal, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { channelMeta } from './channelMeta';
import ChannelLogo from './ChannelLogo';
import StatusBadge, { ListingStatus } from './StatusBadge';

export interface ListingRow {
  id: number;
  product_id: number | null;
  product_name: string | null;
  product_sku: string | null;
  product_image_url: string | null;
  channel_type: string;
  store_name: string;
  action: string;
  status: ListingStatus;
  external_id: string | null;
  listing_url: string | null;
  error_message: string | null;
  attempt_number: number;
  created_at: string;
  synthetic?: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  create_listing: 'Create Listing', update_stock: 'Update Stock', update_price: 'Update Price',
  sync_order: 'Sync Order', listing_status: 'Listing Status', listing: 'Listing', available: 'Available',
};

export default function ListingsTable({
  rows, total, page, pageSize, onPageChange, onOpenDetail, hasActiveFilters,
}: {
  rows: ListingRow[]; total: number; page: number; pageSize: number;
  onPageChange: (p: number) => void; onOpenDetail: (id: number) => void;
  hasActiveFilters: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <p className="text-sm font-semibold text-foreground">
          {total === 0 ? '0 results' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total} results`}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="p-16 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          {hasActiveFilters ? (
            <>
              <h3 className="font-semibold text-foreground mb-1">No activity matches these filters</h3>
              <p className="text-sm text-muted-foreground">Try widening your date range or clearing a filter.</p>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-foreground mb-1">No listing activity yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                This fills up the moment you list a product on a connected channel (or a product gets rejected, stock syncs, etc.) — nothing's happened here yet.
              </p>
              <Link href="/dashboard/products" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:opacity-80 mt-4">
                Go list a product <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {['Product', 'Channel', 'Activity', 'Status', 'Result / failure reason', 'Attempt', 'Completed', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const meta = channelMeta(r.channel_type);
                return (
                  <tr key={r.id}
                    className={`cursor-pointer hover:bg-muted/30 transition ${r.status === 'failed' ? 'border-l-2 border-l-destructive' : ''}`}
                    onClick={() => onOpenDetail(r.id)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative w-9 h-9 rounded-lg bg-muted overflow-hidden shrink-0">
                          {r.product_image_url ? (
                            <Image src={r.product_image_url} alt="" fill className="object-cover" unoptimized />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center"><Package className="w-3.5 h-3.5 text-muted-foreground/40" /></div>
                          )}
                        </div>
                        <div className="max-w-[180px]">
                          <p className="text-xs font-bold text-foreground line-clamp-2">{r.product_name ?? '—'}</p>
                          {r.product_sku && <p className="text-[11px] text-muted-foreground mt-0.5">SKU: {r.product_sku}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {meta.wide ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-muted/60">
                          <ChannelLogo channelType={r.channel_type} size={16} />
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full ${meta.bg} ${meta.color}`}>
                          <ChannelLogo channelType={r.channel_type} size={12} /> {meta.label}
                        </span>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {r.store_name}{r.synthetic ? ' · via API' : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{ACTION_LABELS[r.action] ?? r.action}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="text-xs text-muted-foreground line-clamp-2">{r.error_message ?? (r.status === 'success' ? 'Completed successfully.' : '—')}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">#{r.attempt_number}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        {(r.status === 'failed' || r.status === 'warning') && r.product_id && (
                          <Link href={`/dashboard/products?edit=${r.product_id}`}
                            className="rounded-md bg-primary text-primary-foreground px-2.5 py-1 text-[11px] font-semibold hover:bg-primary/90 transition whitespace-nowrap">
                            Fix issue
                          </Link>
                        )}
                        {r.listing_url && (
                          <a href={r.listing_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:opacity-80 whitespace-nowrap">
                            Open <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <button onClick={() => onOpenDetail(r.id)} className="rounded p-1 hover:bg-muted text-muted-foreground shrink-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-1.5 px-4 py-3 border-t border-border">
          <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}
            className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .map((p, i, arr) => (
              <span key={p} className="flex items-center gap-1.5">
                {i > 0 && arr[i - 1] !== p - 1 && <span className="text-muted-foreground text-xs px-1">…</span>}
                <button onClick={() => onPageChange(p)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${p === page ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}>
                  {p}
                </button>
              </span>
            ))}
          <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
