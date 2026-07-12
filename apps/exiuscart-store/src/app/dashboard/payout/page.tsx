'use client';

import { useState, useEffect } from 'react';
import {
  Loader2, AlertTriangle, CheckCircle2, Clock,
  Wallet, Tag, Calendar, Lock, TrendingUp, History,
  Link2, ArrowRight, ShoppingCart, RefreshCcw, BarChart3,
} from 'lucide-react';
import { channelsApi, reportsApi } from '@/lib/api';
import Link from 'next/link';
import { useCurrency } from '@/components/providers/currency-provider';

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
  payout_note?: string;
}

interface PayoutRecord {
  reference: string;
  amount: number;
  status: string;
  date: string;
  period_start: string;
  period_end: string;
}

interface FinancialSummary {
  pos_revenue: number;
  pos_orders: number;
  channel_revenue: number;
  channel_orders: number;
  refund_amount: number;
  pos_refund_amount: number;
  channel_refund_amount: number;
  cancelled_orders: number;
}

function fmtNum(n: number) {
  return n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── POS Earnings Panel ────────────────────────────────────────────────────────

function POSEarningsPanel({ shopId }: { shopId: string }) {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const { fmt, sym } = useCurrency();

  useEffect(() => {
    if (!shopId) return;
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const to = now.toISOString().split('T')[0];
    reportsApi.getFinancialSummary(shopId, { from, to })
      .then((r) => setSummary(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shopId]);

  const avg = summary && summary.pos_orders > 0 ? summary.pos_revenue / summary.pos_orders : 0;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <ShoppingCart className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">POS — Direct Sales</p>
            <p className="text-xs text-muted-foreground">Cash &amp; card sales this month</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <CheckCircle2 className="w-3 h-3" /> Always Active
        </span>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading POS earnings...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">POS Revenue</p>
                </div>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                  {sym} {fmtNum(summary?.pos_revenue ?? 0)}
                </p>
                <p className="text-xs text-blue-600/70 dark:text-blue-500 mt-0.5">Paid directly to you</p>
              </div>

              <div className="bg-muted/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground font-medium">POS Orders</p>
                </div>
                <p className="text-xl font-bold text-foreground">{summary?.pos_orders ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">This month</p>
              </div>

              <div className="bg-muted/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground font-medium">Avg Order</p>
                </div>
                <p className="text-xl font-bold text-foreground">{sym} {fmtNum(avg)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Per POS transaction</p>
              </div>
            </div>

            {(summary?.pos_refund_amount ?? 0) > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 bg-red-500/5 border border-red-500/20 rounded-xl text-sm">
                <RefreshCcw className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-muted-foreground">POS Refunds this month:</span>
                <span className="font-semibold text-red-600 dark:text-red-400 ml-auto">
                  -{sym} {fmtNum(summary?.pos_refund_amount ?? 0)}
                </span>
              </div>
            )}

            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              POS earnings are paid directly to you in cash or card. No payout schedule needed — money is yours immediately at the point of sale.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── TheDersi Channel Panel ────────────────────────────────────────────────────

function TheDersiPayoutPanel({ connection, shopId, channelRefundAmount }: { connection: ChannelConnection; shopId: string; channelRefundAmount: number }) {
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
      .catch((e: any) => setError(e?.response?.data?.detail || 'Could not load earnings data from TheDersi.'))
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
      const isMonday = new Date().getDay() === 1;
      setPayoutSuccess(
        isMonday
          ? `Request submitted — ${currency} ${fmtNum(amount)}. TheDersi will transfer to your bank today.`
          : `Scheduled — ${currency} ${fmtNum(amount)} queued for ${nextMondayLabel}. TheDersi will send to your bank on Monday.`
      );
      loadPayouts();
    } catch (err: any) {
      setPayoutError(err?.response?.data?.detail ?? 'Could not submit payout request. Try again.');
    } finally {
      setRequesting(false);
    }
  };

  const hasPending = payouts.some((p) => p.status === 'pending');
  const todayIsMonday = new Date().getDay() === 1;

  // Next Monday date label (e.g. "Mon 14 Jul")
  const nextMondayLabel = (() => {
    const d = new Date();
    const daysUntil = todayIsMonday ? 0 : (8 - d.getDay()) % 7;
    d.setDate(d.getDate() + daysUntil);
    return d.toLocaleDateString('en-LK', { weekday: 'short', day: 'numeric', month: 'short' });
  })();

  // Derived numbers
  const commissionRate = info?.commission_rate ?? 0;
  const gross = info?.total_earned_lifetime ?? 0;
  const onHoldGross = info?.held_amount ?? 0;
  const availableGross = info?.available_amount ?? info?.earnings_balance ?? 0;
  const totalPaid = payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);

  const commission = (n: number) => (n * commissionRate) / 100;
  const net = (n: number) => n - commission(n);
  const cur = info?.currency ?? 'LKR';
  const nextDate = info?.next_payout_date
    ? new Date(info.next_payout_date + 'T00:00:00').toLocaleDateString('en-LK', { weekday: 'short', day: 'numeric', month: 'short' })
    : '—';

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Link2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">TheDersi — Earnings & Payouts</p>
            <p className="text-xs text-muted-foreground">Sri Lankan Fashion Marketplace · {commissionRate > 0 ? `${commissionRate}% commission` : info ? 'No commission' : ''}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-3 h-3" /> Connected
        </span>
      </div>

      <div className="p-5 space-y-6">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading earnings from TheDersi...
          </div>
        )}
        {error && !loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" /> {error}
          </div>
        )}

        {info && !loading && (
          <>
            {/* ── 4-stage earnings flow ── */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Earnings Flow</p>

              {/* Stage labels row */}
              <div className="hidden sm:grid grid-cols-4 gap-1 mb-1 px-1">
                {['① Earnings', '② On Hold', '③ Available', '④ Paid Out'].map((l) => (
                  <p key={l} className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide text-center">{l}</p>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* ① Total Earnings */}
                <div className="bg-muted/40 border border-border rounded-xl p-4 relative">
                  <div className="hidden sm:flex absolute -right-1.5 top-1/2 -translate-y-1/2 z-10 w-4 h-4 rounded-full bg-border items-center justify-center">
                    <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground font-medium mb-2 sm:hidden">① Total Earnings</p>
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <p className="text-lg font-bold text-foreground">{cur} {fmtNum(gross)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">All orders, all time</p>
                </div>

                {/* ② On Hold */}
                <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 relative">
                  <div className="hidden sm:flex absolute -right-1.5 top-1/2 -translate-y-1/2 z-10 w-4 h-4 rounded-full bg-amber-500/20 items-center justify-center">
                    <ArrowRight className="w-2.5 h-2.5 text-amber-500" />
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-2 sm:hidden">② On Hold</p>
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center mb-2">
                    <Lock className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{cur} {fmtNum(onHoldGross)}</p>
                  <p className="text-xs text-amber-600/70 dark:text-amber-500 mt-0.5">7-day hold · releases {nextDate}</p>
                </div>

                {/* ③ Available */}
                <div className="bg-green-500/8 border border-green-500/20 rounded-xl p-4 relative">
                  <div className="hidden sm:flex absolute -right-1.5 top-1/2 -translate-y-1/2 z-10 w-4 h-4 rounded-full bg-green-500/20 items-center justify-center">
                    <ArrowRight className="w-2.5 h-2.5 text-green-500" />
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-2 sm:hidden">③ Available</p>
                  <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center mb-2">
                    <Wallet className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-lg font-bold text-green-700 dark:text-green-300">{cur} {fmtNum(availableGross)}</p>
                  <p className="text-xs text-green-600/70 dark:text-green-500 mt-0.5">
                    {availableGross > 0 ? (todayIsMonday ? 'Net · ready to request' : 'Net · request on Monday') : 'Nothing ready yet'}
                  </p>
                </div>

                {/* ④ Paid Out */}
                <div className="bg-muted/30 border border-border rounded-xl p-4">
                  <p className="text-xs text-muted-foreground font-medium mb-2 sm:hidden">④ Paid Out</p>
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-bold text-foreground">{cur} {fmtNum(totalPaid)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Already sent to your bank</p>
                </div>
              </div>

              {/* Net clarification note */}
              <div className="flex items-center gap-2 mt-2 px-1">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  All amounts are <strong>net</strong> — TheDersi&apos;s {commissionRate > 0 ? `${commissionRate}% ` : ''}commission and any cancelled or returned orders are already deducted by TheDersi.
                </p>
              </div>
            </div>

            {/* Overdue notice */}
            {info.payout_overdue && (
              <div className="flex items-start gap-3 px-4 py-3 bg-red-500/8 border border-red-500/20 rounded-xl text-sm">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-600 dark:text-red-400">Payout overdue</p>
                  <p className="text-xs text-muted-foreground mt-0.5">You have available earnings that haven't been paid out yet. Contact TheDersi support if this is unexpected.</p>
                </div>
              </div>
            )}

            {/* Refund row */}
            {channelRefundAmount > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 bg-red-500/5 border border-red-500/20 rounded-xl text-sm">
                <RefreshCcw className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-muted-foreground">TheDersi Refunds this month:</span>
                <span className="font-semibold text-red-600 dark:text-red-400 ml-auto">
                  -{cur} {fmtNum(channelRefundAmount)}
                </span>
              </div>
            )}

            {/* Request payout */}
            <div className="space-y-3">
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
                disabled={requesting || availableGross <= 0 || hasPending}
                className="w-full py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {requesting && <Loader2 className="w-4 h-4 animate-spin" />}
                {hasPending
                  ? 'Payout Request Pending'
                  : availableGross <= 0
                  ? 'No Balance Available'
                  : todayIsMonday
                  ? `Request Payout — ${cur} ${fmtNum(availableGross)}`
                  : `Schedule Payout for ${nextMondayLabel} — ${cur} ${fmtNum(availableGross)}`}
              </button>
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3 shrink-0" />
                <span>Bank transfer is sent every <strong>Monday</strong> — requests made any day are queued for the next Monday.</span>
              </div>
            </div>

            {/* Meta row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="bg-muted/40 rounded-lg p-3 flex items-start gap-2">
                <Tag className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="text-sm font-medium text-foreground">{info.plan_label}</p>
                  <p className="text-xs text-muted-foreground">{commissionRate}% commission</p>
                </div>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 flex items-start gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Schedule</p>
                  <p className="text-sm font-medium text-foreground">{info.payout_schedule}</p>
                  <p className="text-xs text-muted-foreground">Bank transfer every Monday</p>
                </div>
              </div>
              <div className={`col-span-2 sm:col-span-1 rounded-lg p-3 flex items-start gap-2 ${info.payout_overdue ? 'bg-red-500/10' : 'bg-muted/40'}`}>
                <Calendar className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${info.payout_overdue ? 'text-red-500' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-xs text-muted-foreground">Next payout date</p>
                  <p className={`text-sm font-medium ${info.payout_overdue ? 'text-red-500' : 'text-foreground'}`}>{nextDate}</p>
                  {info.payout_overdue && <p className="text-xs text-red-500 mt-0.5">Overdue</p>}
                </div>
              </div>
            </div>

            {info.payout_note && (
              <p className="text-xs text-muted-foreground bg-muted/30 border border-border rounded-lg px-3 py-2.5">
                ℹ️ {info.payout_note}
              </p>
            )}

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
                            {cur} {fmtNum(p.amount)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              p.status === 'paid'
                                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            }`}>
                              {p.status === 'paid' ? 'Paid' : 'Processing'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
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
  const [channelRefundAmount, setChannelRefundAmount] = useState(0);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  useEffect(() => {
    if (!shopId) return;
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const to = now.toISOString().split('T')[0];
    Promise.all([
      channelsApi.getConnections(shopId),
      reportsApi.getFinancialSummary(shopId, { from, to }),
    ])
      .then(([connRes, sumRes]) => {
        setConnections(connRes.data ?? []);
        setChannelRefundAmount(sumRes.data?.channel_refund_amount ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shopId]);

  const theDersiConns = connections.filter((c) => c.channel_type === 'thedersi');

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Payouts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track your earnings from POS sales and connected channels separately.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading payouts...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* POS — always shown */}
          <POSEarningsPanel shopId={shopId} />

          {/* Channel payouts — only if connected */}
          {theDersiConns.length > 0 ? (
            theDersiConns.map((conn) => (
              <TheDersiPayoutPanel key={conn.id} connection={conn} shopId={shopId} channelRefundAmount={channelRefundAmount} />
            ))
          ) : (
            <div className="bg-card border border-border rounded-xl p-6 flex flex-col sm:flex-row items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Link2 className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="font-semibold text-foreground">No channels connected</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Connect TheDersi or another marketplace to see channel earnings here.
                </p>
              </div>
              <Link href="/dashboard/channels"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition shrink-0">
                Connect Channel <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
