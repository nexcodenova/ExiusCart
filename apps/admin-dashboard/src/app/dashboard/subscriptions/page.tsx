'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Package, Calendar, TrendingUp, AlertCircle, Loader2, Check, X,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

interface Subscription {
  id: number;
  shop_id: number;
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

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'pending'>('subscriptions');

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getSubscriptions({
        plan_filter: planFilter !== 'all' ? planFilter : undefined,
        status_filter: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setSubs(res.data ?? []);
    } catch {
      setSubs([]);
    }
    setLoading(false);
  }, [planFilter, statusFilter]);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  const filtered = subs.filter((s) => {
    const matchSearch = s.shop_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchTab = activeTab === 'subscriptions' || (activeTab === 'pending' && s.status === 'trial');
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

  const planStyles: Record<string, string> = {
    starter: 'text-gray-400',
    business: 'text-blue-400',
    pro: 'text-[#F5A623]',
  };

  const statusStyles: Record<string, string> = {
    active: 'bg-green-500/10 text-green-400',
    trial: 'bg-blue-500/10 text-blue-400',
    expiring: 'bg-orange-500/10 text-orange-400',
    expired: 'bg-red-500/10 text-red-400',
    cancelled: 'bg-gray-500/10 text-gray-400',
  };

  const pendingCount = subs.filter((s) => s.status === 'trial').length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
        <p className="text-gray-400 text-sm mt-1">Manage plans and active subscriptions</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button type="button" onClick={() => setActiveTab('subscriptions')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition ${activeTab === 'subscriptions' ? 'bg-[#F5A623] text-black' : 'bg-[#151F32] text-gray-400 hover:text-white border border-gray-800'}`}>
          All Subscriptions
        </button>
        <button type="button" onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${activeTab === 'pending' ? 'bg-[#F5A623] text-black' : 'bg-[#151F32] text-gray-400 hover:text-white border border-gray-800'}`}>
          Pending Approval
          {pendingCount > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'pending' ? 'bg-black/20 text-black' : 'bg-orange-500 text-white'}`}>
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-gray-400 text-sm">Active</p><p className="text-2xl font-bold text-white mt-1">{subs.filter((s) => s.status === 'active').length}</p></div>
            <div className="p-2.5 rounded-lg bg-green-500/10 text-green-400"><Package className="w-5 h-5" /></div>
          </div>
        </div>
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-gray-400 text-sm">Monthly</p><p className="text-2xl font-bold text-white mt-1">{subs.filter((s) => s.billing_type === 'monthly').length}</p></div>
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400"><Calendar className="w-5 h-5" /></div>
          </div>
        </div>
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-gray-400 text-sm">One-Time</p><p className="text-2xl font-bold text-white mt-1">{subs.filter((s) => s.billing_type === 'one_time').length}</p></div>
            <div className="p-2.5 rounded-lg bg-[#F5A623]/10 text-[#F5A623]"><TrendingUp className="w-5 h-5" /></div>
          </div>
        </div>
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-gray-400 text-sm">Pending</p><p className="text-2xl font-bold text-white mt-1">{pendingCount}</p></div>
            <div className="p-2.5 rounded-lg bg-orange-500/10 text-orange-400"><AlertCircle className="w-5 h-5" /></div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search shops..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-4 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#F5A623] focus:outline-none transition"
            />
          </div>
          <div className="flex gap-3">
            <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}
              className="px-4 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white focus:border-[#F5A623] focus:outline-none transition appearance-none cursor-pointer">
              <option value="all">All Plans</option>
              <option value="starter">Starter</option>
              <option value="business">Business</option>
              <option value="pro">Pro</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white focus:border-[#F5A623] focus:outline-none transition appearance-none cursor-pointer">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="trial">Trial/Pending</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 text-[#F5A623] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-16 text-center">
          <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No subscriptions found</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-[#151F32] rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                  <th className="px-6 py-4 font-medium">Shop</th>
                  <th className="px-6 py-4 font-medium">Plan</th>
                  <th className="px-6 py-4 font-medium">Billing</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Expires</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sub) => (
                  <tr key={sub.id} className="border-b border-gray-800 last:border-0 hover:bg-[#1A2540] transition">
                    <td className="px-6 py-4 font-medium text-white">{sub.shop_name}</td>
                    <td className={`px-6 py-4 font-medium capitalize ${planStyles[sub.plan_type] ?? 'text-gray-400'}`}>{sub.plan_type}</td>
                    <td className="px-6 py-4 text-gray-400 capitalize">{sub.billing_type?.replace('_', '-') ?? '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-lg capitalize ${statusStyles[sub.status] ?? 'bg-gray-500/10 text-gray-400'}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-white">
                      {sub.amount_paid > 0 ? `${sub.amount_paid} ${sub.currency}` : 'Free'}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : 'Lifetime'}
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

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-4">
            {filtered.map((sub) => (
              <div key={sub.id} className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-medium text-white">{sub.shop_name}</p>
                  <span className={`text-xs px-2.5 py-1 rounded-lg capitalize ${statusStyles[sub.status] ?? 'bg-gray-500/10 text-gray-400'}`}>
                    {sub.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-medium capitalize ${planStyles[sub.plan_type] ?? 'text-gray-400'}`}>{sub.plan_type}</span>
                  <span className="text-xs text-gray-500 capitalize">{sub.billing_type?.replace('_', '-')}</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-3 border-t border-gray-800">
                  <span className="text-gray-400">{sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : 'Lifetime'}</span>
                  <span className="text-white font-medium">{sub.amount_paid > 0 ? `${sub.amount_paid} ${sub.currency}` : 'Free'}</span>
                </div>
                {sub.status === 'trial' && (
                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={() => approve(sub)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition text-sm font-medium">
                      <Check className="w-4 h-4" /> Approve
                    </button>
                    <button type="button" onClick={() => reject(sub)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition text-sm font-medium">
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
