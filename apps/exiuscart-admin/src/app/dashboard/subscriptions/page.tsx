'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Package, Calendar, TrendingUp, AlertCircle, Loader2,
  Check, X, AlertTriangle, ChevronDown, Pencil, ChevronRight,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { PlanDates, fmtDate as fmtDay } from '@/lib/subscription-ui';

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
  shop_registered_at?: string | null;
  // true while a card is still being billed through Lemon Squeezy
  card_billing?: boolean;
}

// TheDersi Pro deliberately has no entry here — it's not a distinct
// plan_type anymore, it shares "launch" with real direct ExiusCart
// customers (see app/core/thedersi.py's is_thedersi_pro_shop on the
// backend). Same for their "Official" tier, which shares "scale". Check
// the shop's connected channels (Stores/Shops list) to tell them apart.
const PLAN_LABELS: Record<string, string> = {
  free_trial:            'Free Trial',
  thedersi_free_forever: 'TheDersi Free Forever',
  thedersi_lite:         'TheDersi Lite',
  launch:                'Launch',
  growth:                'Growth',
  scale:                 'Scale',
  pro:                   'Pro',
};

// Real prices — mirrors apps/exiuscart-website/src/config/pricing.ts and
// exiuscart-backend/app/api/v1/endpoints/shops.py's PLAN_CATALOGUE exactly.
// Shown as a reference in the edit modal so a manually-set Amount Paid
// matches what the plan actually costs, rather than a guess.
const PLAN_REFERENCE_PRICING: Record<string, { monthly: number; yearly: number }> = {
  launch: { monthly: 14.99, yearly: 134.91 },
  growth: { monthly: 24.99, yearly: 224.91 },
  scale:  { monthly: 39.99, yearly: 359.91 },
};

const planStyles: Record<string, string> = {
  free_trial:            'text-gray-600',
  thedersi_free_forever: 'text-blue-600',
  thedersi_lite:         'text-teal-400',
  launch:                'text-gray-700',
  growth:                'text-[#0D70BB]',
  scale:                 'text-[#6B3FD9]',
  pro:                   'text-[#6B3FD9]',
};

const statusStyles: Record<string, string> = {
  active:           'bg-green-500/10 text-green-600',
  trial:            'bg-blue-500/10 text-blue-600',
  trial_dollar:     'bg-purple-500/10 text-purple-600',
  pending_approval: 'bg-yellow-500/10 text-yellow-600',
  expiring:         'bg-orange-500/10 text-orange-600',
  expired:          'bg-red-500/10 text-red-600',
  cancelled:        'bg-gray-500/10 text-gray-600',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active', trial: 'Trial', trial_dollar: '$1 Trial', pending_approval: 'Pending',
  expired: 'Expired', cancelled: 'Cancelled',
};

const SELECT_CLS = "w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:border-[#6B3FD9] focus:outline-none appearance-none text-sm";
const INPUT_CLS  = "w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:border-[#6B3FD9] focus:outline-none text-sm";

// ── Confirm Modal (Approve / Reject) ─────────────────────────────────────────

function ConfirmModal({ sub, action, onConfirm, onCancel, loading, error }: {
  sub: Subscription; action: 'approve' | 'reject';
  onConfirm: () => void; onCancel: () => void;
  loading: boolean; error: string;
}) {
  const isApprove = action === 'approve';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-white border border-gray-300 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isApprove ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
            {isApprove ? <Check className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-red-600" />}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{isApprove ? 'Approve Subscription?' : 'Reject Subscription?'}</h3>
            <p className="text-xs text-gray-600 mt-0.5">
              {isApprove
                ? 'This will activate the plan and send the seller a dashboard access email.'
                : 'This will cancel the request. The seller stays on their current plan.'}
            </p>
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          <Row label="Shop" value={sub.shop_name} />
          <Row label="Plan" value={PLAN_LABELS[sub.plan_type] ?? sub.plan_type} cls={planStyles[sub.plan_type]} />
          <Row label="Billing" value={sub.billing_type?.replace('_', '-') ?? '—'} />
          <Row label="Amount" value={sub.amount_paid > 0 ? `${sub.amount_paid} ${sub.currency}` : 'Free'} />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-200 transition disabled:opacity-50">
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

function Row({ label, value, cls = 'text-gray-900' }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}</span>
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
    currency:     sub.currency || 'USD',
    starts_at:    sub.starts_at ? sub.starts_at.slice(0, 10) : '',
    expires_at:   sub.expires_at ? sub.expires_at.slice(0, 10) : '',
    cancel_card:  false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k: string, v: any) => setForm((f) => {
    const next = { ...f, [k]: v };
    // The form starts with the OLD expiry date. Switching to a live status with
    // a date that has already passed would expire the account again straight
    // away, so the date is cleared and worked out fresh on save.
    if (k === 'status' && ['active', 'trial', 'trial_dollar'].includes(v) && f.expires_at && new Date(f.expires_at) <= new Date()) {
      next.expires_at = '';
    }
    return next;
  });

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      // A live status with a date already in the past would expire the account
      // again, so send no date and let the server pick a fresh one.
      const stale = ['active', 'trial', 'trial_dollar'].includes(form.status)
        && !!form.expires_at && new Date(form.expires_at) <= new Date();
      const res = await adminApi.updateSubscription(sub.id, {
        plan_type:    form.plan_type,
        billing_type: form.billing_type,
        status:       form.status,
        amount_paid:  Number(form.amount_paid),
        currency:     form.currency,
        starts_at:    form.starts_at || null,
        expires_at:   stale ? null : (form.expires_at || null),
        cancel_card_billing: sub.card_billing ? form.cancel_card : false,
      });
      const { cancel_card, ...rest } = form;
      onSaved({
        ...sub, ...rest,
        amount_paid: Number(form.amount_paid),
        starts_at: res.data?.starts_at ?? null,    // the dates the server actually saved
        expires_at: res.data?.expires_at ?? null,
        card_billing: cancel_card ? false : sub.card_billing,
      });
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-white border border-gray-300 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Pencil className="w-4 h-4 text-[#6B3FD9]" /> Edit Subscription
            </h2>
            <p className="text-xs text-gray-600 mt-0.5">{sub.shop_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-600 hover:text-gray-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Plan */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1.5 block">Plan</label>
              <div className="relative">
                <select value={form.plan_type} onChange={(e) => set('plan_type', e.target.value)} className={SELECT_CLS}>
                  <option value="free_trial">Free Trial</option>
                  <option value="launch">Launch</option>
                  <option value="growth">Growth</option>
                  <option value="scale">Scale</option>
                  <option value="thedersi_free_forever">TheDersi Free Forever</option>
                  <option value="thedersi_lite">TheDersi Lite</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1.5 block">Billing Type</label>
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
            <label className="text-xs text-gray-600 mb-1.5 block">Status</label>
            <div className="grid grid-cols-3 gap-2">
              {(['active', 'trial', 'trial_dollar', 'pending_approval', 'expired', 'cancelled'] as const).map((s) => (
                <button type="button" key={s} onClick={() => set('status', s)}
                  className={`py-2 rounded-lg text-xs font-semibold border transition ${form.status === s
                    ? s === 'active' ? 'bg-green-500/20 border-green-500 text-green-600'
                      : s === 'trial' ? 'bg-blue-500/20 border-blue-500 text-blue-600'
                      : s === 'trial_dollar' ? 'bg-purple-500/20 border-purple-500 text-purple-600'
                      : s === 'pending_approval' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-600'
                      : s === 'expired' ? 'bg-red-500/20 border-red-500 text-red-600'
                      : 'bg-gray-500/20 border-gray-400 text-gray-600'
                    : 'bg-transparent border-gray-300 text-gray-500 hover:border-gray-400'}`}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1.5 block">Amount Paid</label>
              <input type="number" min={0} step="0.01" value={form.amount_paid}
                onChange={(e) => set('amount_paid', e.target.value)}
                className={INPUT_CLS} />
              {/* Real price reference — this form is a plain database write,
                  never a Lemon Squeezy charge, so nothing here is enforced.
                  This just helps fill in a number that matches what the
                  plan actually costs, for comps/manual grants/corrections. */}
              {PLAN_REFERENCE_PRICING[form.plan_type] && (form.billing_type === 'monthly' || form.billing_type === 'yearly') && (
                <button type="button"
                  onClick={() => set('amount_paid', PLAN_REFERENCE_PRICING[form.plan_type][form.billing_type as 'monthly' | 'yearly'])}
                  className="mt-1.5 text-xs text-[#6B3FD9] hover:underline">
                  Use real price: ${PLAN_REFERENCE_PRICING[form.plan_type][form.billing_type as 'monthly' | 'yearly'].toFixed(2)}
                </button>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1.5 block">Currency</label>
              <div className="relative">
                <select value={form.currency} onChange={(e) => set('currency', e.target.value)} className={SELECT_CLS}>
                  <option value="USD">USD</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Period */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sub-start" className="text-xs text-gray-600 mb-1.5 block">Start date</label>
              <input id="sub-start" type="date" value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)}
                className={INPUT_CLS} />
            </div>
            <div>
              <label htmlFor="sub-expiry" className="text-xs text-gray-600 mb-1.5 block">Expiry date</label>
              <input id="sub-expiry" type="date" value={form.expires_at} onChange={(e) => set('expires_at', e.target.value)}
                className={INPUT_CLS} />
            </div>
            <p className="col-span-2 -mt-1 text-xs text-gray-400">
              Leave both empty and they are set from the plan and status: starting today, ending after the trial or billing period.
            </p>
          </div>

          {/* A card is still being billed for this account */}
          {sub.card_billing && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">This account is billed by card through Lemon Squeezy.</p>
              <p className="mt-1">Saving here changes the account in ExiusCart only. The card keeps being charged, and each payment can reset the expiry date you set. To give a free period, stop the card billing too.</p>
              <label className="mt-2 flex items-start gap-2 font-medium">
                <input type="checkbox" checked={form.cancel_card} onChange={(e) => set('cancel_card', e.target.checked)} className="mt-0.5" />
                <span>Also stop the card billing (cancels the Lemon Squeezy subscription)</span>
              </label>
            </div>
          )}

          {/* Info box */}
          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 space-y-1">
            <p>• Setting <span className="text-gray-900">Active</span> with no expiry date → auto-calculates 30d (monthly) / 365d (yearly)</p>
            <p>• Setting <span className="text-gray-900">Trial</span> or <span className="text-gray-900">$1 Trial</span> with no expiry → auto-sets 7 days</p>
            <p>• Setting <span className="text-gray-900">Lifetime</span> → no expiry, never expires</p>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-200 transition">
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
  const [showHistory, setShowHistory] = useState(false);
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
        history: showHistory || undefined,
      });
      setSubs(res.data ?? []);
    } catch { setSubs([]); }
    setLoading(false);
  }, [planFilter, statusFilter, showHistory]);

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
        <div className="fixed top-4 right-4 z-50 bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 shadow-xl animate-in slide-in-from-right">
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
        <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
        <p className="text-gray-600 text-sm mt-1">Manage plans and active subscriptions</p>
      </div>

      {/* Plan pricing reference — real prices, same names/numbers as the
          live pricing page. Launch/Growth/Scale only: TheDersi plans are
          billed by TheDersi, not ExiusCart, so they have no price here. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {(['launch', 'growth', 'scale'] as const).map((p) => (
          <div key={p} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm font-semibold ${planStyles[p]}`}>{PLAN_LABELS[p]}</span>
              {p === 'growth' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#6B3FD9]/20 text-[#6B3FD9] font-semibold">Most Popular</span>}
            </div>
            <p className="text-xl font-bold text-gray-900">
              ${PLAN_REFERENCE_PRICING[p].monthly.toFixed(2)}<span className="text-sm font-normal text-gray-600">/mo</span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              or ${PLAN_REFERENCE_PRICING[p].yearly.toFixed(2)}/yr (25% off)
            </p>
            {p !== 'launch' && (
              <p className="text-xs text-purple-600 mt-1.5">$1 trial for 7 days first</p>
            )}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button type="button" onClick={() => setActiveTab('subscriptions')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition ${activeTab === 'subscriptions' ? 'bg-[#6B3FD9] text-white' : 'bg-white text-gray-600 hover:text-white border border-gray-200'}`}>
          All Subscriptions
        </button>
        <button type="button" onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${activeTab === 'pending' ? 'bg-[#6B3FD9] text-white' : 'bg-white text-gray-600 hover:text-white border border-gray-200'}`}>
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
          { label: 'Active',   value: subs.filter(s => s.status === 'active').length,           icon: <Package className="w-5 h-5" />, color: 'bg-green-500/10 text-green-600' },
          { label: 'Monthly',  value: subs.filter(s => s.billing_type === 'monthly').length,     icon: <Calendar className="w-5 h-5" />, color: 'bg-blue-500/10 text-blue-600' },
          { label: 'Yearly',   value: subs.filter(s => s.billing_type === 'yearly').length,      icon: <TrendingUp className="w-5 h-5" />, color: 'bg-[#6B3FD9]/10 text-[#6B3FD9]' },
          { label: 'Pending',  value: pendingCount,                                              icon: <AlertCircle className="w-5 h-5" />, color: 'bg-orange-500/10 text-orange-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div><p className="text-gray-600 text-sm">{s.label}</p><p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p></div>
              <div className={`p-2.5 rounded-lg ${s.color}`}>{s.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" placeholder="Search stores..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:border-[#6B3FD9] focus:outline-none transition text-sm" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="sub-history" className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-600">
              <input id="sub-history" type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)}
                className="h-4 w-4 accent-[#6B3FD9]" />
              Show past subscriptions
            </label>
            <div className="relative">
              <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}
                className="pl-3 pr-8 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:border-[#6B3FD9] focus:outline-none transition appearance-none cursor-pointer text-sm">
                <option value="all">All Plans</option>
                <option value="free_trial">Free Trial</option>
                <option value="launch">Launch</option>
                <option value="growth">Growth</option>
                <option value="scale">Scale</option>
                <option value="thedersi_free_forever">TheDersi Free Forever</option>
                <option value="thedersi_lite">TheDersi Lite</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            </div>
            <div className="relative">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-3 pr-8 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:border-[#6B3FD9] focus:outline-none transition appearance-none cursor-pointer text-sm">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="trial_dollar">$1 Trial</option>
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
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No subscriptions found</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-600 border-b border-gray-200 uppercase tracking-wider">
                  <th className="px-5 py-3.5 font-medium">Store</th>
                  <th className="px-5 py-3.5 font-medium">Plan</th>
                  <th className="px-5 py-3.5 font-medium">Billing</th>
                  <th className="px-5 py-3.5 font-medium">Status</th>
                  <th className="px-5 py-3.5 font-medium">Amount</th>
                  <th className="px-5 py-3.5 font-medium">Plan period</th>
                  <th className="px-5 py-3.5 font-medium">Registered</th>
                  <th className="px-5 py-3.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sub) => (
                  <tr key={sub.id} className="border-b border-gray-800/60 last:border-0 hover:bg-gray-200 transition">
                    <td className="px-5 py-4 font-medium text-gray-900">{sub.shop_name}</td>
                    <td className={`px-5 py-4 font-semibold text-sm ${planStyles[sub.plan_type] ?? 'text-gray-600'}`}>
                      {PLAN_LABELS[sub.plan_type] ?? sub.plan_type}
                    </td>
                    <td className="px-5 py-4 text-gray-600 capitalize text-sm">
                      {sub.billing_type?.replace('_', '-') ?? '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-lg capitalize font-medium ${statusStyles[sub.status] ?? 'bg-gray-500/10 text-gray-600'}`}>
                        {STATUS_LABEL[sub.status] ?? sub.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-900 text-sm font-medium">
                      {sub.amount_paid > 0 ? `${sub.amount_paid} ${sub.currency}` : 'Free'}
                    </td>
                    <td className="px-5 py-4">
                      <PlanDates startsAt={sub.starts_at} expiresAt={sub.expires_at} status={sub.status} />
                    </td>
                    <td className="px-5 py-4 text-gray-600 text-xs">{fmtDay(sub.shop_registered_at)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {sub.status === 'pending_approval' && (
                          <>
                            <button type="button"
                              onClick={() => { setConfirmError(''); setConfirmModal({ sub, action: 'approve' }); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-green-500/10 text-green-600 hover:bg-green-500/20 transition">
                              <Check className="w-3.5 h-3.5" /> Approve
                            </button>
                            <button type="button"
                              onClick={() => { setConfirmError(''); setConfirmModal({ sub, action: 'reject' }); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-600 hover:bg-red-500/20 transition">
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
              <div key={sub.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-gray-900">{sub.shop_name}</p>
                  <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${statusStyles[sub.status] ?? 'bg-gray-500/10 text-gray-600'}`}>
                    {STATUS_LABEL[sub.status] ?? sub.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <ChevronRight className="w-3 h-3 text-gray-400" />
                  <span className={`text-sm font-semibold ${planStyles[sub.plan_type] ?? 'text-gray-600'}`}>
                    {PLAN_LABELS[sub.plan_type] ?? sub.plan_type}
                  </span>
                  <span className="text-xs text-gray-500 capitalize">{sub.billing_type?.replace('_', '-')}</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-3 border-t border-gray-200 mt-3">
                  <PlanDates startsAt={sub.starts_at} expiresAt={sub.expires_at} status={sub.status} />
                  <span className="text-gray-900 font-medium text-xs">{sub.amount_paid > 0 ? `${sub.amount_paid} ${sub.currency}` : 'Free'}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  {sub.status === 'pending_approval' && (
                    <>
                      <button type="button"
                        onClick={() => { setConfirmError(''); setConfirmModal({ sub, action: 'approve' }); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition text-xs font-semibold">
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button type="button"
                        onClick={() => { setConfirmError(''); setConfirmModal({ sub, action: 'reject' }); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 transition text-xs font-semibold">
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
