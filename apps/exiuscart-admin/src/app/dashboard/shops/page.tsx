'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, Store, Eye, Ban, CheckCircle, Loader2,
  X, Package, ShoppingCart, Calendar, Clock, CheckCircle2,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

interface Shop {
  id: number;
  name: string;
  email: string;
  phone: string;
  owner: string;
  owner_email: string;
  is_active: boolean;
  created_at: string;
  plan: string;
  subscription_id: number | null;
  subscription_status: string;
  billing_type: string | null;
  starts_at: string | null;
  expires_at: string | null;
  product_count: number;
  order_count: number;
}

const STATUS_COLORS: Record<string, string> = {
  active:           'bg-green-500/10 text-green-400',
  trial:            'bg-blue-500/10 text-blue-400',
  pending_approval: 'bg-yellow-500/10 text-yellow-400',
  expired:          'bg-red-500/10 text-red-400',
  cancelled:        'bg-gray-500/10 text-gray-400',
  none:             'bg-gray-500/10 text-gray-500',
};

const STATUS_LABELS: Record<string, string> = {
  active:           'Active',
  trial:            'Trial',
  pending_approval: 'Pending Approval',
  expired:          'Expired',
  cancelled:        'Cancelled',
  none:             '—',
};

const PLAN_COLORS: Record<string, string> = {
  free_trial: 'text-blue-400',
  starter:    'text-gray-300',
  premium:    'text-[#9B6FFF]',
  none:       'text-gray-500',
};

function fmt(dateStr: string | null) {
  if (!dateStr) return 'Lifetime';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function DetailModal({ shop, onClose, onApprove }: { shop: Shop; onClose: () => void; onApprove: (id: number) => void }) {
  const [approving, setApproving] = useState(false);

  const handleApprove = async () => {
    if (!shop.subscription_id) return;
    setApproving(true);
    await onApprove(shop.subscription_id);
    setApproving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#151F32] border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#6B3FD9]/10 rounded-xl flex items-center justify-center">
              <Store className="w-5 h-5 text-[#6B3FD9]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{shop.name}</h3>
              <p className="text-xs text-gray-500">{shop.email}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-gray-500 hover:text-white transition rounded-lg hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Status row */}
          <div className="flex items-center justify-between">
            <span className={`text-sm px-3 py-1.5 rounded-lg font-medium ${STATUS_COLORS[shop.subscription_status] ?? 'bg-gray-500/10 text-gray-400'}`}>
              {STATUS_LABELS[shop.subscription_status] ?? shop.subscription_status}
            </span>
            <span className={`text-sm font-semibold capitalize ${PLAN_COLORS[shop.plan] ?? 'text-gray-400'}`}>
              {shop.plan === 'free_trial' ? 'Free Trial' : shop.plan || '—'}
              {shop.billing_type ? ` · ${shop.billing_type}` : ''}
            </span>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0B1121] rounded-xl p-4 flex items-center gap-3">
              <Package className="w-5 h-5 text-[#6B3FD9]" />
              <div>
                <p className="text-2xl font-bold text-white">{shop.product_count}</p>
                <p className="text-xs text-gray-500">Products</p>
              </div>
            </div>
            <div className="bg-[#0B1121] rounded-xl p-4 flex items-center gap-3">
              <ShoppingCart className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-2xl font-bold text-white">{shop.order_count}</p>
                <p className="text-xs text-gray-500">Orders</p>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="bg-[#0B1121] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Calendar className="w-4 h-4" />
                <span>Registered</span>
              </div>
              <span className="text-sm text-white">{fmt(shop.created_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Clock className="w-4 h-4" />
                <span>Plan Started</span>
              </div>
              <span className="text-sm text-white">{fmt(shop.starts_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Clock className="w-4 h-4" />
                <span>Plan Expires</span>
              </div>
              <span className={`text-sm font-medium ${shop.expires_at ? 'text-orange-400' : 'text-green-400'}`}>
                {shop.expires_at ? fmt(shop.expires_at) : 'Lifetime'}
              </span>
            </div>
          </div>

          {/* Owner */}
          <div className="bg-[#0B1121] rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Owner</p>
            <p className="text-white font-medium">{shop.owner}</p>
            <p className="text-sm text-gray-400">{shop.owner_email}</p>
            {shop.phone && <p className="text-sm text-gray-400">{shop.phone}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          {shop.subscription_status === 'pending_approval' && shop.subscription_id && (
            <button
              type="button"
              onClick={handleApprove}
              disabled={approving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition"
            >
              {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Approve Account
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-[#0B1121] border border-gray-700 text-gray-300 text-sm font-medium hover:text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewShop, setViewShop] = useState<Shop | null>(null);

  const fetchShops = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getShops({
        search: searchQuery || undefined,
        status_filter: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setShops(res.data ?? []);
    } catch {
      setShops([]);
    }
    setLoading(false);
  }, [searchQuery, statusFilter]);

  useEffect(() => { fetchShops(); }, [fetchShops]);

  const toggleStatus = async (shop: Shop) => {
    try {
      await adminApi.toggleShopStatus(shop.id);
      setShops((prev) =>
        prev.map((s) => s.id === shop.id ? { ...s, is_active: !s.is_active } : s)
      );
    } catch {/* no-op */}
  };

  const handleApprove = async (subId: number) => {
    try {
      await adminApi.approveSubscription(subId);
      setShops((prev) =>
        prev.map((s) => s.subscription_id === subId ? { ...s, subscription_status: 'active' } : s)
      );
      if (viewShop?.subscription_id === subId) {
        setViewShop((prev) => prev ? { ...prev, subscription_status: 'active' } : prev);
      }
    } catch {/* no-op */}
  };

  const activeCount = shops.filter((s) => s.is_active).length;
  const pendingCount = shops.filter((s) => s.subscription_status === 'pending_approval').length;
  const suspendedCount = shops.filter((s) => !s.is_active).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Stores</h1>
        <p className="text-gray-400 text-sm mt-1">Manage all registered stores</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Total Stores</p>
          <p className="text-2xl font-bold text-white mt-1">{loading ? '—' : shops.length}</p>
        </div>
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Active</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{loading ? '—' : activeCount}</p>
        </div>
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Pending Approval</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{loading ? '—' : pendingCount}</p>
        </div>
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Suspended</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{loading ? '—' : suspendedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search stores, owners, emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-9 pr-8 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white focus:border-[#6B3FD9] focus:outline-none transition appearance-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 text-[#6B3FD9] animate-spin" />
        </div>
      ) : shops.length === 0 ? (
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-16 text-center">
          <Store className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No stores found</p>
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
                    <th className="px-6 py-4 font-medium">Owner</th>
                    <th className="px-6 py-4 font-medium">Plan</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Expires</th>
                    <th className="px-6 py-4 font-medium">Products</th>
                    <th className="px-6 py-4 font-medium">Orders</th>
                    <th className="px-6 py-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shops.map((shop) => (
                    <tr key={shop.id} className="border-b border-gray-800 last:border-0 hover:bg-[#1A2540] transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-[#6B3FD9]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Store className="w-4 h-4 text-[#6B3FD9]" />
                          </div>
                          <div>
                            <p className="font-medium text-white text-sm">{shop.name}</p>
                            <p className="text-xs text-gray-500">{shop.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-white">{shop.owner}</p>
                        <p className="text-xs text-gray-500">{shop.owner_email}</p>
                      </td>
                      <td className={`px-6 py-4 text-sm font-medium capitalize ${PLAN_COLORS[shop.plan] ?? 'text-gray-400'}`}>
                        {shop.plan === 'free_trial' ? 'Free Trial' : shop.plan || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-lg whitespace-nowrap ${STATUS_COLORS[shop.subscription_status] ?? 'bg-gray-500/10 text-gray-400'}`}>
                          {STATUS_LABELS[shop.subscription_status] ?? shop.subscription_status}
                        </span>
                        {!shop.is_active && (
                          <span className="ml-1 text-xs px-2 py-0.5 rounded-lg bg-red-500/10 text-red-400">suspended</span>
                        )}
                      </td>
                      <td className={`px-6 py-4 text-sm ${shop.expires_at ? 'text-orange-400' : 'text-green-400'}`}>
                        {shop.expires_at ? fmt(shop.expires_at) : 'Lifetime'}
                      </td>
                      <td className="px-6 py-4 text-sm text-white font-medium">{shop.product_count}</td>
                      <td className="px-6 py-4 text-sm text-white font-medium">{shop.order_count}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title="View details"
                            onClick={() => setViewShop(shop)}
                            className="p-1.5 rounded-lg text-[#9B6FFF] hover:bg-[#6B3FD9]/10 transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {shop.subscription_status === 'pending_approval' && shop.subscription_id && (
                            <button
                              type="button"
                              title="Approve account"
                              onClick={() => handleApprove(shop.subscription_id!)}
                              className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/10 transition"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleStatus(shop)}
                            title={shop.is_active ? 'Suspend store' : 'Activate store'}
                            className={`p-1.5 rounded-lg transition ${shop.is_active ? 'text-red-400 hover:bg-red-500/10' : 'text-green-400 hover:bg-green-500/10'}`}
                          >
                            {shop.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-4">
            {shops.map((shop) => (
              <div key={shop.id} className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#6B3FD9]/10 rounded-lg flex items-center justify-center">
                      <Store className="w-5 h-5 text-[#6B3FD9]" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{shop.name}</p>
                      <p className="text-sm text-gray-400">{shop.owner}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-lg whitespace-nowrap ${STATUS_COLORS[shop.subscription_status] ?? 'bg-gray-500/10 text-gray-400'}`}>
                    {STATUS_LABELS[shop.subscription_status] ?? shop.subscription_status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
                  <div className="bg-[#0B1121] rounded-lg p-2">
                    <p className="text-white font-semibold">{shop.product_count}</p>
                    <p className="text-gray-500">Products</p>
                  </div>
                  <div className="bg-[#0B1121] rounded-lg p-2">
                    <p className="text-white font-semibold">{shop.order_count}</p>
                    <p className="text-gray-500">Orders</p>
                  </div>
                  <div className="bg-[#0B1121] rounded-lg p-2">
                    <p className={`font-semibold text-xs ${shop.expires_at ? 'text-orange-400' : 'text-green-400'}`}>
                      {shop.expires_at ? fmt(shop.expires_at) : 'Lifetime'}
                    </p>
                    <p className="text-gray-500">Expires</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-3 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setViewShop(shop)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg bg-[#6B3FD9]/10 text-[#9B6FFF] transition"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                  {shop.subscription_status === 'pending_approval' && shop.subscription_id && (
                    <button
                      type="button"
                      onClick={() => handleApprove(shop.subscription_id!)}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg bg-green-500/10 text-green-400 transition"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Approve
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleStatus(shop)}
                    className={`flex-1 text-xs py-1.5 rounded-lg transition ${shop.is_active ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}
                  >
                    {shop.is_active ? 'Suspend' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {viewShop && (
        <DetailModal
          shop={viewShop}
          onClose={() => setViewShop(null)}
          onApprove={handleApprove}
        />
      )}
    </div>
  );
}
