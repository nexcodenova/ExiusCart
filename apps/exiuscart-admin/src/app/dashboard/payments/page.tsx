'use client';

import { useState, useEffect } from 'react';
import {
  Search, CheckCircle, XCircle, Clock, CreditCard,
  TrendingUp, AlertCircle, Check, X, Loader2, Zap, UserCheck, Receipt, Ban,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

interface Subscription {
  id: number;
  shop_name: string;
  plan_type: string;
  billing_type: string;
  status: string;
  amount_paid: number;
  currency: string;
  payment_source?: 'manual' | 'lemon_squeezy';
  starts_at: string | null;
  expires_at: string | null;
  created_at: string | null;
}

interface PaymentLedgerRow {
  id: number;
  shop_id: number;
  shop_name: string;
  plan_type: string;
  billing_type: string;
  amount: number;
  currency: string;
  source: 'manual' | 'lemon_squeezy';
  lemon_squeezy_order_id: string | null;
  confirmed_at: string | null;
  refunded_at: string | null;
  commission: {
    affiliate_name: string | null;
    amount: number | null;
    type: 'one_time' | 'recurring' | null;
    period_month: number | null;
    status: string | null;
  } | null;
}

function SourceBadge({ source }: { source: 'manual' | 'lemon_squeezy' }) {
  return source === 'lemon_squeezy' ? (
    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-400 font-medium">
      <Zap className="w-3 h-3" /> Lemon Squeezy
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-500/10 text-gray-400 font-medium">
      <UserCheck className="w-3 h-3" /> Manual
    </span>
  );
}

export default function PaymentsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'ledger'>('all');
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const [ledger, setLedger] = useState<PaymentLedgerRow[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(true);

  useEffect(() => {
    adminApi.getSubscriptions()
      .then((res) => setSubs(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    adminApi.getSubscriptionPayments()
      .then((res) => setLedger(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingLedger(false));
  }, []);

  const filtered = subs.filter((s) => {
    const matchSearch = s.shop_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchTab = activeTab === 'all' || (activeTab === 'pending' && s.status === 'pending_approval');
    return matchSearch && matchTab;
  });

  const approve = async (sub: Subscription) => {
    setActionId(sub.id);
    setError('');
    try {
      await adminApi.approveSubscription(sub.id);
      const newStatus = sub.plan_type === 'free_trial' ? 'trial' : 'active';
      setSubs((prev) => prev.map((s) => s.id === sub.id ? { ...s, status: newStatus } : s));
    } catch {
      setError('Approval failed — please try again.');
    } finally {
      setActionId(null);
    }
  };

  const reject = async (sub: Subscription) => {
    setActionId(sub.id);
    setError('');
    try {
      await adminApi.rejectSubscription(sub.id);
      setSubs((prev) => prev.map((s) => s.id === sub.id ? { ...s, status: 'cancelled' } : s));
    } catch {
      setError('Rejection failed — please try again.');
    } finally {
      setActionId(null);
    }
  };

  const pendingCount = subs.filter((s) => s.status === 'pending_approval').length;
  const totalRevenue = subs.filter((s) => s.status === 'active').reduce((sum, s) => sum + s.amount_paid, 0);

  const statusStyles: Record<string, string> = {
    active:           'bg-green-500/10 text-green-400',
    trial:            'bg-blue-500/10 text-blue-400',
    pending_approval: 'bg-orange-500/10 text-orange-400',
    expiring:         'bg-orange-500/10 text-orange-400',
    expired:          'bg-red-500/10 text-red-400',
    cancelled:        'bg-gray-500/10 text-gray-400',
  };

  const statusLabel: Record<string, string> = {
    pending_approval: 'Pending',
    trial:            'Trial',
    active:           'Active',
    expiring:         'Expiring',
    expired:          'Expired',
    cancelled:        'Cancelled',
  };

  const planStyles: Record<string, string> = {
    starter:    'text-gray-400',
    premium:    'text-[#6B3FD9]',
    free_trial: 'text-blue-400',
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Payments</h1>
        <p className="text-gray-400 text-sm mt-1">Subscription payments and approvals</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-gray-400 text-sm">Total Revenue</p><p className="text-xl font-bold text-white mt-1">{totalRevenue.toLocaleString()} AED</p></div>
            <div className="p-2.5 rounded-lg bg-[#6B3FD9]/10 text-[#6B3FD9]"><TrendingUp className="w-5 h-5" /></div>
          </div>
        </div>
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-gray-400 text-sm">Active</p><p className="text-2xl font-bold text-white mt-1">{subs.filter((s) => s.status === 'active').length}</p></div>
            <div className="p-2.5 rounded-lg bg-green-500/10 text-green-400"><CheckCircle className="w-5 h-5" /></div>
          </div>
        </div>
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-gray-400 text-sm">Pending</p><p className="text-2xl font-bold text-white mt-1">{pendingCount}</p></div>
            <div className="p-2.5 rounded-lg bg-orange-500/10 text-orange-400"><Clock className="w-5 h-5" /></div>
          </div>
        </div>
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-gray-400 text-sm">Expired</p><p className="text-2xl font-bold text-white mt-1">{subs.filter((s) => s.status === 'expired' || s.status === 'cancelled').length}</p></div>
            <div className="p-2.5 rounded-lg bg-red-500/10 text-red-400"><XCircle className="w-5 h-5" /></div>
          </div>
        </div>
      </div>

      {/* Alert */}
      {pendingCount > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-orange-400 shrink-0" />
            <p className="text-orange-400 font-medium text-sm">
              {pendingCount} subscription{pendingCount > 1 ? 's' : ''} awaiting manual approval
            </p>
            <button type="button" onClick={() => setActiveTab('pending')} className="ml-auto text-sm text-orange-400 hover:text-orange-300 font-medium">
              View
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button type="button" onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg font-medium transition text-sm ${activeTab === 'all' ? 'bg-[#6B3FD9] text-black' : 'bg-[#151F32] text-gray-400 hover:text-white border border-gray-800'}`}>
          All
        </button>
        <button type="button" onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-lg font-medium transition text-sm flex items-center gap-2 ${activeTab === 'pending' ? 'bg-[#6B3FD9] text-black' : 'bg-[#151F32] text-gray-400 hover:text-white border border-gray-800'}`}>
          Pending
          {pendingCount > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'pending' ? 'bg-black/20 text-black' : 'bg-orange-500 text-white'}`}>
              {pendingCount}
            </span>
          )}
        </button>
        <button type="button" onClick={() => setActiveTab('ledger')}
          className={`px-4 py-2 rounded-lg font-medium transition text-sm flex items-center gap-2 ${activeTab === 'ledger' ? 'bg-[#6B3FD9] text-black' : 'bg-[#151F32] text-gray-400 hover:text-white border border-gray-800'}`}>
          <Receipt className="w-4 h-4" /> Payment Ledger
        </button>
      </div>

      {activeTab === 'ledger' ? (
        <PaymentLedgerTable ledger={ledger} loading={loadingLedger} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      ) : (
      <>
      {/* Search */}
      <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search by store name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 text-[#6B3FD9] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-8 text-center">
          <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No payments found</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-[#151F32] rounded-xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                    <th className="px-6 py-4 font-medium">Store</th>
                    <th className="px-6 py-4 font-medium">Plan</th>
                    <th className="px-6 py-4 font-medium">Billing</th>
                    <th className="px-6 py-4 font-medium">Amount</th>
                    <th className="px-6 py-4 font-medium">Source</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sub) => (
                    <tr key={sub.id} className="border-b border-gray-800 last:border-0 hover:bg-[#1A2540] transition">
                      <td className="px-6 py-4 font-medium text-white">{sub.shop_name}</td>
                      <td className={`px-6 py-4 font-medium capitalize ${planStyles[sub.plan_type] ?? 'text-gray-400'}`}>
                        {sub.plan_type === 'free_trial' ? 'Free Trial' : sub.plan_type}
                      </td>
                      <td className="px-6 py-4 text-gray-400 capitalize">{sub.billing_type?.replace('_', '-')}</td>
                      <td className="px-6 py-4 font-semibold text-white">
                        {sub.amount_paid > 0 ? `${sub.amount_paid} ${sub.currency}` : 'Free'}
                      </td>
                      <td className="px-6 py-4">
                        {sub.amount_paid > 0 && <SourceBadge source={sub.payment_source ?? 'manual'} />}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-lg ${statusStyles[sub.status] ?? 'bg-gray-500/10 text-gray-400'}`}>
                          {statusLabel[sub.status] ?? sub.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm">
                        {sub.created_at ? new Date(sub.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4">
                        {sub.status === 'pending_approval' && (
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => approve(sub)} disabled={actionId === sub.id} title="Approve"
                              className="p-2 rounded-lg text-green-400 hover:bg-green-500/10 transition disabled:opacity-50">
                              {actionId === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button type="button" onClick={() => reject(sub)} disabled={actionId === sub.id} title="Reject"
                              className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition disabled:opacity-50">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-4">
            {filtered.map((sub) => (
              <div key={sub.id} className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
                <div className="flex items-start justify-between mb-3">
                  <p className="font-medium text-white">{sub.shop_name}</p>
                  <span className={`text-xs px-2.5 py-1 rounded-lg ${statusStyles[sub.status] ?? 'bg-gray-500/10 text-gray-400'}`}>
                    {statusLabel[sub.status] ?? sub.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mb-3">
                  <span className={`font-medium ${planStyles[sub.plan_type] ?? 'text-gray-400'}`}>
                    {sub.plan_type === 'free_trial' ? 'Free Trial' : sub.plan_type}
                  </span>
                  <span className="font-semibold text-white">{sub.amount_paid > 0 ? `${sub.amount_paid} ${sub.currency}` : 'Free'}</span>
                </div>
                {sub.status === 'pending_approval' && (
                  <div className="flex gap-2 pt-3 border-t border-gray-800">
                    <button type="button" onClick={() => approve(sub)} disabled={actionId === sub.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition font-medium text-sm disabled:opacity-50">
                      {actionId === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
                    </button>
                    <button type="button" onClick={() => reject(sub)} disabled={actionId === sub.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition font-medium text-sm disabled:opacity-50">
                      <X className="w-4 h-4" /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      </>
      )}
    </div>
  );
}

// ── Payment Ledger — every confirmed payment, real or manual, with linked commission ──

function PaymentLedgerTable({ ledger, loading, searchQuery, setSearchQuery }: {
  ledger: PaymentLedgerRow[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
}) {
  const [rows, setRows] = useState(ledger);
  const [refundingId, setRefundingId] = useState<number | null>(null);
  const [refundError, setRefundError] = useState('');

  useEffect(() => { setRows(ledger); }, [ledger]);

  const filtered = rows.filter((p) => p.shop_name.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalLemonSqueezy = rows.filter((p) => p.source === 'lemon_squeezy').reduce((s, p) => s + p.amount, 0);
  const totalManual = rows.filter((p) => p.source === 'manual').reduce((s, p) => s + p.amount, 0);
  const totalCommissionOwed = rows.reduce((s, p) => s + (p.commission?.amount ?? 0), 0);

  const handleRefund = async (payment: PaymentLedgerRow) => {
    if (!window.confirm(
      `Refund ${payment.amount.toFixed(2)} ${payment.currency} for "${payment.shop_name}"?\n\n` +
      `This only records the refund in ExiusCart — issue the actual refund on Lemon Squeezy's dashboard first if you haven't already.\n\n` +
      `This will immediately BLOCK the shop owner's account (they'll see "refunded, contact support" on next login) and reverse the affiliate commission for this payment.`
    )) return;

    setRefundingId(payment.id);
    setRefundError('');
    try {
      await adminApi.refundPayment(payment.id);
      setRows((prev) => prev.map((p) => p.id === payment.id
        ? { ...p, refunded_at: new Date().toISOString(), commission: p.commission ? { ...p.commission, status: 'reversed' } : null }
        : p));
    } catch (err: any) {
      setRefundError(err?.response?.data?.detail || 'Refund failed — please try again.');
    } finally {
      setRefundingId(null);
    }
  };

  return (
    <>
      {/* Ledger stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Total Payments</p>
          <p className="text-2xl font-bold text-white mt-1">{ledger.length}</p>
        </div>
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-yellow-400" /> Lemon Squeezy</p>
          <p className="text-2xl font-bold text-white mt-1">{totalLemonSqueezy.toLocaleString()}</p>
        </div>
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5 text-gray-400" /> Manual</p>
          <p className="text-2xl font-bold text-white mt-1">{totalManual.toLocaleString()}</p>
        </div>
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Commission Owed</p>
          <p className="text-2xl font-bold text-[#6B3FD9] mt-1">${totalCommissionOwed.toFixed(2)}</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search by store name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition"
          />
        </div>
      </div>

      {refundError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 text-red-400 text-sm">
          {refundError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 text-[#6B3FD9] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-8 text-center">
          <Receipt className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No confirmed payments yet</p>
        </div>
      ) : (
        <div className="bg-[#151F32] rounded-xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                  <th className="px-6 py-4 font-medium">Store</th>
                  <th className="px-6 py-4 font-medium">Plan</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Source</th>
                  <th className="px-6 py-4 font-medium">Affiliate Commission</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-gray-800 last:border-0 hover:bg-[#1A2540] transition">
                    <td className="px-6 py-4 font-medium text-white">{p.shop_name}</td>
                    <td className="px-6 py-4 text-gray-300 capitalize">{p.plan_type} · {p.billing_type}</td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-white">{p.amount.toFixed(2)} {p.currency}</span>
                      {p.refunded_at && (
                        <span className="block text-xs text-red-400 font-medium mt-0.5">
                          Refunded {new Date(p.refunded_at).toLocaleDateString()}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4"><SourceBadge source={p.source} /></td>
                    <td className="px-6 py-4">
                      {p.commission ? (
                        <div className="text-sm">
                          <span className={p.commission.status === 'reversed' ? 'text-gray-500 line-through' : 'text-white font-medium'}>
                            ${p.commission.amount?.toFixed(2)}
                          </span>
                          <span className="text-gray-500"> → {p.commission.affiliate_name}</span>
                          {p.commission.type === 'recurring' && (
                            <span className="ml-1.5 text-xs text-[#A78BFA]">Month {p.commission.period_month}/12</span>
                          )}
                          {p.commission.status === 'reversed' && (
                            <span className="ml-1.5 text-xs text-red-400 font-medium">Reversed</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-600 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {p.confirmed_at ? new Date(p.confirmed_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4">
                      {p.refunded_at ? (
                        <span className="text-gray-600 text-sm">—</span>
                      ) : (
                        <button type="button" onClick={() => handleRefund(p)} disabled={refundingId === p.id}
                          title="Mark this payment refunded — blocks the account and reverses the commission"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition text-xs font-medium disabled:opacity-50">
                          {refundingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                          Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
