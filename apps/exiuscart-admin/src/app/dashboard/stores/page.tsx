'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Store, Loader2, CheckCircle, XCircle,
  Trash2, RefreshCw, ChevronDown,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

interface ShopRow {
  id: number;
  name: string;
  email: string;
  owner: string;
  owner_email: string;
  is_active: boolean;
  created_at: string | null;
  subscription_id: number | null;
  plan: string;
  subscription_status: string;
  billing_type: string | null;
  starts_at: string | null;
  expires_at: string | null;
}

const PLAN_OPTIONS = [
  { value: 'free_trial', label: 'Free Trial' },
  { value: 'starter', label: 'Starter' },
  { value: 'premium', label: 'Premium' },
];

const PLAN_COLORS: Record<string, string> = {
  free_trial: 'text-blue-400',
  starter:    'text-gray-300',
  premium:    'text-[#6B3FD9]',
  none:       'text-gray-500',
};

const STATUS_COLORS: Record<string, string> = {
  active:           'bg-green-500/10 text-green-400',
  trial:            'bg-blue-500/10 text-blue-400',
  pending_approval: 'bg-yellow-500/10 text-yellow-400',
  expired:          'bg-red-500/10 text-red-400',
  cancelled:        'bg-gray-500/10 text-gray-400',
  none:             'bg-gray-500/10 text-gray-500',
};

function fmt(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function StoresPage() {
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [changingPlan, setChangingPlan] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ShopRow | null>(null);
  const [planDropdown, setPlanDropdown] = useState<number | null>(null);

  const fetchShops = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getShops({
        search: search || undefined,
        status_filter: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setShops(res.data ?? []);
    } catch {
      setShops([]);
    }
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => { fetchShops(); }, [fetchShops]);

  const toggleStatus = async (shop: ShopRow) => {
    setTogglingId(shop.id);
    try {
      await adminApi.toggleShopStatus(shop.id);
      setShops((prev) => prev.map((s) => s.id === shop.id ? { ...s, is_active: !s.is_active } : s));
    } finally {
      setTogglingId(null);
    }
  };

  const changePlan = async (shopId: number, plan_type: string, billing_type: string) => {
    setChangingPlan(shopId);
    setPlanDropdown(null);
    try {
      await adminApi.changeShopPlan(shopId, plan_type, billing_type);
      await fetchShops();
    } finally {
      setChangingPlan(null);
    }
  };

  const confirmAndDelete = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    try {
      await adminApi.deleteShop(confirmDelete.id);
      setShops((prev) => prev.filter((s) => s.id !== confirmDelete.id));
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const totalActive = shops.filter((s) => s.is_active).length;
  const totalSuspended = shops.filter((s) => !s.is_active).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Stores</h1>
        <p className="text-gray-400 text-sm mt-1">Manage all registered stores</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4 flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Total Stores</p>
            <p className="text-2xl font-bold text-white mt-1">{shops.length}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-[#6B3FD9]/10 text-[#6B3FD9]"><Store className="w-5 h-5" /></div>
        </div>
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4 flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Active</p>
            <p className="text-2xl font-bold text-white mt-1">{totalActive}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-green-500/10 text-green-400"><CheckCircle className="w-5 h-5" /></div>
        </div>
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4 flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Suspended</p>
            <p className="text-2xl font-bold text-white mt-1">{totalSuspended}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-red-500/10 text-red-400"><XCircle className="w-5 h-5" /></div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search stores, owners, emails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white focus:border-[#6B3FD9] focus:outline-none text-sm"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
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
        <div className="bg-[#151F32] rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-800">
                <th className="px-5 py-3 font-medium">Store</th>
                <th className="px-5 py-3 font-medium">Owner</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Starts</th>
                <th className="px-5 py-3 font-medium">Expires</th>
                <th className="px-5 py-3 font-medium">Registered</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((shop) => (
                <tr key={shop.id} className="border-b border-gray-800 last:border-0 hover:bg-[#1A2540] transition">
                  <td className="px-5 py-4">
                    <p className="font-medium text-white text-sm">{shop.name}</p>
                    <p className="text-xs text-gray-500">{shop.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm text-gray-300">{shop.owner}</p>
                    <p className="text-xs text-gray-500">{shop.owner_email}</p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setPlanDropdown(planDropdown === shop.id ? null : shop.id)}
                        className={`flex items-center gap-1 text-sm font-medium capitalize hover:opacity-80 transition ${PLAN_COLORS[shop.plan] ?? 'text-gray-400'}`}
                        title="Click to change plan"
                      >
                        {changingPlan === shop.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : null}
                        {shop.plan === 'free_trial' ? 'Free Trial' : shop.plan || '—'}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {planDropdown === shop.id && (
                        <div className="absolute z-50 left-0 top-7 w-48 bg-[#0B1121] border border-gray-700 rounded-xl shadow-xl overflow-hidden">
                          <p className="px-3 pt-2 pb-1 text-xs text-gray-500 font-medium">Change plan</p>
                          {PLAN_OPTIONS.map((opt) => (
                            <div key={opt.value} className="px-1 pb-1">
                              <button
                                type="button"
                                onClick={() => changePlan(shop.id, opt.value, 'monthly')}
                                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[#6B3FD9]/10 rounded-lg transition"
                              >
                                {opt.label} <span className="text-gray-500 text-xs">(monthly)</span>
                              </button>
                              {opt.value !== 'free_trial' && (
                                <button
                                  type="button"
                                  onClick={() => changePlan(shop.id, opt.value, 'yearly')}
                                  className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[#6B3FD9]/10 rounded-lg transition"
                                >
                                  {opt.label} <span className="text-gray-500 text-xs">(yearly)</span>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-lg capitalize ${STATUS_COLORS[shop.subscription_status] ?? 'bg-gray-500/10 text-gray-400'}`}>
                      {shop.subscription_status === 'none' ? '—' : shop.subscription_status}
                    </span>
                    {!shop.is_active && (
                      <span className="ml-1 text-xs px-2 py-0.5 rounded-lg bg-red-500/10 text-red-400">suspended</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs text-gray-400">{fmt(shop.starts_at)}</td>
                  <td className="px-5 py-4 text-xs text-gray-400">{fmt(shop.expires_at)}</td>
                  <td className="px-5 py-4 text-xs text-gray-400">{fmt(shop.created_at)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title={shop.is_active ? 'Suspend store' : 'Activate store'}
                        onClick={() => toggleStatus(shop)}
                        disabled={togglingId === shop.id}
                        className={`p-1.5 rounded-lg transition ${shop.is_active ? 'text-orange-400 hover:bg-orange-500/10' : 'text-green-400 hover:bg-green-500/10'}`}
                      >
                        {togglingId === shop.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        title="Delete store"
                        onClick={() => setConfirmDelete(shop)}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#151F32] border border-gray-700 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-red-500/10">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Delete Store</h3>
            </div>
            <p className="text-gray-400 text-sm mb-2">
              Are you sure you want to delete <span className="text-white font-medium">{confirmDelete.name}</span>?
            </p>
            <p className="text-gray-500 text-xs mb-6">
              This will deactivate the store and cancel the subscription. The data will be archived.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#0B1121] border border-gray-700 text-gray-300 text-sm font-medium hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAndDelete}
                disabled={deletingId !== null}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition flex items-center justify-center gap-2"
              >
                {deletingId !== null ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close plan dropdown on outside click */}
      {planDropdown !== null && (
        <div className="fixed inset-0 z-40" onClick={() => setPlanDropdown(null)} />
      )}
    </div>
  );
}
