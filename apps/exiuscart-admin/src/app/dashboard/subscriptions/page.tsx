'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Package, Calendar, TrendingUp, AlertCircle, Loader2,
  Check, X, AlertTriangle, ChevronRight,
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

const PLAN_LABELS: Record<string, string> = {
  free_trial:      'Free Trial',
  thedersi_basic:  'TheDersi Basic',
  thedersi_pro:    'TheDersi Pro',
  starter:         'Starter',
  premium:         'Premium',
  pro:             'Pro',
};

const planStyles: Record<string, string> = {
  free_trial:     'text-gray-400',
  thedersi_basic: 'text-blue-400',
  thedersi_pro:   'text-indigo-400',
  starter:        'text-gray-400',
  premium:        'text-[#6B3FD9]',
  pro:            'text-[#6B3FD9]',
};

const statusStyles: Record<string, string> = {
  active:           'bg-green-500/10 text-green-400',
  trial:            'bg-blue-500/10 text-blue-400',
  pending_approval: 'bg-yellow-500/10 text-yellow-400',
  expiring:         'bg-orange-500/10 text-orange-400',
  expired:          'bg-red-500/10 text-red-400',
  cancelled:        'bg-gray-500/10 text-gray-400',
};

// ── Confirmation Modal ─────────────────────────────────────────────────────────

function ConfirmModal({
  sub,
  action,
  onConfirm,
  onCancel,
  loading,
  error,
}: {
  sub: Subscription;
  action: 'approve' | 'reject';
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  error: string;
}) {
  const isApprove = action === 'approve';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-[#151F32] border border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isApprove ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
            {isApprove
              ? <Check className="w-5 h-5 text-green-400" />
              : <AlertTriangle className="w-5 h-5 text-red-400" />}
          </div>
          <div>
            <h3 className="font-semibold text-white">
              {isApprove ? 'Approve Subscription?' : 'Reject Subscription?'}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {isApprove
                ? 'This will activate the plan and send the seller a dashboard access email.'
                : 'This will cancel the request. The seller stays on their current plan.'}
            </p>
          </div>
        </div>

        {/* Plan detail */}
        <div className="bg-[#0B1121] rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Shop</span>
            <span className="text-white font-medium">{sub.shop_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Requested Plan</span>
            <span className={`font-semibold ${planStyles[sub.plan_type] ?? 'text-gray-400'}`}>
              {PLAN_LABELS[sub.plan_type] ?? sub.plan_type}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Billing</span>
            <span className="text-white capitalize">{sub.billing_type?.replace('_', '-') ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Amount Paid</span>
            <span className="text-white font-medium">
              {sub.amount_paid > 0 ? `${sub.amount_paid} ${sub.currency}` : 'Free'}
            </span>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 px-4 py-2.5 border border-gray-700 rounded-lg text-sm font-medium text-gray-300 hover:bg-[#1A2540] transition disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2 ${
              isApprove
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Processing...' : isApprove ? 'Yes, Approve' : 'Yes, Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'pending'>('subscriptions');

  const [modal, setModal] = useState<{ sub: Subscription; action: 'approve' | 'reject' } | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

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
    const isPending = s.status === 'pending_approval';
    const matchTab = activeTab === 'subscriptions' || (activeTab === 'pending' && isPending);
    return matchSearch && matchTab;
  });

  const handleConfirm = async () => {
    if (!modal) return;
    setModalLoading(true);
    setModalError('');
    try {
      if (modal.action === 'approve') {
        await adminApi.approveSubscription(modal.sub.id);
        const newStatus = modal.sub.plan_type === 'free_trial' ? 'trial' : 'active';
        setSubs((prev) => prev.map((s) => s.id === modal.sub.id ? { ...s, status: newStatus } : s));
        showToast(`✅ ${modal.sub.shop_name} approved — plan activated`);
      } else {
        await adminApi.rejectSubscription(modal.sub.id);
        setSubs((prev) => prev.map((s) => s.id === modal.sub.id ? { ...s, status: 'cancelled' } : s));
        showToast(`❌ ${modal.sub.shop_name} request rejected`);
      }
      setModal(null);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Action failed. Please try again.';
      setModalError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setModalLoading(false);
    }
  };

  const pendingCount = subs.filter((s) => s.status === 'pending_approval').length;

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#151F32] border border-gray-700 rounded-xl px-4 py-3 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}

      {/* Confirm modal */}
      {modal && (
        <ConfirmModal
          sub={modal.sub}
          action={modal.action}
          onConfirm={handleConfirm}
          onCancel={() => { setModal(null); setModalError(''); }}
          loading={modalLoading}
          error={modalError}
        />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
        <p className="text-gray-400 text-sm mt-1">Manage plans and active subscriptions</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button type="button" onClick={() => setActiveTab('subscriptions')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition ${activeTab === 'subscriptions' ? 'bg-[#6B3FD9] text-black' : 'bg-[#151F32] text-gray-400 hover:text-white border border-gray-800'}`}>
          All Subscriptions
        </button>
        <button type="button" onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${activeTab === 'pending' ? 'bg-[#6B3FD9] text-black' : 'bg-[#151F32] text-gray-400 hover:text-white border border-gray-800'}`}>
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
            <div className="p-2.5 rounded-lg bg-[#6B3FD9]/10 text-[#6B3FD9]"><TrendingUp className="w-5 h-5" /></div>
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search stores..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition"
            />
          </div>
          <div className="flex gap-3">
            <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}
              className="px-4 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white focus:border-[#6B3FD9] focus:outline-none transition appearance-none cursor-pointer">
              <option value="all">All Plans</option>
              <option value="free_trial">Free Trial</option>
              <option value="thedersi_basic">TheDersi Basic</option>
              <option value="thedersi_pro">TheDersi Pro</option>
              <option value="starter">Starter</option>
              <option value="premium">Premium</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white focus:border-[#6B3FD9] focus:outline-none transition appearance-none cursor-pointer">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="pending_approval">Pending</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
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
                  <th className="px-6 py-4 font-medium">Store</th>
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
                    <td className={`px-6 py-4 font-medium ${planStyles[sub.plan_type] ?? 'text-gray-400'}`}>
                      {PLAN_LABELS[sub.plan_type] ?? sub.plan_type}
                    </td>
                    <td className="px-6 py-4 text-gray-400 capitalize">{sub.billing_type?.replace('_', '-') ?? '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-lg capitalize ${statusStyles[sub.status] ?? 'bg-gray-500/10 text-gray-400'}`}>
                        {sub.status === 'pending_approval' ? 'Pending Approval' : sub.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-white">
                      {sub.amount_paid > 0 ? `${sub.amount_paid} ${sub.currency}` : 'Free'}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : 'Lifetime'}
                    </td>
                    <td className="px-6 py-4">
                      {sub.status === 'pending_approval' ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => { setModalError(''); setModal({ sub, action: 'approve' }); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition"
                          >
                            <Check className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => { setModalError(''); setModal({ sub, action: 'reject' }); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                          >
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
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
                  <span className={`text-xs px-2.5 py-1 rounded-lg ${statusStyles[sub.status] ?? 'bg-gray-500/10 text-gray-400'}`}>
                    {sub.status === 'pending_approval' ? 'Pending' : sub.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <ChevronRight className="w-3 h-3 text-gray-600" />
                  <span className={`text-sm font-medium ${planStyles[sub.plan_type] ?? 'text-gray-400'}`}>
                    {PLAN_LABELS[sub.plan_type] ?? sub.plan_type}
                  </span>
                  <span className="text-xs text-gray-500 capitalize">{sub.billing_type?.replace('_', '-')}</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-3 border-t border-gray-800 mt-3">
                  <span className="text-gray-400">{sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : 'Lifetime'}</span>
                  <span className="text-white font-medium">{sub.amount_paid > 0 ? `${sub.amount_paid} ${sub.currency}` : 'Free'}</span>
                </div>
                {sub.status === 'pending_approval' && (
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => { setModalError(''); setModal({ sub, action: 'approve' }); }}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition text-sm font-medium"
                    >
                      <Check className="w-4 h-4" /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => { setModalError(''); setModal({ sub, action: 'reject' }); }}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition text-sm font-medium"
                    >
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
