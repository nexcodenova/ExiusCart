'use client';

import { useState, useEffect } from 'react';
import {
  Search, CheckCircle, XCircle, Clock, CreditCard,
  TrendingUp, AlertCircle, Check, X, Loader2,
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
  starts_at: string | null;
  expires_at: string | null;
  created_at: string | null;
}

export default function PaymentsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');

  useEffect(() => {
    adminApi.getSubscriptions()
      .then((res) => setSubs(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = subs.filter((s) => {
    const matchSearch = s.shop_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchTab = activeTab === 'all' || (activeTab === 'pending' && s.status === 'trial');
    return matchSearch && matchTab;
  });

  const approve = async (sub: Subscription) => {
    try {
      await adminApi.approveSubscription(sub.id);
      setSubs((prev) => prev.map((s) => s.id === sub.id ? { ...s, status: 'active' } : s));
    } catch {/* no-op */}
  };

  const reject = async (sub: Subscription) => {
    try {
      await adminApi.rejectSubscription(sub.id);
      setSubs((prev) => prev.map((s) => s.id === sub.id ? { ...s, status: 'cancelled' } : s));
    } catch {/* no-op */}
  };

  const pendingCount = subs.filter((s) => s.status === 'trial').length;
  const totalRevenue = subs.filter((s) => s.status === 'active').reduce((sum, s) => sum + s.amount_paid, 0);

  const statusStyles: Record<string, string> = {
    active: 'bg-green-500/10 text-green-400',
    trial: 'bg-orange-500/10 text-orange-400',
    expiring: 'bg-orange-500/10 text-orange-400',
    expired: 'bg-red-500/10 text-red-400',
    cancelled: 'bg-gray-500/10 text-gray-400',
  };

  const planStyles: Record<string, string> = {
    starter: 'text-gray-400',
    business: 'text-blue-400',
    pro: 'text-[#6B3FD9]',
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Payments</h1>
          <p className="text-gray-400 text-sm mt-1">Subscription payments and approvals</p>
        </div>
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
      </div>

      {/* Search */}
      <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search by shop name..."
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
                    <th className="px-6 py-4 font-medium">Shop</th>
                    <th className="px-6 py-4 font-medium">Plan</th>
                    <th className="px-6 py-4 font-medium">Billing</th>
                    <th className="px-6 py-4 font-medium">Amount</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sub) => (
                    <tr key={sub.id} className="border-b border-gray-800 last:border-0 hover:bg-[#1A2540] transition">
                      <td className="px-6 py-4 font-medium text-white">{sub.shop_name}</td>
                      <td className={`px-6 py-4 font-medium capitalize ${planStyles[sub.plan_type] ?? 'text-gray-400'}`}>{sub.plan_type}</td>
                      <td className="px-6 py-4 text-gray-400 capitalize">{sub.billing_type?.replace('_', '-')}</td>
                      <td className="px-6 py-4 font-semibold text-white">
                        {sub.amount_paid > 0 ? `${sub.amount_paid} ${sub.currency}` : 'Free'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-lg capitalize ${statusStyles[sub.status] ?? 'bg-gray-500/10 text-gray-400'}`}>
                          {sub.status === 'trial' ? 'pending' : sub.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm">
                        {sub.created_at ? new Date(sub.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4">
                        {sub.status === 'trial' && (
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => approve(sub)} title="Approve"
                              className="p-2 rounded-lg text-green-400 hover:bg-green-500/10 transition">
                              <Check className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => reject(sub)} title="Reject"
                              className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition">
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
                  <span className={`text-xs px-2.5 py-1 rounded-lg capitalize ${statusStyles[sub.status] ?? 'bg-gray-500/10 text-gray-400'}`}>
                    {sub.status === 'trial' ? 'pending' : sub.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mb-3">
                  <span className={`capitalize font-medium ${planStyles[sub.plan_type] ?? 'text-gray-400'}`}>{sub.plan_type}</span>
                  <span className="font-semibold text-white">{sub.amount_paid > 0 ? `${sub.amount_paid} ${sub.currency}` : 'Free'}</span>
                </div>
                {sub.status === 'trial' && (
                  <div className="flex gap-2 pt-3 border-t border-gray-800">
                    <button type="button" onClick={() => approve(sub)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition font-medium text-sm">
                      <Check className="w-4 h-4" /> Approve
                    </button>
                    <button type="button" onClick={() => reject(sub)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition font-medium text-sm">
                      <X className="w-4 h-4" /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

