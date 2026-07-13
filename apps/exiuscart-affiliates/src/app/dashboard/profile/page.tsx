'use client';

import { useState, useEffect } from 'react';
import { User, CreditCard, Save, AlertCircle, Loader2, CheckCircle2, Lock, Repeat, Zap } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';

function affiliateHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('affiliate_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export default function ProfilePage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [commissionModel, setCommissionModel] = useState<'one_time' | 'recurring' | null>(null);

  const [payoutMethod, setPayoutMethod] = useState<'paypal' | 'skrill' | 'payoneer'>('paypal');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [skrillEmail, setSkrillEmail] = useState('');
  const [payoneerId, setPayoneerId] = useState('');

  const [loadingPayout, setLoadingPayout] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    // Pre-fill name/email from localStorage
    const storedName = localStorage.getItem('affiliate_name') || '';
    setName(storedName);
    const storedEmail = (() => {
      try { return JSON.parse(atob((localStorage.getItem('affiliate_token') || '').split('.')[1] || 'e30=')).email || ''; } catch { return ''; }
    })();
    setEmail(storedEmail);

    // Load commission model (locked, set at application time)
    fetch(`${API_BASE}/api/v1/affiliates/me/stats`, { headers: affiliateHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.commission_model) setCommissionModel(d.commission_model); })
      .catch(() => {});

    // Load payout details from backend
    fetch(`${API_BASE}/api/v1/affiliates/me/payout-details`, { headers: affiliateHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          if (d.payout_method) setPayoutMethod(d.payout_method as 'paypal' | 'skrill' | 'payoneer');
          if (d.paypal_email) setPaypalEmail(d.paypal_email);
          if (d.skrill_email) setSkrillEmail(d.skrill_email);
          if (d.payoneer_id) setPayoneerId(d.payoneer_id);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPayout(false));
  }, []);

  const handleSavePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/affiliates/me/payout-details`, {
        method: 'PATCH',
        headers: affiliateHeaders(),
        body: JSON.stringify({
          payout_method: payoutMethod,
          paypal_email: paypalEmail,
          skrill_email: skrillEmail,
          payoneer_id: payoneerId,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPassword(true);
    setPasswordMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/affiliates/me/password`, {
        method: 'PATCH',
        headers: affiliateHeaders(),
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordMsg({ ok: true, text: 'Password updated successfully.' });
        setCurrentPassword('');
        setNewPassword('');
      } else {
        setPasswordMsg({ ok: false, text: data.detail || 'Failed to update password.' });
      }
    } catch {
      setPasswordMsg({ ok: false, text: 'Network error. Please try again.' });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account and payout details</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="lg:col-span-2 space-y-5">

          {/* Account info (read-only for now) */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-gray-900 font-semibold mb-5 flex items-center gap-2">
              <User className="w-4 h-4 text-[#7B4FE9]" />
              Account Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-[#7B4FE9] transition-colors"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Email</label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-gray-500 text-sm cursor-not-allowed"
                />
              </div>
              {commissionModel && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Commission Model</label>
                  <div className="flex items-center justify-between gap-3 bg-gray-100 border border-gray-200 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      {commissionModel === 'recurring' ? (
                        <Repeat className="w-4 h-4 text-[#7B4FE9]" />
                      ) : (
                        <Zap className="w-4 h-4 text-gray-500" />
                      )}
                      <span className="text-gray-900 text-sm font-semibold">
                        {commissionModel === 'recurring' ? 'Recurring — 50% for 12 months' : 'One-Time — $75 flat'}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs mt-1.5">
                    This was set when you applied and can&apos;t be changed. Contact support if you need help.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Payout method */}
          <form onSubmit={handleSavePayout} className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-gray-900 font-semibold mb-1 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#7B4FE9]" />
              Payout Method
            </h2>
            <p className="text-gray-400 text-xs mb-5">Choose how you want to receive your commissions. All details are securely sent to the ExiusCart team.</p>

            {loadingPayout ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 text-[#7B4FE9] animate-spin" />
              </div>
            ) : (
              <>
                {/* Method selector */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {(['paypal', 'skrill', 'payoneer'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPayoutMethod(method)}
                      className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold capitalize transition-all ${
                        payoutMethod === method
                          ? 'border-[#7B4FE9] bg-[#7B4FE9]/8 text-[#7B4FE9]'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {method === 'payoneer' ? 'Payoneer' : method.charAt(0).toUpperCase() + method.slice(1)}
                    </button>
                  ))}
                </div>

                {/* PayPal fields */}
                {payoutMethod === 'paypal' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">PayPal Email Address</label>
                      <input
                        type="email"
                        value={paypalEmail}
                        onChange={e => setPaypalEmail(e.target.value)}
                        placeholder="your-paypal@email.com"
                        required
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-[#7B4FE9] transition-colors"
                      />
                      <p className="text-gray-400 text-xs mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Make sure this email is linked to an active PayPal account
                      </p>
                    </div>
                  </div>
                )}

                {/* Skrill fields */}
                {payoutMethod === 'skrill' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">Skrill Email Address</label>
                      <input
                        type="email"
                        value={skrillEmail}
                        onChange={e => setSkrillEmail(e.target.value)}
                        placeholder="your-skrill@email.com"
                        required
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-[#7B4FE9] transition-colors"
                      />
                      <p className="text-gray-400 text-xs mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Enter the email registered with your Skrill account
                      </p>
                    </div>
                  </div>
                )}

                {/* Payoneer fields */}
                {payoutMethod === 'payoneer' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">Payoneer Email or Account ID</label>
                      <input
                        type="text"
                        value={payoneerId}
                        onChange={e => setPayoneerId(e.target.value)}
                        placeholder="your-payoneer@email.com or Account ID"
                        required
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-[#7B4FE9] transition-colors"
                      />
                      <p className="text-gray-400 text-xs mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Enter the email or account ID linked to your Payoneer account
                      </p>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="mt-5 flex items-center gap-2 bg-[#7B4FE9] hover:bg-[#5A2EC9] disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-xl transition-all text-sm"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Payout Details'}
                </button>

                {saved && (
                  <p className="text-emerald-600 text-xs mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Payout details saved and sent to ExiusCart team.
                  </p>
                )}
              </>
            )}
          </form>
        </div>

        {/* Side info */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">Payout Rules</p>
            <ul className="space-y-2 text-sm text-gray-500">
              <li className="flex items-start gap-2">
                <span className="text-[#7B4FE9] mt-0.5">•</span>
                Minimum payout: <span className="text-gray-900 font-semibold ml-1">$100</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#7B4FE9] mt-0.5">•</span>
                30-day lock after each commission
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#7B4FE9] mt-0.5">•</span>
                ~15 days admin approval after lock
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#7B4FE9] mt-0.5">•</span>
                Methods: <span className="text-gray-900 font-semibold ml-1">PayPal, Skrill, Payoneer</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#7B4FE9] mt-0.5">•</span>
                Processing: <span className="text-gray-700 ml-1">3–5 business days</span>
              </li>
            </ul>
          </div>

          <form onSubmit={handleChangePassword} className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">Change Password</p>
            <div className="space-y-3">
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-[#7B4FE9] transition-colors"
              />
              <input
                type="password"
                placeholder="New password (min 8 characters)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-[#7B4FE9] transition-colors"
              />
              {passwordMsg && (
                <p className={`text-xs ${passwordMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>{passwordMsg.text}</p>
              )}
              <button
                type="submit"
                disabled={changingPassword}
                className="w-full bg-gray-100 hover:bg-gray-200 disabled:opacity-60 text-gray-700 text-sm py-2.5 rounded-xl transition-all font-medium flex items-center justify-center gap-2"
              >
                {changingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {changingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
