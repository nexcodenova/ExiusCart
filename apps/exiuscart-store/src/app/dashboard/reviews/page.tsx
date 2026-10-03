'use client';

import { useState, useEffect } from 'react';
import { Loader2, Star, CheckCircle2, XCircle, Trash2, MessageSquare, Plus, X, ImageIcon, ChevronDown, Search, Check } from 'lucide-react';
import { reviewsApi, productsApi } from '@/lib/api';
import SectionBanner from '@/components/directory/SectionBanner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useConfirm } from '@/components/ui/confirm-dialog';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface Review {
  id: number;
  product_id: number;
  product_name: string;
  customer_name: string | null;
  rating: number | null;
  comment: string | null;
  photo_url: string | null;
  status: string;
  channel_source: string | null;
  created_at: string;
  submitted_at: string | null;
}

const CHANNEL_LABELS: Record<string, string> = {
  custom: 'Custom Website',
  pos: 'POS',
  online: 'Online',
  whatsapp: 'WhatsApp',
  shopify: 'Shopify',
  manual: 'Added by you',
  aliexpress: 'From AliExpress',
};

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
      ))}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" onClick={() => onChange(i)} className="p-0.5">
          <Star className={`w-6 h-6 transition ${i <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30 hover:text-amber-400/50'}`} />
        </button>
      ))}
    </div>
  );
}

interface SimpleProduct { id: number; name: string; sku?: string | null; image?: string | null; }

// Searchable product picker: photo + name, no internal ids.
function ProductPicker({ products, value, onChange }: { products: SimpleProduct[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const picked = products.find((p) => String(p.id) === value);
  const shown = products.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 50);
  const Thumb = ({ p }: { p: SimpleProduct }) => (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />}
    </span>
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="flex h-11 w-full items-center gap-2.5 rounded-md border border-border bg-background px-2 text-left text-sm transition hover:bg-muted/40">
          {picked ? <><Thumb p={picked} /><span className="min-w-0 flex-1 truncate text-foreground">{picked.name}</span></>
            : <span className="flex-1 px-1 text-muted-foreground">Choose a product…</span>}
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products"
            className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {shown.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">No products found</p>
          ) : shown.map((p) => (
            <button key={p.id} type="button" onClick={() => { onChange(String(p.id)); setOpen(false); setQ(''); }}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-muted">
              <Thumb p={p} />
              <span className="min-w-0 flex-1 truncate text-foreground">{p.name}</span>
              {String(p.id) === value && <Check className="h-4 w-4 text-foreground" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function ReviewsPage() {
  const confirm = useConfirm();
  const [shopId, setShopId] = useState('');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, avg_rating: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | ''>('pending');
  const [actingId, setActingId] = useState<number | null>(null);
  const [blockedMessage, setBlockedMessage] = useState('');

  // Manual add — for real sales ExiusCart never saw as an order (POS cash
  // sale, a WhatsApp order), where the seller already has the customer's
  // actual words and is transcribing them, not inventing them.
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addProductId, setAddProductId] = useState('');
  const [addCustomerName, setAddCustomerName] = useState('');
  const [addRating, setAddRating] = useState(5);
  const [addComment, setAddComment] = useState('');
  const [addPhotoFile, setAddPhotoFile] = useState<File | null>(null);
  const [addPhotoPreview, setAddPhotoPreview] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const load = () => {
    if (!shopId) return;
    setLoading(true);
    reviewsApi.list(shopId, { status: filter || undefined })
      .then((r) => { setReviews(r.data?.reviews ?? []); setStats(r.data?.stats ?? stats); setBlockedMessage(''); })
      .catch((err) => {
        if (err?.response?.status === 403) setBlockedMessage(err.response.data?.detail?.message ?? 'Product reviews are not available on your plan.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [shopId, filter]);

  useEffect(() => {
    if (!shopId) return;
    productsApi.getAll(shopId).then((r) => {
      setProducts((r.data ?? []).map((p: any) => ({ id: p.id, name: p.name, sku: p.sku, image: p.image_url ?? p.images?.[0]?.url ?? null })));
    }).catch(() => {});
  }, [shopId]);

  const resetAddForm = () => {
    setAddProductId(''); setAddCustomerName(''); setAddRating(5); setAddComment('');
    setAddPhotoFile(null); setAddPhotoPreview(''); setAddError('');
  };

  const openAddModal = () => { resetAddForm(); setShowAddModal(true); };

  const handleAddPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAddPhotoFile(file);
    setAddPhotoPreview(URL.createObjectURL(file));
  };

  const submitManualReview = async () => {
    if (!addProductId || !addCustomerName.trim()) {
      setAddError('Product and customer name are required.');
      return;
    }
    setAddSaving(true);
    setAddError('');
    try {
      let photoUrl: string | undefined;
      if (addPhotoFile) {
        photoUrl = await reviewsApi.uploadManualPhoto(shopId, Number(addProductId), addPhotoFile);
      }
      await reviewsApi.addManual(shopId, {
        product_id: Number(addProductId),
        customer_name: addCustomerName.trim(),
        rating: addRating,
        comment: addComment.trim() || undefined,
        photo_url: photoUrl,
        // Not asked in the form — tagged automatically so it's still
        // honestly distinguishable in your own dashboard from a review
        // that actually came through the request/submit flow.
        channel_source: 'manual',
      });
      setShowAddModal(false);
      // The new review is created already-approved — switch there so it's
      // actually visible instead of silently landing under a filter that's
      // currently showing something else.
      setFilter('approved');
      load();
    } catch (err: any) {
      setAddError(err?.response?.data?.detail ?? 'Could not save. Try again.');
    } finally {
      setAddSaving(false);
    }
  };

  const act = async (id: number, status: 'approved' | 'rejected') => {
    setActingId(id);
    try {
      await reviewsApi.moderate(shopId, id, status);
      load();
    } finally { setActingId(null); }
  };

  const remove = async (id: number) => {
    if (!(await confirm({ title: 'Delete this review permanently?', variant: 'destructive' }))) return;
    setActingId(id);
    try {
      await reviewsApi.remove(shopId, id);
      load();
    } finally { setActingId(null); }
  };

  const TABS: { key: 'pending' | 'approved' | 'rejected' | ''; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: '', label: 'All' },
  ];

  if (blockedMessage) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Product reviews</h1>
        <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <MessageSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">Not available on your plan</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{blockedMessage}</p>
        </div>
      </div>
    );
  }

  const tabCount = (k: string) => (k === 'pending' ? stats.pending : k === 'approved' ? stats.approved : k === '' ? stats.total : null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Product reviews</h1>
          <p className="mt-1 text-sm text-muted-foreground">Collect real reviews from buyers, approve the good ones, and show them on your storefront.</p>
        </div>
        <button onClick={openAddModal}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-foreground px-3.5 text-sm font-medium text-background transition hover:opacity-90">
          <Plus className="h-4 w-4" /> Add review
        </button>
      </div>

      <SectionBanner
        title="Reviews that sell for you"
        description="When an order is marked delivered, the buyer gets one email asking them to rate what they bought. You approve each review before it goes live."
        actionLabel="Add a review by hand" onAction={openAddModal} variant={2}
      />

      {/* How it works — three plain steps */}
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { n: 1, t: 'Order delivered', d: 'The buyer gets a review email automatically, once per order.' },
          { n: 2, t: 'You approve', d: 'New reviews wait under Pending until you approve or reject them.' },
          { n: 3, t: 'Live on your store', d: 'Approved reviews show on your Custom Website through the reviews widget.' },
        ].map((x) => (
          <div key={x.n} className="flex gap-3 rounded-xl border border-border bg-card p-4">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium text-foreground">{x.n}</span>
            <div>
              <p className="text-sm font-medium text-foreground">{x.t}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{x.d}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="-mt-3 text-[11px] text-muted-foreground">
        Marketplace orders (eBay, Daraz, Amazon, TikTok Shop, TheDersi) don&apos;t get our email: those buyers review on the marketplace itself.
        Products you import from AliExpress bring their real AliExpress reviews here as Pending, labelled &ldquo;from AliExpress&rdquo;.
        Widget code for your Custom Website is in the{' '}
        <a href="https://exiuscart.com/developers" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline-offset-2 hover:underline">developer docs</a>.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total reviews', value: String(stats.total), dot: 'bg-muted-foreground/50' },
          { label: 'Awaiting approval', value: String(stats.pending), dot: 'bg-amber-500' },
          { label: 'Live on storefront', value: String(stats.approved), dot: 'bg-emerald-500' },
          { label: 'Average rating', value: stats.avg_rating ? `${stats.avg_rating} ★` : '—', dot: 'bg-amber-400' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />{c.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-6 border-b border-border">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`-mb-px border-b-2 pb-2.5 text-sm font-medium transition ${
              filter === t.key ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {t.label}
            {tabCount(t.key) !== null && <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{tabCount(t.key)}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading reviews...</span>
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-14 text-center">
          <MessageSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">No reviews here yet</p>
          <p className="mt-1 text-xs text-muted-foreground">They appear once buyers answer the email sent after delivery.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {reviews.map((r) => (
            <li key={r.id} className="flex items-start gap-4 px-5 py-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50 text-[11px] font-medium text-muted-foreground">
                {(r.customer_name || 'C').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-[13px] font-medium text-foreground">{r.customer_name || 'Customer'}</p>
                  {r.rating != null && <Stars rating={r.rating} />}
                  {r.status === 'requested' && <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">Waiting for the buyer</span>}
                  {r.channel_source && (
                    <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">{CHANNEL_LABELS[r.channel_source] ?? r.channel_source}</span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.product_name} <span className="font-mono">#{r.product_id}</span></p>
                {r.comment && <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{r.comment}</p>}
                {r.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.photo_url} alt="Review" className="mt-2 h-16 w-16 rounded-md border border-border object-cover" />
                )}
              </div>
              {r.status === 'pending' && (
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => act(r.id, 'approved')} disabled={actingId === r.id}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-50">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Approve
                  </button>
                  <button onClick={() => act(r.id, 'rejected')} disabled={actingId === r.id}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50">
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              )}
              {(r.status === 'approved' || r.status === 'rejected') && (
                <button onClick={() => remove(r.id)} disabled={actingId === r.id} title="Delete"
                  className="shrink-0 rounded-md p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <p className="font-semibold text-foreground">Add a review</p>
                <p className="mt-0.5 text-xs text-muted-foreground">For a real sale outside ExiusCart (a cash sale, a WhatsApp order). Write the buyer&apos;s own words. It goes live straight away.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-4">
              {addError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{addError}</div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-foreground">Product</label>
                  <ProductPicker products={products} value={addProductId} onChange={setAddProductId} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">Buyer&apos;s name</label>
                  <input type="text" value={addCustomerName} onChange={(e) => setAddCustomerName(e.target.value)}
                    placeholder="e.g. Priya S."
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">Rating</label>
                  <div className="flex h-9 items-center gap-2">
                    <StarPicker value={addRating} onChange={setAddRating} />
                    <span className="text-xs text-muted-foreground">{['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][addRating]}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">What they said</label>
                <textarea value={addComment} onChange={(e) => setAddComment(e.target.value)} rows={4} maxLength={2000}
                  placeholder="Their words, from the chat or what they told you"
                  className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30" />
                <p className="mt-1 text-right text-[11px] text-muted-foreground">{addComment.length}/2000</p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Photo <span className="font-normal text-muted-foreground">(optional)</span></label>
                {addPhotoPreview ? (
                  <div className="relative h-20 w-20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={addPhotoPreview} alt="Preview" className="h-20 w-20 rounded-md border border-border object-cover" />
                    <button type="button" onClick={() => { setAddPhotoFile(null); setAddPhotoPreview(''); }}
                      className="absolute -right-2 -top-2 rounded-full bg-foreground p-1 text-background" aria-label="Remove photo">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground transition hover:bg-muted/40 hover:text-foreground">
                    <ImageIcon className="h-4 w-4" /> Upload a photo (JPG, PNG or WebP)
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAddPhotoSelect} />
                  </label>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3">
              <button onClick={() => setShowAddModal(false)}
                className="h-9 rounded-md border border-border bg-background px-3.5 text-sm font-medium text-foreground transition hover:bg-muted">Cancel</button>
              <button onClick={submitManualReview} disabled={addSaving || !addProductId || !addCustomerName.trim()}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-3.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50">
                {addSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {addSaving ? 'Saving…' : 'Add review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
