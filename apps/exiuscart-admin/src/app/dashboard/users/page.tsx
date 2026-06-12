'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, User, Store, CheckCircle, Ban, Loader2 } from 'lucide-react';
import { adminApi } from '@/lib/api';

interface AdminUser {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  store_name: string | null;
  store_id: number | null;
  plan_type: string | null;
  plan_status: string | null;
  source: 'thedersi' | 'exiuscart';
}

const PLAN_LABEL: Record<string, string> = {
  thedersi_basic: 'Free Forever',
  free_trial:     'Free Trial',
  starter:        'Starter',
  premium:        'Premium',
};

const PLAN_COLOR: Record<string, string> = {
  thedersi_basic: 'bg-gray-500/10 text-gray-400',
  free_trial:     'bg-blue-500/10 text-blue-400',
  starter:        'bg-indigo-500/10 text-indigo-400',
  premium:        'bg-purple-500/10 text-purple-400',
};

export default function UsersPage() {
  const [users, setUsers]         = useState<AdminUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [searchQuery, setSearch]  = useState('');
  const [statusFilter, setStatus] = useState('all');
  const [sourceFilter, setSource] = useState('all');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getUsers({ search: searchQuery || undefined });
      setUsers(res.data ?? []);
    } catch { setUsers([]); }
    setLoading(false);
  }, [searchQuery]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = users.filter((u) => {
    if (statusFilter === 'active'    && !u.is_active) return false;
    if (statusFilter === 'suspended' && u.is_active)  return false;
    if (sourceFilter !== 'all' && u.source !== sourceFilter) return false;
    return true;
  });

  const toggleStatus = async (user: AdminUser) => {
    try {
      await adminApi.toggleUserStatus(user.id);
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
    } catch {/* no-op */}
  };

  const theDersiCount = users.filter((u) => u.source === 'thedersi').length;
  const directCount   = users.filter((u) => u.source === 'exiuscart').length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="text-gray-400 text-sm mt-1">Manage store owners and their plans</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Users',      value: users.length,                                         color: 'text-white' },
          { label: 'Active',           value: users.filter((u) => u.is_active).length,              color: 'text-green-400' },
          { label: 'TheDersi Sellers', value: theDersiCount,                                        color: 'text-indigo-400' },
          { label: 'Direct Sellers',   value: directCount,                                          color: 'text-purple-400' },
        ].map((s) => (
          <div key={s.label} className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
            <p className="text-gray-400 text-sm">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search users, emails, stores..."
              value={searchQuery}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition"
            />
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <select value={statusFilter} onChange={(e) => setStatus(e.target.value)}
                className="pl-9 pr-8 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white focus:border-[#6B3FD9] focus:outline-none transition appearance-none cursor-pointer">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <select value={sourceFilter} onChange={(e) => setSource(e.target.value)}
              className="px-4 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white focus:border-[#6B3FD9] focus:outline-none transition appearance-none cursor-pointer">
              <option value="all">All Sources</option>
              <option value="thedersi">TheDersi</option>
              <option value="exiuscart">ExiusCart Direct</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 text-[#6B3FD9] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-16 text-center">
          <User className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No users found</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-[#151F32] rounded-xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                    <th className="px-6 py-4 font-medium">User</th>
                    <th className="px-6 py-4 font-medium">Store</th>
                    <th className="px-6 py-4 font-medium">Plan</th>
                    <th className="px-6 py-4 font-medium">Source</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Registered</th>
                    <th className="px-6 py-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr key={user.id} className="border-b border-gray-800 last:border-0 hover:bg-[#1A2540] transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#6B3FD9]/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-semibold text-[#6B3FD9]">
                              {user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-white">{user.full_name}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {user.store_name ? (
                          <div className="flex items-center gap-2">
                            <Store className="w-4 h-4 text-gray-500" />
                            <span className="text-white">{user.store_name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-600 text-sm">No store</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {user.plan_type ? (
                          <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${PLAN_COLOR[user.plan_type] ?? 'bg-gray-500/10 text-gray-400'}`}>
                            {PLAN_LABEL[user.plan_type] ?? user.plan_type}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {user.source === 'thedersi' ? (
                          <span className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 font-medium">
                            TheDersi
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 font-medium">
                            Direct
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-lg ${user.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                          {user.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <button type="button" onClick={() => toggleStatus(user)}
                          title={user.is_active ? 'Suspend user' : 'Activate user'}
                          className={`p-2 rounded-lg transition ${user.is_active ? 'text-red-400 hover:bg-red-500/10' : 'text-green-400 hover:bg-green-500/10'}`}>
                          {user.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
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
            {filtered.map((user) => (
              <div key={user.id} className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#6B3FD9]/10 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-[#6B3FD9]">
                        {user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-white">{user.full_name}</p>
                      <p className="text-sm text-gray-400">{user.email}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-lg ${user.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {user.is_active ? 'Active' : 'Suspended'}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {user.store_name && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-400">
                      <Store className="w-3.5 h-3.5" />
                      <span>{user.store_name}</span>
                    </div>
                  )}
                  {user.plan_type && (
                    <span className={`text-xs px-2 py-0.5 rounded-lg ${PLAN_COLOR[user.plan_type] ?? 'bg-gray-500/10 text-gray-400'}`}>
                      {PLAN_LABEL[user.plan_type] ?? user.plan_type}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-lg ${user.source === 'thedersi' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-purple-500/10 text-purple-400'}`}>
                    {user.source === 'thedersi' ? 'TheDersi' : 'Direct'}
                  </span>
                </div>
                <div className="pt-3 border-t border-gray-800">
                  <button type="button" onClick={() => toggleStatus(user)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition ${user.is_active ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                    {user.is_active ? 'Suspend User' : 'Activate User'}
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
