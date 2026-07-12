'use client';

import { useState, useEffect } from 'react';
import { Wallet, Lock, Clock, CheckCircle, DollarSign, ArrowRight, Loader2, BadgeCheck, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';
const MINIMUM_PAYOUT = 100;

function affiliateHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('affiliate_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface PayoutRequestRecord {
  id: number;
  amount: number;
  currency: string;
  payout_method: string;
  payout_address: string;
  status: 'pending' | 'paid' | 'rejected';
  admin_notes: string | null;
  requested_at: string;
  paid_at: string | null;
}

export default function PayoutsPage() {
  const [loading, setLoading] = useState(true);
  const [payoutDetails, setPayoutDetails] = useState<{ payout_method: string; paypal_email: string; skrill_email: string; payoneer_id: string } | null>(null);
  const [stats, setStats] = useState<{
    locked_amount: number;
    pending_approval_amount: number;
    available_amount: number;
    paid_amount: number;
    total_earnings: number;
  } | null>(null);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequestRecord[]>([]);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState(false);

  const loadData = () => {
    Promise.all([
      fetch(`${API_BASE}/api/v1/affiliates/me/stats`, { headers: affiliateHeaders() }).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/api/v1/affiliates/me/payout-details`, { headers: affiliateHeaders() }).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/api/v1/affiliates/me/payout-requests`, { headers: affiliateHeaders() }).then(r => r.ok ? r.json() : []),
    ]).then(([s, p, reqs]) => {
      if (s) setStats(s);
      if (p) setPayoutDetails(p);
      setPayoutRequests(reqs || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleRequestPayout = async () => {
    setRequesting(true);
    setRequestError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/affiliates/me/request-payout`, {
        method: 'POST',
        headers: affiliateHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        setRequestError(data.detail || 'Failed to submit request');
      } else {
        setRequestSuccess(true);
        loadData();
      }
    } catch {
      setRequestError('Network error. Please try again.');
    } finally {
      setRequesting(false);
    }
  };

  const locked = stats?.locked_amount ?? 0;
  const pendingApproval = stats?.pending_approval_amount ?? 0;
  const available = stats?.available_amount ?? 0;
  const paid = stats?.paid_amount ?? 0;
  const totalEarned = stats?.total_earnings ?? 0;

  const hasPayoutMethod = payoutDetails && (
    (payoutDetails.payout_method === 'paypal' && payoutDetails.paypal_email) ||
    (payoutDetails.payout_method === 'skrill' && payoutDetails.skrill_email) ||
    (payoutDetails.payout_method === 'payoneer' && payoutDetails.payoneer_id)
  );

  const canRequest = available >= MINIMUM_PAYOUT && hasPayoutMethod;

  const flow = [
    {
      icon: DollarSign,
      label: 'Total Earned',
      value: totalEarned,
      desc: 'All commissions ever earned',
      color: '#7B4FE9',
      bg: 'bg-[#7B4FE9]/8',
      border: 'border-[#7B4FE9]/20',
    },
    {
      icon: Lock,
      label: '30-Day Lock',
      value: locked,
      desc: 'Released after 30 days',
      color: '#6B7280',
      bg: 'bg-gray-100',
      border: 'border-gray-200',
    },
    {
      icon: Clock,
      label: 'Pending Approval',
      value: pendingApproval,
      desc: 'Lock expired · awaiting admin review (≈15 days)',
      color: '#F59E0B',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    },
    {
      icon: CheckCircle,
      label: 'Available',
      value: available,
      desc: available >= MINIMUM_PAYOUT ? 'Ready to withdraw' : `Need $${(MINIMUM_PAYOUT - available).toFixed(2)} more`,
      color: '#10B981',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>
        <p className="text-gray-500 text-sm mt-1">Track your commission flow and request payouts</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 text-[#7B4FE9] animate-spin" />
        </div>
      ) : (
        <>
          {/* Flow boxes */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {flow.map(({ icon: Icon, label, value, desc, color, bg, border }, i) => (
              <div key={label} className={`rounded-2xl border p-5 ${bg} ${border} relative`}>
                {i < flow.length - 1 && (
                  <ArrowRight className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 z-10 hidden lg:block" />
                )}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${color}18` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                <p className="text-2xl font-black text-gray-900">${value.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1 leading-snug">{desc}</p>
              </div>
            ))}
          </div>

          {/* Paid out row */}
          <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Total Paid Out</p>
                <p className="text-xs text-gray-400">Successfully processed payouts</p>
              </div>
            </div>
            <p className="text-xl font-black text-gray-900">${paid.toFixed(2)}</p>
          </div>

          {/* How it works */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">How the payout flow works</p>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#7B4FE9]/10 text-[#7B4FE9] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">30-day lock</p>
                  <p className="text-xs text-gray-500 leading-relaxed">Commission is locked for 30 days after the referral activates a paid plan. This protects against refunds.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Admin approval (~15 days)</p>
                  <p className="text-xs text-gray-500 leading-relaxed">Once the lock expires, we review and approve the commission within ~15 business days.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Request payout</p>
                  <p className="text-xs text-gray-500 leading-relaxed">Once approved, request payout when your available balance reaches $100. Processed in 3–5 business days.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Request payout section — only shown when available > 0 */}
          {available > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
              <h2 className="text-gray-900 font-semibold mb-4 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#7B4FE9]" />
                Request Payout
              </h2>

              {!hasPayoutMethod ? (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700">
                    Add your payout method in <a href="/dashboard/profile" className="font-semibold underline">Profile</a> before requesting a payout.
                  </p>
                </div>
              ) : available < MINIMUM_PAYOUT ? (
                <div className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-600">
                    Minimum payout is <span className="font-semibold text-gray-900">$100</span>. You need <span className="font-semibold text-gray-900">${(MINIMUM_PAYOUT - available).toFixed(2)}</span> more.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-4 mb-5">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex-1">
                      <p className="text-xs text-gray-500 mb-1">Available to withdraw</p>
                      <p className="text-3xl font-black text-gray-900">${available.toFixed(2)}</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4">
                      <p className="text-xs text-gray-500 mb-1">Payout method</p>
                      <p className="text-sm font-semibold text-gray-900 capitalize">{payoutDetails?.payout_method}</p>
                      <p className="text-xs text-gray-400 truncate max-w-[140px]">
                        {payoutDetails?.payout_method === 'paypal' ? payoutDetails.paypal_email :
                         payoutDetails?.payout_method === 'skrill' ? payoutDetails.skrill_email :
                         payoutDetails?.payoneer_id}
                      </p>
                    </div>
                  </div>
                  {requestSuccess ? (
                    <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-700">Payout request submitted!</p>
                        <p className="text-xs text-emerald-600 mt-0.5">We'll process it within 3–5 business days and send you a confirmation email.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                        <BadgeCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <p className="text-sm text-emerald-700">Your balance is eligible for payout. Submit your request below.</p>
                      </div>
                      {requestError && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
                          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-red-600">{requestError}</p>
                        </div>
                      )}
                      <button
                        onClick={handleRequestPayout}
                        disabled={requesting}
                        className="bg-[#7B4FE9] hover:bg-[#5A2EC9] disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-all flex items-center gap-2"
                      >
                        {requesting && <Loader2 className="w-4 h-4 animate-spin" />}
                        {requesting ? 'Submitting...' : `Request Payout — $${available.toFixed(2)}`}
                      </button>
                      <p className="text-xs text-gray-400 mt-2">Processed within 3–5 business days after review.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Payout history */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-gray-900 font-semibold">Payout History</h2>
            </div>
            {payoutRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <Clock className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium mb-1">No payouts yet</p>
                <p className="text-gray-400 text-sm">Your payout history will appear here once processed</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {payoutRequests.map((req) => (
                  <div key={req.id} className="px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        req.status === 'paid' ? 'bg-emerald-100' : req.status === 'rejected' ? 'bg-red-100' : 'bg-amber-100'
                      }`}>
                        {req.status === 'paid' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> :
                         req.status === 'rejected' ? <XCircle className="w-4 h-4 text-red-500" /> :
                         <Clock className="w-4 h-4 text-amber-500" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">${req.amount.toFixed(2)} {req.currency}</p>
                        <p className="text-xs text-gray-400">{req.payout_method?.toUpperCase()} · {req.payout_address}</p>
                        {req.admin_notes && <p className="text-xs text-red-500 mt-0.5">{req.admin_notes}</p>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${
                        req.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                        req.status === 'rejected' ? 'bg-red-100 text-red-600' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {req.status === 'paid' ? 'Paid' : req.status === 'rejected' ? 'Rejected' : 'Processing'}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">
                        {req.paid_at
                          ? new Date(req.paid_at).toLocaleDateString()
                          : new Date(req.requested_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
