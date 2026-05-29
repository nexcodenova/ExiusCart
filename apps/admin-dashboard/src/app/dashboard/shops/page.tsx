'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, Store, Eye, Ban, CheckCircle, Loader2,
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
  subscription_status: string;
  billing_type: string | null;
}

export default function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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

  const activeCount = shops.filter((s) => s.is_active).length;
  const suspendedCount = shops.filter((s) => !s.is_active).length;

  const planStyles: Record<string, string> = {
    starter: 'text-gray-400',
    business: 'text-blue-400',
    pro: 'text-[#6B3FD9]',
    none: 'text-gray-600',
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Shops</h1>
          <p className="text-gray-400 text-sm mt-1">Manage all registered shops</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search shops, owners, emails..."
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

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Total Shops</p>
          <p className="text-2xl font-bold text-white mt-1">{loading ? '—' : shops.length}</p>
        </div>
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Active</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{loading ? '—' : activeCount}</p>
        </div>
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-sm">Suspended</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{loading ? '—' : suspendedCount}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 text-[#6B3FD9] animate-spin" />
        </div>
      ) : shops.length === 0 ? (
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-16 text-center">
          <Store className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No shops found</p>
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
                    <th className="px-6 py-4 font-medium">Owner</th>
                    <th className="px-6 py-4 font-medium">Plan</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Registered</th>
                    <th className="px-6 py-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shops.map((shop) => (
                    <tr key={shop.id} className="border-b border-gray-800 last:border-0 hover:bg-[#1A2540] transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#6B3FD9]/10 rounded-lg flex items-center justify-center">
                            <Store className="w-5 h-5 text-[#6B3FD9]" />
                          </div>
                          <div>
                            <p className="font-medium text-white">{shop.name}</p>
                            <p className="text-xs text-gray-500">{shop.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-white">{shop.owner}</p>
                        <p className="text-xs text-gray-500">{shop.phone}</p>
                      </td>
                      <td className={`px-6 py-4 font-medium capitalize ${planStyles[shop.plan] ?? 'text-gray-400'}`}>
                        {shop.plan}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-lg ${shop.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                          {shop.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm">
                        {shop.created_at ? new Date(shop.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => toggleStatus(shop)}
                          title={shop.is_active ? 'Suspend shop' : 'Activate shop'}
                          className={`p-2 rounded-lg transition ${shop.is_active ? 'text-red-400 hover:bg-red-500/10' : 'text-green-400 hover:bg-green-500/10'}`}
                        >
                          {shop.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
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
                  <span className={`text-xs px-2.5 py-1 rounded-lg ${shop.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {shop.is_active ? 'Active' : 'Suspended'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                  <span className={`text-sm font-medium capitalize ${planStyles[shop.plan] ?? 'text-gray-400'}`}>{shop.plan}</span>
                  <button
                    type="button"
                    onClick={() => toggleStatus(shop)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition ${shop.is_active ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}
                  >
                    {shop.is_active ? 'Suspend' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

