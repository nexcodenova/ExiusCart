import { DollarSign, MousePointerClick, Users, TrendingUp } from 'lucide-react';

const stats = [
  { label: 'Total Earnings',  value: '$0.00',  sub: 'Commission earned',      icon: DollarSign,        color: '#7B4FE9' },
  { label: 'Total Clicks',    value: '0',      sub: 'On your referral link',  icon: MousePointerClick, color: '#3B82F6' },
  { label: 'Signups',         value: '0',      sub: 'Via your link',          icon: Users,             color: '#10B981' },
  { label: 'Conversions',     value: '0',      sub: 'Paid customers',         icon: TrendingUp,        color: '#F59E0B' },
];

export default function OverviewPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="text-gray-400 text-sm mt-1">Your affiliate performance at a glance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-[#151F32] border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-400 text-sm">{label}</p>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}22` }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{value}</p>
            <p className="text-gray-500 text-xs">{sub}</p>
          </div>
        ))}
      </div>

      {/* Commission notice */}
      <div className="bg-[#7B4FE9]/10 border border-[#7B4FE9]/30 rounded-2xl p-5 mb-8">
        <p className="text-[#7B4FE9] font-semibold text-sm mb-1">Commission Structure</p>
        <p className="text-gray-400 text-sm">
          Commission rates are being finalised. You will be notified as soon as your rate is set. All referrals you bring now will be tracked and credited.
        </p>
      </div>

      {/* Recent activity placeholder */}
      <div className="bg-[#151F32] border border-gray-800 rounded-2xl p-6">
        <h2 className="text-white font-semibold mb-4">Recent Activity</h2>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-gray-600" />
          </div>
          <p className="text-gray-500 text-sm">No activity yet</p>
          <p className="text-gray-600 text-xs mt-1">Share your referral link to start earning</p>
        </div>
      </div>
    </div>
  );
}
