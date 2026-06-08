import { Wallet, AlertCircle, CheckCircle, Clock } from 'lucide-react';

const MINIMUM_PAYOUT = 100;
const currentBalance = 0; // will come from API
const canRequest = currentBalance >= MINIMUM_PAYOUT;

export default function PayoutsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Payouts</h1>
        <p className="text-gray-400 text-sm mt-1">Track your earnings and request payouts via PayPal</p>
      </div>

      {/* Balance card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="md:col-span-2 bg-[#151F32] border border-gray-800 rounded-2xl p-6">
          <p className="text-gray-400 text-sm mb-1">Available Balance</p>
          <p className="text-5xl font-black text-white mb-2">
            ${currentBalance.toFixed(2)}
          </p>
          <div className="flex items-center gap-2 text-sm">
            {canRequest ? (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle className="w-4 h-4" />
                Eligible for payout
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-yellow-400">
                <AlertCircle className="w-4 h-4" />
                Need ${(MINIMUM_PAYOUT - currentBalance).toFixed(2)} more to request payout
              </span>
            )}
          </div>
        </div>

        <div className="bg-[#151F32] border border-gray-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <p className="text-gray-400 text-sm mb-1">Minimum Payout</p>
            <p className="text-3xl font-bold text-white">${MINIMUM_PAYOUT}</p>
          </div>
          <div className="mt-4">
            <p className="text-gray-500 text-xs mb-3">Via PayPal only</p>
            <button
              disabled={!canRequest}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                canRequest
                  ? 'bg-[#7B4FE9] hover:bg-[#5A2EC9] text-white cursor-pointer'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              {canRequest ? 'Request Payout' : `Minimum $${MINIMUM_PAYOUT} required`}
            </button>
          </div>
        </div>
      </div>

      {/* Minimum payout info */}
      <div className="bg-[#0D1526] border border-gray-800 rounded-2xl p-5 mb-8">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#7B4FE9] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-white font-medium text-sm mb-1">Payout Rules</p>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>• Minimum payout amount is <span className="text-white font-semibold">$100</span></li>
              <li>• Payouts are sent via <span className="text-white font-semibold">PayPal only</span></li>
              <li>• You can only request payout once you reach the $100 threshold</li>
              <li>• Payouts are processed within 3–5 business days</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Payout history */}
      <div className="bg-[#151F32] border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">Payout History</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center mb-4">
            <Clock className="w-6 h-6 text-gray-600" />
          </div>
          <p className="text-gray-400 font-medium mb-1">No payouts yet</p>
          <p className="text-gray-600 text-sm">Your payout history will appear here</p>
        </div>
      </div>
    </div>
  );
}
