'use client';

import { useState, useEffect } from 'react';
import { Loader2, Star, CheckCircle2, XCircle, Trash2, MessageSquare, Copy, Check, Sparkles, Plus, X, ImageIcon } from 'lucide-react';
import { reviewsApi, productsApi } from '@/lib/api';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

function ReviewsEmbedBox() {
  const [copied, setCopied] = useState(false);
  const code = `<div data-exiuscart-reviews data-product-id="YOUR_PRODUCT_ID"></div>\n<script src="https://api.exiuscart.com/api/v1/widget/reviews.js" async></script>`;

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-muted/40 border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="text-sm font-medium text-foreground">Show reviews on your storefront</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Paste this on each product page (in your Custom Website HTML, or Shopify's product template). Replace{' '}
        <code className="text-foreground">YOUR_PRODUCT_ID</code> with the product's ID — find it in the URL when editing the product in ExiusCart.
      </p>
      <div className="flex items-start gap-2 bg-background border border-border rounded-lg px-3 py-2.5">
        <pre className="text-xs text-foreground flex-1 overflow-x-auto whitespace-pre-wrap break-all">{code}</pre>
        <button onClick={copy} className="shrink-0 p-1.5 hover:bg-muted rounded-lg transition">
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
        </button>
      </div>
    </div>
  );
}

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
  manual: 'Manually added',
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

interface SimpleProduct { id: number; name: string; sku?: string | null; }

export default function ReviewsPage() {
  const [shopId, setShopId] = useState('');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, avg_rating: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | ''>('pending');
  const [actingId, setActingId] = useState<number | null>(null);

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
      .then((r) => { setReviews(r.data?.reviews ?? []); setStats(r.data?.stats ?? stats); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [shopId, filter]);

  useEffect(() => {
    if (!shopId) return;
    productsApi.getAll(shopId).then((r) => {
      setProducts((r.data ?? []).map((p: any) => ({ id: p.id, name: p.name, sku: p.sku })));
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
    if (!confirm('Delete this review permanently?')) return;
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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Product Reviews</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reviews are requested automatically when an order is marked delivered. Approve reviews to show them on your storefront.
          </p>
        </div>
        <button onClick={openAddModal}
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
          <Plus className="w-4 h-4" /> Add Review
        </button>
      </div>

      <ReviewsEmbedBox />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border border-border rounded-xl bg-card p-4">
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total reviews</p>
        </div>
        <div className="border border-amber-500/30 rounded-xl bg-amber-500/5 p-4">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Awaiting moderation</p>
        </div>
        <div className="border border-green-500/30 rounded-xl bg-green-500/5 p-4">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.approved}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Live on storefront</p>
        </div>
        <div className="border border-border rounded-xl bg-card p-4">
          <div className="flex items-center gap-1.5">
            <p className="text-2xl font-bold text-foreground">{stats.avg_rating || '—'}</p>
            {stats.avg_rating > 0 && <Star className="w-4 h-4 fill-amber-400 text-amber-400 mb-1" />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Average rating</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-border">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition -mb-px ${
              filter === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading reviews...</span>
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <MessageSquare className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm">No reviews here yet.</p>
          <p className="text-muted-foreground/60 text-xs mt-1">
            Reviews appear once customers respond to the request email sent after delivery.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="border border-border rounded-xl bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{r.product_name}</p>
                    {r.status === 'requested' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Awaiting customer</span>
                    )}
                    {r.channel_source && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        {CHANNEL_LABELS[r.channel_source] ?? r.channel_source}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.customer_name || 'Customer'}</p>
                  {r.rating != null && <div className="mt-2"><Stars rating={r.rating} /></div>}
                  {r.comment && <p className="text-sm text-foreground/90 mt-2 leading-relaxed">{r.comment}</p>}
                  {r.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photo_url} alt="Review" className="w-20 h-20 rounded-lg object-cover mt-2 border border-border" />
                  )}
                </div>

                {r.status === 'pending' && (
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => act(r.id, 'approved')} disabled={actingId === r.id}
                      className="p-2 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition disabled:opacity-50" title="Approve">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => act(r.id, 'rejected')} disabled={actingId === r.id}
                      className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition disabled:opacity-50" title="Reject">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {(r.status === 'approved' || r.status === 'rejected') && (
                  <button onClick={() => remove(r.id)} disabled={actingId === r.id}
                    className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition disabled:opacity-50 shrink-0" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <p className="font-semibold text-foreground">Add a review</p>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground -mt-1">
                For a real sale ExiusCart never saw as an order — a POS cash sale, a WhatsApp order — where you already have the
                customer's actual words. This goes live immediately, no separate approval step.
              </p>

              {addError && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">{addError}</div>
              )}

              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Product *</label>
                <select value={addProductId} onChange={(e) => setAddProductId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm">
                  <option value="">Select a product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.sku ? ` — SKU: ${p.sku}` : ` — #${p.id}`}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Customer name *</label>
                <input type="text" value={addCustomerName} onChange={(e) => setAddCustomerName(e.target.value)}
                  placeholder="e.g. Priya S."
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm" />
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Rating</label>
                <StarPicker value={addRating} onChange={setAddRating} />
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">What they said</label>
                <textarea value={addComment} onChange={(e) => setAddComment(e.target.value)} rows={3}
                  placeholder="Transcribe their actual words — from the chat, or what they told you in person"
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm resize-none" />
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Photo (optional)</label>
                {addPhotoPreview ? (
                  <div className="relative w-20 h-20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={addPhotoPreview} alt="Preview" className="w-20 h-20 rounded-lg object-cover border border-border" />
                    <button type="button" onClick={() => { setAddPhotoFile(null); setAddPhotoPreview(''); }}
                      className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition cursor-pointer">
                    <ImageIcon className="w-3.5 h-3.5" /> Upload photo
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAddPhotoSelect} />
                  </label>
                )}
              </div>

              <button onClick={submitManualReview} disabled={addSaving || !addProductId || !addCustomerName.trim()}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
                {addSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {addSaving ? 'Saving...' : 'Add Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
