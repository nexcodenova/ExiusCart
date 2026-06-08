import { Users, UserCheck, Clock } from 'lucide-react';

export default function ReferralsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Referrals</h1>
        <p className="text-gray-400 text-sm mt-1">People who signed up via your referral link</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#151F32] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#7B4FE9]/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-[#7B4FE9]" />
            </div>
            <span className="text-gray-400 text-sm">Total Signups</span>
          </div>
          <p className="text-3xl font-bold text-white">0</p>
        </div>
        <div className="bg-[#151F32] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-gray-400 text-sm">Converted</span>
          </div>
          <p className="text-3xl font-bold text-white">0</p>
        </div>
        <div className="bg-[#151F32] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-yellow-400" />
            </div>
            <span className="text-gray-400 text-sm">Pending Trial</span>
          </div>
          <p className="text-3xl font-bold text-white">0</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#151F32] border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">Referral List</h2>
        </div>

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-gray-600" />
          </div>
          <p className="text-gray-400 font-medium mb-1">No referrals yet</p>
          <p className="text-gray-600 text-sm">
            Share your referral link from the Marketing page to start getting signups.
          </p>
        </div>

        {/* Table header — shown when data exists */}
        {/*
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left px-6 py-3 font-medium">Name</th>
              <th className="text-left px-6 py-3 font-medium">Email</th>
              <th className="text-left px-6 py-3 font-medium">Signed Up</th>
              <th className="text-left px-6 py-3 font-medium">Status</th>
              <th className="text-left px-6 py-3 font-medium">Commission</th>
            </tr>
          </thead>
          <tbody />
        </table>
        */}
      </div>
    </div>
  );
}
