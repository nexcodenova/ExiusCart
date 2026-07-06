'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Package, Calendar, TrendingUp, AlertCircle, Loader2,
  Check, X, AlertTriangle, ChevronDown, Pencil, ChevronRight,
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
  starter:        'text-gray-300',
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

const STATUS_LABEL: Record<string, string> = {
  active: 'Active', trial: 'Trial', pending_approval: 'Pending',
  expired: 'Expired', cancelled: 'Cancelled',
};

const SELECT_CLS = "w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white focus:border-[#6B3FD9] focus:outline-none appearance-none text-sm";
const INPUT_CLS  = "w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white focus:border-[#6B3FD9] focus:outline-none text-sm";

// ── Confirm Modal (Approve / Reject) ─────────────────────────────────────────

function ConfirmModal({ sub, action, onConfirm, onCancel, loading, error }: {
  sub: Subscription; action: 'approve' | 'reject';
  onConfirm: () => void; onCancel: () => void;
  loading: boolean; error: string;
}) {
  const isApprove = action === 'approve';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-[#151F32] border border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isApprove ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
            {isApprove ? <Check className="w-5 h-5 text-green-400" /> : <AlertTriangle className="w-5 h-5 text-red-400" />}
          </div>
          <div>
            <h3 className="font-semibold text-white">{isApprove ? 'Approve Subscription?' : 'Reject Subscription?'}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {isApprove
                ? 'This will activate the plan and send the seller a dashboard access email.'
                : 'This will cancel the request. The seller stays on their current plan.'}
            </p>
          </div>
        </div>
        <div className="bg-[#0B1121] rounded-xl p-4 space-y-2 text-sm">
          <Row label="Shop" value={sub.shop_name} />
          <Row label="Plan" value={PLAN_LABELS[sub.plan_type] ?? sub.plan_type} cls={planStyles[sub.plan_type]} />
          <Row label="Billing" value={sub.billing_type?.replace('_', '-') ?? '—'} />
          <Row label="Amount" value={sub.amount_paid > 0 ? `${sub.amount_paid} ${sub.currency}` : 'Free'} />
        </div>
        {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 px-4 py-2.5 border border-gray-700 rounded-lg text-sm font-medium text-gray-300 hover:bg-[#1A2540] transition disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2 ${isApprove ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Processing...' : isApprove ? 'Yes, Approve' : 'Yes, Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, cls = 'text-white' }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className={`font-medium ${cls}`}>{value}</span>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({ sub, onClose, onSaved }: {
  sub: Subscription; onClose: () => void; onSaved: (updated: Subscription) => void;
}) {
  const [form, setForm] = useState({
    plan_type:    sub.plan_type,
    billing_type: sub.billing_type || 'monthly',
    status:       sub.status,
    amount_paid:  sub.amount_paid,
    currency:     sub.currency || 'AED',
    expires_at:   sub.expires_at ? sub.expires_at.slice(0, 10) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await adminApi.updateSubscription(sub.id, {
        plan_type:    form.plan_type,
        billing_type: form.billing_type,
        status:       form.status,
        amount_paid:  Number(form.amount_paid),
        currency:     form.currency,
        expires_at:   form.expires_at || null,
      });
      onSaved({ ...sub, ...form, amount_paid: Number(form.amount_paid) });
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-[#151F32] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Pencil className="w-4 h-4 text-[#6B3FD9]" /> Edit Subscription
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{sub.shop_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#1A2540] rounded-lg text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Plan */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Plan</label>
              <div className="relative">
                <select value={form.plan_type} onChange={(e) => set('plan_type', e.target.value)} className={SELECT_CLS}>
                  <option value="free_trial">Free Trial</option>
                  <option value="starter">Starter</option>
                  <option value="premium">Premium</option>
                  <option value="thedersi_basic">TheDersi Basic</option>
                  <option value="thedersi_pro">TheDersi Pro</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Billing Type</label>
              <div className="relative">
                <select value={form.billing_type} onChange={(e) => set('billing_type', e.target.value)} className={SELECT_CLS}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="lifetime">Lifetime</option>
                  <option value="one_time">One-Time</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Status</label>
            <div className="grid grid-cols-3 gap-2">
              {(['active', 'trial', 'pending_approval', 'expired', 'cancelled'] as const).map((s) => (
                <button type="button" key={s} onClick={() => set('status', s)}
                  className={`py-2 rounded-lg text-xs font-semibold border transition ${form.status === s
                    ? s === 'active' ? 'bg-green-500/20 border-green-500 text-green-400'
                      : s === 'trial' ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                      : s === 'pending_approval' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                      : s === 'expired' ? 'bg-red-500/20 border-red-500 text-red-400'
                      : 'bg-gray-500/20 border-gray-500 text-gray-400'
                    : 'bg-transparent border-gray-700 text-gray-500 hover:border-gray-500'}`}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Amount Paid</label>
              <input type="number" min={0} step="0.01" value={form.amount_paid}
                onChange={(e) => set('amount_paid', e.target.value)}
                className={INPUT_CLS} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Currency</label>
              <div className="relative">
                <select value={form.currency} onChange={(e) => set('currency', e.target.value)} className={SELECT_CLS}>
                  <option value="AED">AED</option>
                  <option value="USD">USD</option>
                  <option value="LKR">LKR</option>
                  <option value="EUR">EUR</option>
                  <option value="INR">INR</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Expiry */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">
              Expiry Date <span className="text-gray-600">(leave empty = lifetime)</span>
            </label>
            <input type="date" value={form.expires_at} onChange={(e) => set('expires_at', e.target.value)}
              className={INPUT_CLS} />
          </div>

          {/* Info box */}
          <div className="bg-[#0B1121] rounded-xl p-3 text-xs text-gray-400 space-y-1">
            <p>• Setting <span className="text-white">Active</span> with no expiry date → auto-calculates 30d (monthly) / 365d (yearly)</p>
            <p>• Setting <span className="text-white">Trial</span> with no expiry → auto-sets 14 days</p>
            <p>• Setting <span className="text-white">Lifetime</span> → no expiry, never expires</p>
          </div>

          {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-700 rounded-lg text-sm font-medium text-gray-300 hover:bg-[#1A2540] transition">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-[#6B3FD9] hover:bg-[#5a34b8] text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
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

  const [confirmModal, setConfirmModal] = useState<{ sub: Subscription; action: 'approve' | 'reject' } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError]  = useState('');

  const [editSub, setEditSub] = useState<Subscription | null>(null);

  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getSubscriptions({
        plan_filter:   planFilter !== 'all' ? planFilter : undefined,
        status_filter: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setSubs(res.data ?? []);
    } catch { setSubs([]); }
    setLoading(false);
  }, [planFilter, statusFilter]);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  const filtered = subs.filter((s) => {
    const matchSearch = s.shop_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchTab = activeTab === 'subscriptions' || (activeTab === 'pending' && s.status === 'pending_approval');
    return matchSearch && matchTab;
  });

  const handleConfirm = async () => {
    if (!confirmModal) return;
    setConfirmLoading(true);
    setConfirmError('');
    try {
      if (confirmModal.action === 'approve') {
        await adminApi.approveSubscription(confirmModal.sub.id);
        const newStatus = confirmModal.sub.plan_type === 'free_trial' ? 'trial' : 'active';
        setSubs((prev) => prev.map((s) => s.id === confirmModal.sub.id ? { ...s, status: newStatus } : s));
        showToast(`✅ ${confirmModal.sub.shop_name} approved — plan activated`);
      } else {
        await adminApi.rejectSubscription(confirmModal.sub.id);
        setSubs((prev) => prev.map((s) => s.id === confirmModal.sub.id ? { ...s, status: 'cancelled' } : s));
        showToast(`❌ ${confirmModal.sub.shop_name} request rejected`);
      }
      setConfirmModal(null);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Action failed.';
      setConfirmError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleEdited = (updated: Subscription) => {
    setSubs((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    setEditSub(null);
    showToast(`✅ ${updated.shop_name} — subscription updated`);
  };

  const pendingCount = subs.filter((s) => s.status === 'pending_approval').length;
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Lifetime';

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#151F32] border border-gray-700 rounded-xl px-4 py-3 text-sm text-white shadow-xl animate-in slide-in-from-right">
          {toast}
        </div>
      )}

      {/* Modals */}
      {confirmModal && (
        <ConfirmModal
          sub={confirmModal.sub}
          action={confirmModal.action}
          onConfirm={handleConfirm}
          onCancel={() => { setConfirmModal(null); setConfirmError(''); }}
          loading={confirmLoading}
          error={confirmError}
        />
      )}
      {editSub && (
        <EditModal sub={editSub} onClose={() => setEditSub(null)} onSaved={handleEdited} />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
        <p className="text-gray-400 text-sm mt-1">Manage plans and active subscriptions</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button type="button" onClick={() => setActiveTab('subscriptions')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition ${activeTab === 'subscriptions' ? 'bg-[#6B3FD9] text-white' : 'bg-[#151F32] text-gray-400 hover:text-white border border-gray-800'}`}>
          All Subscriptions
        </button>
        <button type="button" onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${activeTab === 'pending' ? 'bg-[#6B3FD9] text-white' : 'bg-[#151F32] text-gray-400 hover:text-white border border-gray-800'}`}>
          Pending Approval
          {pendingCount > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'pending' ? 'bg-white/20 text-white' : 'bg-orange-500 text-white'}`}>
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active',   value: subs.filter(s => s.status === 'active').length,           icon: <Package className="w-5 h-5" />, color: 'bg-green-500/10 text-green-400' },
          { label: 'Monthly',  value: subs.filter(s => s.billing_type === 'monthly').length,     icon: <Calendar className="w-5 h-5" />, color: 'bg-blue-500/10 text-blue-400' },
          { label: 'Yearly',   value: subs.filter(s => s.billing_type === 'yearly').length,      icon: <TrendingUp className="w-5 h-5" />, color: 'bg-[#6B3FD9]/10 text-[#6B3FD9]' },
          { label: 'Pending',  value: pendingCount,                                              icon: <AlertCircle className="w-5 h-5" />, color: 'bg-orange-500/10 text-orange-400' },
        ].map((s) => (
          <div key={s.label} className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div><p className="text-gray-400 text-sm">{s.label}</p><p className="text-2xl font-bold text-white mt-1">{s.value}</p></div>
              <div className={`p-2.5 rounded-lg ${s.color}`}>{s.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" placeholder="Search stores..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition text-sm" />
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}
                className="pl-3 pr-8 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white focus:border-[#6B3FD9] focus:outline-none transition appearance-none cursor-pointer text-sm">
                <option value="all">All Plans</option>
                <option value="free_trial">Free Trial</option>
                <option value="starter">Starter</option>
                <option value="premium">Premium</option>
                <option value="thedersi_basic">TheDersi Basic</option>
                <option value="thedersi_pro">TheDersi Pro</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            </div>
            <div className="relative">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-3 pr-8 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white focus:border-[#6B3FD9] focus:outline-none transition appearance-none cursor-pointer text-sm">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="pending_approval">Pending</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            </div>
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
                <tr className="text-left text-xs text-gray-400 border-b border-gray-800 uppercase tracking-wider">
                  <th className="px-5 py-3.5 font-medium">Store</th>
                  <th className="px-5 py-3.5 font-medium">Plan</th>
                  <th className="px-5 py-3.5 font-medium">Billing</th>
                  <th className="px-5 py-3.5 font-medium">Status</th>
                  <th className="px-5 py-3.5 font-medium">Amount</th>
                  <th className="px-5 py-3.5 font-medium">Expires</th>
                  <th className="px-5 py-3.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sub) => (
                  <tr key={sub.id} className="border-b border-gray-800/60 last:border-0 hover:bg-[#1A2540] transition">
                    <td className="px-5 py-4 font-medium text-white">{sub.shop_name}</td>
                    <td className={`px-5 py-4 font-semibold text-sm ${planStyles[sub.plan_type] ?? 'text-gray-400'}`}>
                      {PLAN_LABELS[sub.plan_type] ?? sub.plan_type}
                    </td>
                    <td className="px-5 py-4 text-gray-400 capitalize text-sm">
                      {sub.billing_type?.replace('_', '-') ?? '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-lg capitalize font-medium ${statusStyles[sub.status] ?? 'bg-gray-500/10 text-gray-400'}`}>
                        {sub.status === 'pending_approval' ? 'Pending' : sub.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-white text-sm font-medium">
                      {sub.amount_paid > 0 ? `${sub.amount_paid} ${sub.currency}` : 'Free'}
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-sm">{fmtDate(sub.expires_at)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {sub.status === 'pending_approval' && (
                          <>
                            <button type="button"
                              onClick={() => { setConfirmError(''); setConfirmModal({ sub, action: 'approve' }); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-green-500/10 text-green-400 hover:bg-green-500/20 transition">
                              <Check className="w-3.5 h-3.5" /> Approve
                            </button>
                            <button type="button"
                              onClick={() => { setConfirmError(''); setConfirmModal({ sub, action: 'reject' }); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                          </>
                        )}
                        <button type="button" onClick={() => setEditSub(sub)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#6B3FD9]/10 text-[#6B3FD9] hover:bg-[#6B3FD9]/20 transition">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {filtered.map((sub) => (
              <div key={sub.id} className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-white">{sub.shop_name}</p>
                  <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${statusStyles[sub.status] ?? 'bg-gray-500/10 text-gray-400'}`}>
                    {sub.status === 'pending_approval' ? 'Pending' : sub.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <ChevronRight className="w-3 h-3 text-gray-600" />
                  <span className={`text-sm font-semibold ${planStyles[sub.plan_type] ?? 'text-gray-400'}`}>
                    {PLAN_LABELS[sub.plan_type] ?? sub.plan_type}
                  </span>
                  <span className="text-xs text-gray-500 capitalize">{sub.billing_type?.replace('_', '-')}</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-3 border-t border-gray-800 mt-3">
                  <span className="text-gray-400 text-xs">{fmtDate(sub.expires_at)}</span>
                  <span className="text-white font-medium text-xs">{sub.amount_paid > 0 ? `${sub.amount_paid} ${sub.currency}` : 'Free'}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  {sub.status === 'pending_approval' && (
                    <>
                      <button type="button"
                        onClick={() => { setConfirmError(''); setConfirmModal({ sub, action: 'approve' }); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition text-xs font-semibold">
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button type="button"
                        onClick={() => { setConfirmError(''); setConfirmModal({ sub, action: 'reject' }); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition text-xs font-semibold">
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </>
                  )}
                  <button type="button" onClick={() => setEditSub(sub)}
                    className={`${sub.status === 'pending_approval' ? '' : 'flex-1'} flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#6B3FD9]/10 text-[#6B3FD9] hover:bg-[#6B3FD9]/20 transition text-xs font-semibold`}>
                    <Pencil className="w-3.5 h-3.5" /> Edit
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
