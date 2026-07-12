'use client';

import { useState, useEffect } from 'react';
import { DollarSign, MousePointerClick, Users, TrendingUp, BadgeCheck, AlertCircle, ExternalLink, CheckCircle2, Loader2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';
const PARTNER_KEY = 'affiliate_partner_label_confirmed';

function affiliateHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('affiliate_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export default function OverviewPage() {
  const [partnerConfirmed, setPartnerConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [statsData, setStatsData] = useState<{ total_signups: number; conversions: number; total_earnings: number; total_clicks: number; currency: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPartnerConfirmed(localStorage.getItem(PARTNER_KEY) === 'yes');
    fetch(`${API_BASE}/api/v1/affiliates/me/stats`, { headers: affiliateHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setStatsData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleConfirm = () => {
    setConfirming(true);
    setTimeout(() => {
      localStorage.setItem(PARTNER_KEY, 'yes');
      setPartnerConfirmed(true);
      setConfirming(false);
    }, 600);
  };

  const stats = [
    { label: 'Total Earnings',  value: loading ? '…' : `$${(statsData?.total_earnings ?? 0).toFixed(2)}`, sub: 'Commission earned',      icon: DollarSign,        color: '#7B4FE9' },
    { label: 'Total Clicks',    value: loading ? '…' : String(statsData?.total_clicks ?? 0), sub: 'On your referral link', icon: MousePointerClick, color: '#3B82F6' },
    { label: 'Signups',         value: loading ? '…' : String(statsData?.total_signups ?? 0), sub: 'Via your link', icon: Users, color: '#10B981' },
    { label: 'Conversions',     value: loading ? '…' : String(statsData?.conversions ?? 0), sub: 'Paid customers', icon: TrendingUp, color: '#F59E0B' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-gray-500 text-sm mt-1">Your affiliate performance at a glance</p>
      </div>

      {/* Partnership label requirement */}
      {!partnerConfirmed ? (
        <div className="bg-[#7B4FE9]/8 border border-[#7B4FE9]/30 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#7B4FE9] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-gray-900 font-semibold text-sm mb-1">Action required to unlock payouts</p>
              <p className="text-gray-500 text-sm mb-3">
                You must add the following text to your social media bio, website footer, or any page where you promote ExiusCart:
              </p>
              <div className="bg-gray-50 border border-[#7B4FE9]/20 rounded-xl px-4 py-3 mb-4">
                <p className="text-[#7B4FE9] font-mono text-sm font-semibold tracking-wide">
                  &quot;Affiliate partner of ExiusCart by NexCodeNova&quot;
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="https://exiuscart.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-gray-900 border border-gray-300 hover:border-gray-400 px-4 py-2.5 rounded-lg transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open your social profile
                </a>
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="inline-flex items-center gap-2 bg-[#7B4FE9] hover:bg-[#5A2EC9] disabled:opacity-60 text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {confirming ? 'Confirming...' : "I've added it — confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <BadgeCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-emerald-700 text-sm font-medium">Partnership label confirmed — your payouts are unlocked.</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-500 text-sm">{label}</p>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {loading && value === '…' ? <Loader2 className="w-5 h-5 animate-spin inline" /> : value}
            </p>
            <p className="text-gray-400 text-xs">{sub}</p>
          </div>
        ))}
      </div>

      {/* Commission notice */}
      <div className="bg-[#7B4FE9]/8 border border-[#7B4FE9]/20 rounded-2xl p-5 mb-8">
        <p className="text-[#7B4FE9] font-semibold text-sm mb-1">Commission Structure</p>
        <p className="text-gray-500 text-sm">
          Earn <span className="text-gray-900 font-semibold">$25</span> per monthly plan referral and <span className="text-gray-900 font-semibold">$75</span> per yearly plan referral. Commissions are subject to a lock period as stated in our{' '}
          <a href="https://exiuscart.com/affiliate/terms" target="_blank" rel="noopener noreferrer" className="text-[#7B4FE9] underline hover:text-[#5A2EC9]">Affiliate Terms & Conditions</a>.
        </p>
      </div>

      {/* Recent activity */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-gray-900 font-semibold mb-4">Recent Activity</h2>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 text-[#7B4FE9] animate-spin" />
          </div>
        ) : (statsData?.total_signups ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm">No activity yet</p>
            <p className="text-gray-400 text-xs mt-1">Share your referral link to start earning</p>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">
            You have <span className="text-gray-900 font-semibold">{statsData?.total_signups}</span> signup(s) and <span className="text-gray-900 font-semibold">{statsData?.conversions}</span> paid conversion(s). View the{' '}
            <a href="/dashboard/referrals" className="text-[#7B4FE9] underline">Referrals</a> page for full details.
          </p>
        )}
      </div>
    </div>
  );
}
