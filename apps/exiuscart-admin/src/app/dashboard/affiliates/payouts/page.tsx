'use client';

import { useState, useEffect } from 'react';
import { Check, X, DollarSign, Loader2 } from 'lucide-react';
import { adminApi } from '@/lib/api';

interface PayoutReq {
  id: number; affiliate_id: number; affiliate_name: string; affiliate_email: string;
  payout_method: string; payout_address: string; amount: number; currency: string;
  status: string; admin_notes: string | null; requested_at: string; paid_at: string | null;
}

export default function AffiliatePayoutsPage() {
  const [payoutRequests, setPayoutRequests] = useState<PayoutReq[]>([]);
  const [loadingPayouts, setLoadingPayouts] = useState(true);
  const [payoutFilter, setPayoutFilter] = useState('pending');
  const [processingPayout, setProcessingPayout] = useState<number | null>(null);

  const fetchPayoutRequests = async (status = payoutFilter) => {
    setLoadingPayouts(true);
    try {
      const res = await adminApi.getPayoutRequests(status);
      setPayoutRequests(res.data);
    } catch {}
    finally { setLoadingPayouts(false); }
  };

  useEffect(() => { fetchPayoutRequests(payoutFilter); }, [payoutFilter]);

  const handlePayPayout = async (id: number) => {
    setProcessingPayout(id);
    try { await adminApi.payPayoutRequest(id); fetchPayoutRequests(payoutFilter); }
    catch {} finally { setProcessingPayout(null); }
  };

  const handleRejectPayout = async (id: number) => {
    const notes = window.prompt('Reason for rejection (optional):') ?? undefined;
    setProcessingPayout(id);
    try { await adminApi.rejectPayoutRequest(id, notes); fetchPayoutRequests(payoutFilter); }
    catch {} finally { setProcessingPayout(null); }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Affiliate Payouts</h1>
          <p className="text-gray-600 text-sm mt-1">Affiliates requesting their available balance</p>
        </div>
        <select
          value={payoutFilter}
          onChange={e => setPayoutFilter(e.target.value)}
          aria-label="Filter payout requests"
          className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 text-sm focus:border-[#6B3FD9] focus:outline-none"
        >
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loadingPayouts ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-[#6B3FD9]" />
          </div>
        ) : payoutRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <DollarSign className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No {payoutFilter} payout requests</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {payoutRequests.map((req) => (
              <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-gray-900 font-semibold text-sm">{req.affiliate_name}</p>
                    <span className="text-gray-500 text-xs">{req.affiliate_email}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                    <span className="bg-gray-50 px-2 py-1 rounded-md font-mono">{req.payout_method?.toUpperCase()}</span>
                    <span>{req.payout_address}</span>
                    <span className="text-gray-900 font-semibold">${req.amount.toFixed(2)} {req.currency}</span>
                    <span>{new Date(req.requested_at).toLocaleDateString()}</span>
                  </div>
                  {req.admin_notes && (
                    <p className="text-xs text-red-600 mt-1">Note: {req.admin_notes}</p>
                  )}
                </div>
                {req.status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handlePayPayout(req.id)}
                      disabled={processingPayout === req.id}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                    >
                      {processingPayout === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Mark Paid
                    </button>
                    <button
                      onClick={() => handleRejectPayout(req.id)}
                      disabled={processingPayout === req.id}
                      className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 text-xs font-semibold px-4 py-2 rounded-lg transition border border-red-500/20"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                )}
                {req.status === 'paid' && (
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 shrink-0">
                    Paid {req.paid_at ? new Date(req.paid_at).toLocaleDateString() : ''}
                  </span>
                )}
                {req.status === 'rejected' && (
                  <span className="text-xs font-medium text-red-600 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20 shrink-0">
                    Rejected
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
