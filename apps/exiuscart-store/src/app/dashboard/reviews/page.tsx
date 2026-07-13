'use client';

import { useState, useEffect } from 'react';
import { Loader2, Star, CheckCircle2, XCircle, Trash2, MessageSquare } from 'lucide-react';
import { reviewsApi } from '@/lib/api';

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
  created_at: string;
  submitted_at: string | null;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const [shopId, setShopId] = useState('');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, avg_rating: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | ''>('pending');
  const [actingId, setActingId] = useState<number | null>(null);

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
      <div>
        <h1 className="text-xl font-semibold text-foreground">Product Reviews</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Reviews are requested automatically when an order is marked delivered. Approve reviews to show them on your storefront.
        </p>
      </div>

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
    </div>
  );
}
