'use client';

import { useState, useEffect } from 'react';
import { Link2, Loader2, AlertTriangle, CheckCircle2, Clock, Wallet, Tag, Calendar } from 'lucide-react';
import { channelsApi } from '@/lib/api';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface ChannelConnection {
  id: number;
  channel_type: string;
  channel_seller_id?: string;
  is_active: boolean;
  last_synced_at?: string;
}

interface TheDersiInfo {
  seller_id: string;
  shop_name: string;
  plan: string;
  plan_label: string;
  commission_rate: number;
  payout_schedule: string;
  earnings_balance: number;
  currency: string;
  next_payout_date: string;
  payout_overdue: boolean;
}

function fmt(n: number) {
  return n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TheDersiCard({ connection, shopId }: { connection: ChannelConnection; shopId: string }) {
  const [info, setInfo] = useState<TheDersiInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    channelsApi.getTheDersiInfo(shopId, connection.id)
      .then((r) => setInfo(r.data))
      .catch(() => setError('Could not load earnings data.'))
      .finally(() => setLoading(false));
  }, [shopId, connection.id]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Link2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">TheDersi</p>
            <p className="text-xs text-muted-foreground">Sri Lankan Fashion Marketplace</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-3 h-3" /> Connected
        </span>
      </div>

      {/* Body */}
      <div className="p-5">
        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading earnings...</span>
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-muted-foreground text-center py-6">{error}</p>
        )}

        {info && !loading && (
          <div className="space-y-4">
            {/* Earnings balance — hero stat */}
            <div className="bg-muted/50 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wallet className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Pending Earnings</p>
                  <p className="text-xl font-bold text-foreground">
                    {info.currency} {fmt(info.earnings_balance)}
                  </p>
                </div>
              </div>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Plan & commission */}
              <div className="bg-muted/40 rounded-lg p-3 flex items-start gap-2.5">
                <Tag className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="text-sm font-medium text-foreground">
                    {info.plan_label}
                  </p>
                  <p className="text-xs text-muted-foreground">{info.commission_rate}% commission</p>
                </div>
              </div>

              {/* Payout schedule */}
              <div className="bg-muted/40 rounded-lg p-3 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Payout Schedule</p>
                  <p className="text-sm font-medium text-foreground">{info.payout_schedule}</p>
                </div>
              </div>

              {/* Next payout date */}
              <div className={`rounded-lg p-3 flex items-start gap-2.5 ${info.payout_overdue ? 'bg-red-500/10' : 'bg-muted/40'}`}>
                <Calendar className={`w-4 h-4 mt-0.5 shrink-0 ${info.payout_overdue ? 'text-red-500' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-xs text-muted-foreground">Next Payout</p>
                  <p className={`text-sm font-medium ${info.payout_overdue ? 'text-red-500' : 'text-foreground'}`}>
                    {info.next_payout_date}
                  </p>
                  {info.payout_overdue && (
                    <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                      <AlertTriangle className="w-3 h-3" /> Overdue
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChannelsPage() {
  const [shopId, setShopId] = useState('');
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  useEffect(() => {
    if (!shopId) return;
    channelsApi.getConnections(shopId)
      .then((r) => setConnections(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shopId]);

  const theDersiConnections = connections.filter(
    (c) => c.channel_type === 'thedersi' && c.is_active
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Connected Channels</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Marketplaces and stores connected to your ExiusCart account.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading channels...</span>
        </div>
      )}

      {!loading && connections.length === 0 && (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Link2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No channels connected</p>
          <p className="text-xs text-muted-foreground mt-1">
            Connect TheDersi or another marketplace to start selling.
          </p>
        </div>
      )}

      {!loading && theDersiConnections.map((conn) => (
        <TheDersiCard key={conn.id} connection={conn} shopId={shopId!} />
      ))}
    </div>
  );
}
