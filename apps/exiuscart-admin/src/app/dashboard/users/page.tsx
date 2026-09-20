'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, User, Store, CheckCircle, Ban, Loader2, Tag, Eye, X, Mail, Phone } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { PlanChip, StatusChip, PlanDates, fmtDate, daysLeftText } from '@/lib/subscription-ui';

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
  billing_type: string | null;
  starts_at: string | null;
  expires_at: string | null;
  source: 'thedersi' | 'exiuscart';
  referred_by_code: string | null;
}

const PLAN_LABEL: Record<string, string> = {
  thedersi_free_forever: 'Free Forever',
  thedersi_lite:         'TheDersi Lite',
  free_trial:            'Free Trial',
  starter:               'Starter',
  premium:               'Premium',
};

const PLAN_COLOR: Record<string, string> = {
  thedersi_free_forever: 'bg-gray-500/10 text-gray-600',
  thedersi_lite:         'bg-teal-500/10 text-teal-400',
  free_trial:            'bg-blue-500/10 text-blue-600',
  starter:               'bg-indigo-500/10 text-indigo-400',
  premium:               'bg-purple-500/10 text-purple-600',
};

export default function UsersPage() {
  const [users, setUsers]         = useState<AdminUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [searchQuery, setSearch]  = useState('');
  const [statusFilter, setStatus] = useState('all');
  const [sourceFilter, setSource] = useState('all');
  const [selected, setSelected] = useState<AdminUser | null>(null);

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
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-600 text-sm mt-1">Manage store owners and their plans</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Users',      value: users.length,                                         color: 'text-gray-900' },
          { label: 'Active',           value: users.filter((u) => u.is_active).length,              color: 'text-green-600' },
          { label: 'TheDersi Sellers', value: theDersiCount,                                        color: 'text-indigo-400' },
          { label: 'Direct Sellers',   value: directCount,                                          color: 'text-purple-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-gray-600 text-sm">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search users, emails, stores..."
              value={searchQuery}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:border-[#6B3FD9] focus:outline-none transition"
            />
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <select value={statusFilter} onChange={(e) => setStatus(e.target.value)}
                className="pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:border-[#6B3FD9] focus:outline-none transition appearance-none cursor-pointer">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <select value={sourceFilter} onChange={(e) => setSource(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:border-[#6B3FD9] focus:outline-none transition appearance-none cursor-pointer">
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
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No users found</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Store</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Expires</th>
                    <th className="px-4 py-3 font-medium">Account</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => {
                    const left = daysLeftText(user.expires_at);
                    return (
                      <tr key={user.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-[#6B3FD9]/10 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-semibold text-[#6B3FD9]">
                                {user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                              </span>
                            </div>
                            <div className="min-w-0 max-w-[15rem]">
                              <p className="truncate font-medium text-gray-900">{user.full_name}</p>
                              <p className="truncate text-xs text-gray-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {user.store_name ? (
                            <span className="block max-w-[10rem] truncate text-gray-800" title={user.store_name}>{user.store_name}</span>
                          ) : (
                            <span className="text-gray-400">No store</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {user.plan_type ? (
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <PlanChip plan={user.plan_type} />
                              <StatusChip status={user.plan_status} />
                            </div>
                          ) : (
                            <span className="text-gray-400">No plan</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                          {user.plan_type ? (
                            <>
                              {user.expires_at ? fmtDate(user.expires_at) : 'Lifetime'}
                              {left && user.plan_status !== 'expired' && user.plan_status !== 'cancelled' && (
                                <span className={left.tone === 'gone' ? 'block text-red-600' : left.tone === 'soon' ? 'block text-orange-600' : 'block text-gray-400'}>{left.text}</span>
                              )}
                            </>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2.5 py-1 rounded-lg ${user.is_active ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                            {user.is_active ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => setSelected(user)} title="View all details" aria-label={`View details for ${user.full_name}`}
                              className="p-2 rounded-lg text-[#6B3FD9] hover:bg-[#6B3FD9]/10 transition">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => toggleStatus(user)}
                              title={user.is_active ? 'Suspend user' : 'Activate user'}
                              aria-label={user.is_active ? `Suspend ${user.full_name}` : `Activate ${user.full_name}`}
                              className={`p-2 rounded-lg transition ${user.is_active ? 'text-red-600 hover:bg-red-500/10' : 'text-green-600 hover:bg-green-500/10'}`}>
                              {user.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-4">
            {filtered.map((user) => (
              <div key={user.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#6B3FD9]/10 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-[#6B3FD9]">
                        {user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{user.full_name}</p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-lg ${user.is_active ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                    {user.is_active ? 'Active' : 'Suspended'}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {user.store_name && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <Store className="w-3.5 h-3.5" />
                      <span>{user.store_name}</span>
                    </div>
                  )}
                  {user.plan_type && <PlanChip plan={user.plan_type} />}
                  {user.plan_type && <StatusChip status={user.plan_status} />}
                  <span className={`text-xs px-2 py-0.5 rounded-lg ${user.source === 'thedersi' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-purple-500/10 text-purple-600'}`}>
                    {user.source === 'thedersi' ? 'TheDersi' : 'Direct'}
                  </span>
                </div>
                {user.plan_type && (
                  <div className="mb-3">
                    <PlanDates startsAt={user.starts_at} expiresAt={user.expires_at} status={user.plan_status} />
                  </div>
                )}
                <div className="pt-3 border-t border-gray-200">
                  <p className="mb-2 text-xs text-gray-400">Registered {fmtDate(user.created_at)}</p>
                  <button type="button" onClick={() => setSelected(user)}
                    className="mr-2 text-xs px-3 py-1.5 rounded-lg bg-[#6B3FD9]/10 text-[#6B3FD9] transition">
                    View details
                  </button>
                  <button type="button" onClick={() => toggleStatus(user)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition ${user.is_active ? 'bg-red-500/10 text-red-600' : 'bg-green-500/10 text-green-600'}`}>
                    {user.is_active ? 'Suspend User' : 'Activate User'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {selected && <UserDrawer user={selected} onClose={() => setSelected(null)} onToggle={toggleStatus} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="min-w-0 break-words text-right font-medium text-gray-900">{children}</span>
    </div>
  );
}

function UserDrawer({ user, onClose, onToggle }: { user: AdminUser; onClose: () => void; onToggle: (u: AdminUser) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const left = daysLeftText(user.expires_at);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside role="dialog" aria-label={`Details for ${user.full_name}`} className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 p-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 bg-[#6B3FD9]/10 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="font-semibold text-[#6B3FD9]">{user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}</span>
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-gray-900">{user.full_name}</h2>
              <span className={`mt-0.5 inline-block text-xs px-2 py-0.5 rounded-lg ${user.is_active ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                {user.is_active ? 'Active account' : 'Suspended'}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Contact</h3>
            <div className="divide-y divide-gray-100">
              <Field label="Email"><a href={`mailto:${user.email}`} className="inline-flex items-center gap-1.5 text-[#6B3FD9] hover:underline"><Mail className="w-3.5 h-3.5" />{user.email}</a></Field>
              <Field label="Phone">{user.phone ? <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400" />{user.phone}</span> : <span className="text-gray-400">Not given</span>}</Field>
              <Field label="Registered">{fmtDate(user.created_at)}</Field>
              <Field label="User ID">#{user.id}</Field>
            </div>
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Store</h3>
            <div className="divide-y divide-gray-100">
              <Field label="Store">{user.store_name ? <span className="inline-flex items-center gap-1.5"><Store className="w-3.5 h-3.5 text-gray-400" />{user.store_name}</span> : <span className="text-gray-400">No store yet</span>}</Field>
              {user.store_id && <Field label="Store ID">#{user.store_id}</Field>}
            </div>
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Plan</h3>
            {user.plan_type ? (
              <div className="divide-y divide-gray-100">
                <Field label="Plan"><PlanChip plan={user.plan_type} /></Field>
                <Field label="Status"><StatusChip status={user.plan_status} /></Field>
                <Field label="Billing"><span className="capitalize">{user.billing_type?.replace('_', '-') ?? '—'}</span></Field>
                <Field label="Started">{fmtDate(user.starts_at)}</Field>
                <Field label="Expires">
                  {user.expires_at ? fmtDate(user.expires_at) : 'Lifetime'}
                  {left && user.plan_status !== 'expired' && user.plan_status !== 'cancelled' && (
                    <span className={`block text-xs font-normal ${left.tone === 'gone' ? 'text-red-600' : left.tone === 'soon' ? 'text-orange-600' : 'text-gray-400'}`}>{left.text}</span>
                  )}
                </Field>
              </div>
            ) : (
              <p className="py-2 text-sm text-gray-400">No plan on this account.</p>
            )}
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Where they came from</h3>
            <div className="divide-y divide-gray-100">
              <Field label="Source">{user.source === 'thedersi' ? 'TheDersi' : 'ExiusCart direct'}</Field>
              <Field label="Referred by">{user.referred_by_code ? <span className="inline-flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-[#6B3FD9]" />{user.referred_by_code}</span> : <span className="text-gray-400">Nobody</span>}</Field>
            </div>
          </section>
        </div>

        <div className="border-t border-gray-200 p-4">
          <button
            type="button"
            onClick={() => { onToggle(user); onClose(); }}
            className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition ${user.is_active ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20' : 'bg-green-500/10 text-green-600 hover:bg-green-500/20'}`}
          >
            {user.is_active ? 'Suspend this user' : 'Activate this user'}
          </button>
        </div>
      </aside>
    </div>
  );
}
