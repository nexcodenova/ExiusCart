'use client';

import { useState, useEffect } from 'react';
import {
  Loader2, AlertTriangle, CheckCircle2, Clock,
  Wallet, Tag, Calendar, Lock, TrendingUp, History,
  Link2, ArrowRight,
} from 'lucide-react';
import { channelsApi } from '@/lib/api';
import Link from 'next/link';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface ChannelConnection {
  id: number;
  channel_type: string;
  webhook_url: string;
}

interface TheDersiInfo {
  plan_label: string;
  commission_rate: number;
  payout_schedule: string;
  earnings_balance: number;
  held_amount: number;
  available_amount: number;
  total_earned_lifetime: number;
  currency: string;
  next_payout_date: string;
  payout_overdue: boolean;
}

interface PayoutRecord {
  reference: string;
  amount: number;
  status: string;
  date: string;
  period_start: string;
  period_end: string;
}

function fmt(n: number) {
  return n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TheDersiPayoutPanel({ connection, shopId }: { connection: ChannelConnection; shopId: string }) {
  const [info, setInfo] = useState<TheDersiInfo | null>(null);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [payoutsLoading, setPayoutsLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [payoutSuccess, setPayoutSuccess] = useState('');
  const [payoutError, setPayoutError] = useState('');
  const [error, setError] = useState('');

  const loadPayouts = () => {
    setPayoutsLoading(true);
    channelsApi.getTheDersiPayouts(shopId, connection.id)
      .then((r) => setPayouts(r.data ?? []))
      .catch(() => {})
      .finally(() => setPayoutsLoading(false));
  };

  useEffect(() => {
    channelsApi.getTheDersiInfo(shopId, connection.id)
      .then((r) => setInfo(r.data))
      .catch(() => setError('Could not load earnings data from TheDersi.'))
      .finally(() => setLoading(false));
    loadPayouts();
  }, [shopId, connection.id]);

  const handleRequestPayout = async () => {
    setRequesting(true);
    setPayoutError('');
    setPayoutSuccess('');
    try {
      const r = await channelsApi.requestTheDersiPayout(shopId, connection.id);
      const amount = r.data?.requested_amount;
      const currency = r.data?.currency ?? info?.currency ?? 'LKR';
      setPayoutSuccess(`Payout request submitted — ${currency} ${fmt(amount)}. TheDersi will process it on your next payout date.`);
      loadPayouts();
    } catch (err: any) {
      setPayoutError(err?.response?.data?.detail ?? 'Could not submit payout request. Try again.');
    } finally {
      setRequesting(false);
    }
  };

  const hasPending = payouts.some((p) => p.status === 'pending');

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

      <div className="p-5 space-y-5">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading earnings from TheDersi...
          </div>
        )}
        {error && !loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" /> {error}
          </div>
        )}

        {info && !loading && (
          <div className="space-y-5">
            {/* Earnings breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <p className="text-xs text-green-700 dark:text-green-400 font-medium">Available</p>
                </div>
                <p className="text-xl font-bold text-green-700 dark:text-green-300">
                  {info.currency} {fmt(info.available_amount ?? info.earnings_balance)}
                </p>
                <p className="text-xs text-green-600/70 dark:text-green-500 mt-0.5">Ready for payout</p>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">On Hold</p>
                </div>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                  {info.currency} {fmt(info.held_amount ?? 0)}
                </p>
                <p className="text-xs text-amber-600/70 dark:text-amber-500 mt-0.5">7-day hold from order date</p>
              </div>

              <div className="bg-muted/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground font-medium">All-time Earned</p>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {info.currency} {fmt(info.total_earned_lifetime ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Including past payouts</p>
              </div>
            </div>

            {/* Request Payout */}
            {payoutSuccess && (
              <div className="bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> {payoutSuccess}
              </div>
            )}
            {payoutError && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-xl px-4 py-3">
                {payoutError}
              </div>
            )}
            <button
              type="button"
              onClick={handleRequestPayout}
              disabled={requesting || (info?.available_amount ?? 0) <= 0 || hasPending}
              className="w-full py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {requesting && <Loader2 className="w-4 h-4 animate-spin" />}
              {hasPending
                ? '⏳ Payout Request Pending'
                : (info?.available_amount ?? 0) <= 0
                ? 'No Balance Available'
                : `Request Payout — ${info.currency} ${fmt(info.available_amount ?? 0)}`}
            </button>

            {/* Plan / Schedule / Next payout */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-muted/40 rounded-lg p-3 flex items-start gap-2.5">
                <Tag className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="text-sm font-medium text-foreground">{info.plan_label}</p>
                  <p className="text-xs text-muted-foreground">{info.commission_rate}% commission</p>
                </div>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Payout Schedule</p>
                  <p className="text-sm font-medium text-foreground">{info.payout_schedule}</p>
                  <p className="text-xs text-muted-foreground">
                    {info.plan_label === 'Pro' ? 'Every Monday' : 'Every 2nd Monday'}
                  </p>
                </div>
              </div>
              <div className={`rounded-lg p-3 flex items-start gap-2.5 ${info.payout_overdue ? 'bg-red-500/10' : 'bg-muted/40'}`}>
                <Calendar className={`w-4 h-4 mt-0.5 shrink-0 ${info.payout_overdue ? 'text-red-500' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-xs text-muted-foreground">Next Payout</p>
                  <p className={`text-sm font-medium ${info.payout_overdue ? 'text-red-500' : 'text-foreground'}`}>
                    {new Date(info.next_payout_date).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {info.payout_overdue && (
                    <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                      <AlertTriangle className="w-3 h-3" /> Overdue
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Payout history */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Payout History</p>
              </div>
              {payoutsLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
                </div>
              ) : payouts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No payouts yet.</p>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        {['Reference', 'Period', 'Amount', 'Status'].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {payouts.map((p) => (
                        <tr key={p.reference} className="hover:bg-muted/30 transition">
                          <td className="px-4 py-3 font-mono text-xs text-foreground">{p.reference}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {p.period_start && p.period_end ? (
                              <>
                                {new Date(p.period_start).toLocaleDateString('en-LK', { day: 'numeric', month: 'short' })}
                                {' – '}
                                {new Date(p.period_end).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </>
                            ) : (
                              new Date(p.date).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })
                            )}
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {info.currency} {fmt(p.amount)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              p.status === 'paid'
                                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            }`}>
                              {p.status === 'paid' ? '✅ Paid' : '⏳ Processing'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PayoutPage() {
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

  const theDersiConns = connections.filter((c) => c.channel_type === 'thedersi');
  const hasAnyChannel = connections.length > 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Payouts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View your earnings and request payouts from connected sales channels.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading payouts...</span>
        </div>
      ) : !hasAnyChannel ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <Wallet className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">No channels connected</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Connect a sales channel like TheDersi to start receiving payouts here.
            </p>
          </div>
          <Link href="/dashboard/channels"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition">
            Go to Channels <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {theDersiConns.map((conn) => (
            <TheDersiPayoutPanel key={conn.id} connection={conn} shopId={shopId} />
          ))}
        </div>
      )}
    </div>
  );
}
