'use client';

import { useState, useEffect } from 'react';
import { Users, UserCheck, Clock, Loader2, Store } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';

function affiliateHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('affiliate_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Referral {
  name: string;
  email: string;
  signed_up: string | null;
  store_name: string | null;
  plan: string | null;
  status: string;
  commission: number;
  commission_status: string | null;
  commission_currency: string;
  months_paid: number | null;
  months_remaining: number | null;
}

const STATUS_COLORS: Record<string, string> = {
  active:           'bg-green-100 text-green-700',
  pending_approval: 'bg-yellow-100 text-yellow-700',
  trial:            'bg-blue-100 text-blue-700',
  registered:       'bg-gray-100 text-gray-600',
  expired:          'bg-red-100 text-red-600',
};

const STATUS_LABELS: Record<string, string> = {
  active:           'Converted',
  pending_approval: 'Pending Approval',
  trial:            'Trial',
  registered:       'Registered',
  expired:          'Expired',
};

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/affiliates/me/referrals`, { headers: affiliateHeaders() })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setReferrals(Array.isArray(d) ? d : []))
      .catch(() => setReferrals([]))
      .finally(() => setLoading(false));
  }, []);

  const totalSignups = referrals.length;
  const converted = referrals.filter((r) => r.status === 'active').length;
  const pending = referrals.filter((r) => r.status === 'pending_approval' || r.status === 'trial' || r.status === 'registered').length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Referrals</h1>
        <p className="text-gray-500 text-sm mt-1">People who signed up via your referral link</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#7B4FE9]/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-[#7B4FE9]" />
            </div>
            <span className="text-gray-500 text-sm">Total Signups</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{loading ? '…' : totalSignups}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-gray-500 text-sm">Converted</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{loading ? '…' : converted}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-yellow-600" />
            </div>
            <span className="text-gray-500 text-sm">Pending</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{loading ? '…' : pending}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-gray-900 font-semibold">Referral List</h2>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="w-6 h-6 text-[#7B4FE9] animate-spin" />
          </div>
        ) : referrals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium mb-1">No referrals yet</p>
            <p className="text-gray-400 text-sm">
              Share your referral link from the Marketing page to start getting signups.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="text-left px-6 py-3 font-medium">Name</th>
                    <th className="text-left px-6 py-3 font-medium">Store</th>
                    <th className="text-left px-6 py-3 font-medium">Plan</th>
                    <th className="text-left px-6 py-3 font-medium">Signed Up</th>
                    <th className="text-left px-6 py-3 font-medium">Status</th>
                    <th className="text-left px-6 py-3 font-medium">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <p className="text-gray-900 font-medium">{r.name}</p>
                        <p className="text-xs text-gray-400">{r.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        {r.store_name ? (
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <Store className="w-3.5 h-3.5 text-gray-400" />
                            {r.store_name}
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 capitalize text-gray-600">
                        {r.plan === 'free_trial' ? 'Free Trial' : r.plan || '—'}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {r.signed_up ? new Date(r.signed_up).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-lg ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {STATUS_LABELS[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {r.commission > 0 ? (
                          <div>
                            <p className="text-gray-900 font-semibold">${r.commission.toFixed(2)}</p>
                            <p className={`text-xs ${r.commission_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                              {r.commission_status === 'paid' ? 'Paid' : 'Pending'}
                              {r.months_paid != null && ` · ${r.months_paid}/12 months`}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {referrals.map((r, i) => (
                <div key={i} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-gray-900 font-medium text-sm">{r.name}</p>
                      <p className="text-xs text-gray-400">{r.email}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-lg ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </div>
                  {r.store_name && <p className="text-xs text-gray-500 mb-1">{r.store_name}</p>}
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{r.signed_up ? new Date(r.signed_up).toLocaleDateString() : '—'}</span>
                    {r.commission > 0 && (
                      <span className="text-gray-900 font-semibold">
                        ${r.commission.toFixed(2)}
                        {r.months_paid != null && <span className="text-gray-400 font-normal"> · {r.months_paid}/12mo</span>}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
