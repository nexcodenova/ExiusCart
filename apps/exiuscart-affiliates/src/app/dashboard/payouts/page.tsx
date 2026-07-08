'use client';

import { useState, useEffect } from 'react';
import { Wallet, AlertCircle, CheckCircle, Clock, BadgeCheck, Lock, ExternalLink, CheckCircle2 } from 'lucide-react';

const PARTNER_KEY = 'affiliate_partner_label_confirmed';
const MINIMUM_PAYOUT = 100;

const currentBalance = 0;
const hasEarnedCommission = currentBalance > 0;

export default function PayoutsPage() {
  const [partnerConfirmed, setPartnerConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'paypal' | 'skrill' | 'payoneer'>('paypal');

  useEffect(() => {
    setPartnerConfirmed(localStorage.getItem(PARTNER_KEY) === 'yes');
  }, []);

  const handleConfirm = () => {
    setConfirming(true);
    setTimeout(() => {
      localStorage.setItem(PARTNER_KEY, 'yes');
      setPartnerConfirmed(true);
      setConfirming(false);
    }, 600);
  };

  const canRequest = partnerConfirmed && hasEarnedCommission && currentBalance >= MINIMUM_PAYOUT;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>
        <p className="text-gray-500 text-sm mt-1">Track your earnings and request payouts</p>
      </div>

      {/* Partnership requirement gate */}
      {!partnerConfirmed && (
        <div className="bg-[#7B4FE9]/8 border border-[#7B4FE9]/30 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-[#7B4FE9] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-gray-900 font-semibold text-sm mb-1">Payouts are locked</p>
              <p className="text-gray-500 text-sm mb-3">
                To unlock payouts you must add the following text to your social media bio or website:
              </p>
              <div className="bg-gray-50 border border-[#7B4FE9]/20 rounded-xl px-4 py-3 mb-4">
                <p className="text-[#7B4FE9] font-mono text-sm font-semibold">
                  &quot;Affiliate partner of ExiusCart by NexCodeNova&quot;
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="https://exiuscart.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-gray-900 border border-gray-300 px-4 py-2.5 rounded-lg transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open your social profile
                </a>
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="inline-flex items-center gap-2 bg-[#7B4FE9] hover:bg-[#5A2EC9] disabled:opacity-60 text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {confirming ? 'Confirming...' : "I've added it — unlock payouts"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {partnerConfirmed && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <BadgeCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <p className="text-emerald-700 text-xs font-medium">Partnership label confirmed — payouts are unlocked.</p>
        </div>
      )}

      {/* No commission yet state */}
      {!hasEarnedCommission ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-900 font-semibold mb-2">No commissions earned yet</p>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            Your payout dashboard will become available once you earn your first commission. Share your referral link to get started.
          </p>
        </div>
      ) : (
        <>
          {/* Balance card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl p-6">
              <p className="text-gray-500 text-sm mb-1">Available Balance</p>
              <p className="text-5xl font-black text-gray-900 mb-2">
                ${currentBalance.toFixed(2)}
              </p>
              <div className="flex items-center gap-2 text-sm">
                {canRequest ? (
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <CheckCircle className="w-4 h-4" />
                    Eligible for payout
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-yellow-600">
                    <AlertCircle className="w-4 h-4" />
                    {!partnerConfirmed
                      ? 'Confirm partnership label above to enable payouts'
                      : `Need $${(MINIMUM_PAYOUT - currentBalance).toFixed(2)} more to reach the $${MINIMUM_PAYOUT} minimum`}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-1">Minimum Payout</p>
                <p className="text-3xl font-bold text-gray-900">${MINIMUM_PAYOUT}</p>
                <p className="text-gray-400 text-xs mt-2">Via PayPal, Skrill, or Payoneer</p>
              </div>
              <button
                disabled={!canRequest}
                className={`mt-4 w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                  canRequest
                    ? 'bg-[#7B4FE9] hover:bg-[#5A2EC9] text-white cursor-pointer'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {canRequest ? 'Request Payout' : `Minimum $${MINIMUM_PAYOUT} required`}
              </button>
            </div>
          </div>

          {/* Payout method selector */}
          {canRequest && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
              <p className="text-gray-900 font-medium text-sm mb-3">Select payout method</p>
              <div className="grid grid-cols-3 gap-3">
                {(['paypal', 'skrill', 'payoneer'] as const).map((method) => (
                  <button
                    key={method}
                    onClick={() => setSelectedMethod(method)}
                    className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold capitalize transition-all ${
                      selectedMethod === method
                        ? 'border-[#7B4FE9] bg-[#7B4FE9]/8 text-[#7B4FE9]'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {method.charAt(0).toUpperCase() + method.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Payout rules */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#7B4FE9] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-gray-900 font-medium text-sm mb-1">Payout Rules</p>
                <ul className="text-gray-500 text-sm space-y-1">
                  <li>• Minimum payout amount is <span className="text-gray-900 font-semibold">$100</span></li>
                  <li>• Payouts via <span className="text-gray-900 font-semibold">PayPal, Skrill, or Payoneer</span></li>
                  <li>• Payouts are processed within 3–5 business days</li>
                  <li>• Full lock period and payout conditions are in our <a href="https://exiuscart.com/terms" target="_blank" rel="noopener noreferrer" className="text-[#7B4FE9] underline hover:text-[#5A2EC9]">Terms & Conditions</a></li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Payout history */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-gray-900 font-semibold">Payout History</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Clock className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium mb-1">No payouts yet</p>
          <p className="text-gray-400 text-sm">Your payout history will appear here</p>
        </div>
      </div>
    </div>
  );
}
