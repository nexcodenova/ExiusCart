'use client';

import { useState } from 'react';
import { User, Mail, Save, AlertCircle } from 'lucide-react';

export default function ProfilePage() {
  const [paypalEmail, setPaypalEmail] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: wire to backend
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your account and payout details</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Account info */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSave} className="space-y-5">

            {/* Account details */}
            <div className="bg-[#151F32] border border-gray-800 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-5 flex items-center gap-2">
                <User className="w-4 h-4 text-[#7B4FE9]" />
                Account Details
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-1.5 block">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-[#0D1526] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#7B4FE9] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-1.5 block">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-[#0D1526] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#7B4FE9] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* PayPal payout */}
            <div className="bg-[#151F32] border border-gray-800 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-2 flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#003087]" />
                PayPal Payout Details
              </h2>
              <p className="text-gray-500 text-xs mb-5">Payouts are sent to your PayPal account only. Minimum payout is $100.</p>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-1.5 block">PayPal Email Address</label>
                <input
                  type="email"
                  value={paypalEmail}
                  onChange={e => setPaypalEmail(e.target.value)}
                  placeholder="your-paypal@email.com"
                  className="w-full bg-[#0D1526] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#7B4FE9] transition-colors"
                />
                <p className="text-gray-600 text-xs mt-2 flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3" />
                  Make sure this email is linked to an active PayPal account
                </p>
              </div>
            </div>

            <button
              type="submit"
              className="flex items-center gap-2 bg-[#7B4FE9] hover:bg-[#5A2EC9] text-white font-semibold px-6 py-3 rounded-xl transition-all text-sm"
            >
              <Save className="w-4 h-4" />
              {saved ? 'Saved!' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Side info */}
        <div className="space-y-4">
          <div className="bg-[#151F32] border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">Payout Rules</p>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-[#7B4FE9] mt-0.5">•</span>
                Minimum payout: <span className="text-white font-semibold ml-1">$100</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#7B4FE9] mt-0.5">•</span>
                Method: <span className="text-white font-semibold ml-1">PayPal only</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#7B4FE9] mt-0.5">•</span>
                Processing: <span className="text-white ml-1">3–5 business days</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#7B4FE9] mt-0.5">•</span>
                <span>Request only once $100 threshold is reached</span>
              </li>
            </ul>
          </div>

          <div className="bg-[#151F32] border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">Change Password</p>
            <div className="space-y-3">
              <input
                type="password"
                placeholder="Current password"
                className="w-full bg-[#0D1526] border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#7B4FE9] transition-colors"
              />
              <input
                type="password"
                placeholder="New password"
                className="w-full bg-[#0D1526] border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#7B4FE9] transition-colors"
              />
              <button className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2.5 rounded-xl transition-all font-medium">
                Update Password
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
