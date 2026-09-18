'use client';

import { useEffect, useState } from 'react';
import { Plus, Loader2, Users2 } from 'lucide-react';
import { customerSegmentsApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import SegmentCard, { Segment } from '@/components/customer-segments/SegmentCard';
import SegmentModal from '@/components/customer-segments/SegmentModal';
import MarketingHubLockScreen from '@/components/marketing/MarketingHubLockScreen';

function shopIdFromStorage() { return typeof window !== 'undefined' ? localStorage.getItem('shop_id') || '1' : '1'; }

export default function CustomerSegmentsPage() {
  const { fmt, sym } = useCurrency();
  const [shopId, setShopId] = useState('');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableSources, setAvailableSources] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Segment | null>(null);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const load = (sid: string) => {
    setLoading(true);
    Promise.all([
      customerSegmentsApi.list(sid),
      customerSegmentsApi.filterOptions(sid),
    ]).then(([segRes, optRes]) => {
      setSegments(segRes.data ?? []);
      setAvailableTags(optRes.data?.tags ?? []);
      setAvailableSources(optRes.data?.sources ?? []);
    }).catch((e: any) => {
      if (e?.response?.data?.detail?.error === 'not_available') setLocked(true);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { if (shopId) load(shopId); }, [shopId]);

  const openNew = () => { setEditing(null); setShowModal(true); };
  const openEdit = (s: Segment) => { setEditing(s); setShowModal(true); };
  const handleSaved = () => { setShowModal(false); load(shopId); };

  if (!loading && locked) {
    return <MarketingHubLockScreen title="Customer Segments" description="Available on TheDersi Lite, Pro, and Official." />;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Segments</h1>
          <p className="text-sm text-muted-foreground mt-1">Group customers by tags, source, order count, or lifetime value — for targeted campaigns.</p>
        </div>
        <Button onClick={openNew} className="shrink-0"><Plus className="w-4 h-4" /> New Segment</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
      ) : segments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-20 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <Users2 className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">No segments yet</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
              Build your first segment — like "VIP customers" (LTV over {fmt(500)}) or "Wholesale" (tagged accordingly) — to target campaigns more precisely.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {segments.map((s) => (
            <SegmentCard key={s.id} segment={s} shopId={shopId} fmt={fmt} onEdit={() => openEdit(s)} onDeleted={() => load(shopId)} />
          ))}
        </div>
      )}

      {showModal && (
        <SegmentModal
          shopId={shopId} editing={editing} availableTags={availableTags} availableSources={availableSources}
          currencySymbol={sym} onClose={() => setShowModal(false)} onSaved={handleSaved}
        />
      )}
    </div>
  );
}
