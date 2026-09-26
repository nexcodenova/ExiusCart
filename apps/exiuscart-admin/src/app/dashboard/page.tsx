'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Store, CreditCard, Users, TrendingUp, TrendingDown,
  Clock, AlertCircle, ArrowUpRight, DollarSign, Loader2,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { SystemHealth } from '@/components/system-health';
import { PlanChip, StatusChip, fmtDate } from '@/lib/subscription-ui';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [pending, setPending] = useState<any[]>([]);
  const [expiring, setExpiring] = useState<any[]>([]);
  const [recentShops, setRecentShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, pendingRes, expiringRes, shopsRes] = await Promise.all([
          adminApi.getStats(),
          adminApi.getPendingSubscriptions(),
          adminApi.getExpiringSoon(),
          adminApi.getRecentShops(),
        ]);
        setStats(statsRes.data);
        setPending(pendingRes.data ?? []);
        setExpiring(expiringRes.data ?? []);
        setRecentShops(shopsRes.data ?? []);
      } catch {/* handled below */}
      setLoading(false);
    };
    load();
  }, []);

  const handleApprove = async (subId: number) => {
    try {
      await adminApi.approveSubscription(subId);
      setPending((prev) => prev.filter((p) => p.id !== subId));
      setStats((prev: any) => prev ? { ...prev, pending_payments: Math.max(0, (prev.pending_payments ?? 1) - 1) } : prev);
    } catch {/* no-op */}
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#6B3FD9] animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 text-sm mt-1">Welcome back, Super Admin</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Stores"
          value={stats?.total_shops ?? 0}
          subtitle={`${stats?.active_shops ?? 0} active`}
          icon={<Store className="w-5 h-5" />}
          color="primary"
        />
        <StatCard
          title="Active Users"
          value={stats?.total_users ?? 0}
          subtitle="Owners & Staff"
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Total Revenue"
          value={`$${Number(stats?.monthly_revenue ?? 0).toLocaleString()}`}
          subtitle="USD collected"
          icon={<DollarSign className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          title="Pending Approvals"
          value={stats?.pending_payments ?? 0}
          subtitle="Awaiting approval"
          icon={<CreditCard className="w-5 h-5" />}
          color="orange"
        />
      </div>

      <SystemHealth />

      {/* Panels */}
      <div className="grid lg:grid-cols-2 gap-4 lg:gap-6 mb-8">
        {/* Pending Subscriptions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[#6B3FD9]" />
              <h2 className="font-semibold text-gray-900">Pending Approvals</h2>
            </div>
            {pending.length > 0 && (
              <span className="text-xs bg-[#6B3FD9]/10 text-[#6B3FD9] px-2 py-1 rounded-full">
                {pending.length} pending
              </span>
            )}
          </div>
          {pending.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No pending approvals</p>
          ) : (
            <div className="space-y-1">
              {pending.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between py-3 border-b border-gray-200 last:border-0">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{sub.shop_name}</p>
                    <p className="text-xs text-gray-500 capitalize">{sub.plan_type} Plan</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm text-gray-900">{sub.amount_paid} {sub.currency}</span>
                    <button
                      type="button"
                      onClick={() => handleApprove(sub.id)}
                      className="text-xs bg-green-500/10 text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-500/20 transition"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link href="/dashboard/subscriptions" className="flex items-center justify-center gap-1 text-[#6B3FD9] hover:text-purple-600 mt-4 text-sm font-medium transition">
            View All Payments <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Expiring Subscriptions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-red-600" />
              <h2 className="font-semibold text-gray-900">Expiring Soon</h2>
            </div>
            <span className="text-xs bg-red-500/10 text-red-600 px-2 py-1 rounded-full">Next 7 days</span>
          </div>
          {expiring.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No subscriptions expiring soon</p>
          ) : (
            <div className="space-y-1">
              {expiring.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between py-3 border-b border-gray-200 last:border-0">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{sub.shop_name}</p>
                    <p className="text-xs text-gray-500 capitalize">{sub.plan_type} {sub.billing_type}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-lg ${sub.days_left <= 2 ? 'bg-red-500/10 text-red-600' : 'bg-orange-500/10 text-orange-600'}`}>
                    {sub.days_left} days left
                  </span>
                </div>
              ))}
            </div>
          )}
          <Link href="/dashboard/subscriptions" className="flex items-center justify-center gap-1 text-[#6B3FD9] hover:text-purple-600 mt-4 text-sm font-medium transition">
            View All Subscriptions <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Recent Shops */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-gray-900">Recently Registered Stores</h2>
          <Link href="/dashboard/shops" className="text-sm text-[#6B3FD9] hover:text-purple-600 transition">View All</Link>
        </div>
        {recentShops.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No stores registered yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-600 border-b border-gray-200">
                  <th className="pb-3 font-medium">Store Name</th>
                  <th className="pb-3 font-medium hidden sm:table-cell">Owner</th>
                  <th className="pb-3 font-medium">Plan</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium hidden md:table-cell">Registered</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {recentShops.map((shop) => (
                  <ShopRow key={shop.id} shop={shop} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon, color }: {
  title: string; value: string | number; subtitle: string;
  icon: React.ReactNode; color: 'primary' | 'blue' | 'green' | 'orange';
}) {
  const colors = {
    primary: 'bg-[#6B3FD9]/10 text-[#6B3FD9]',
    blue: 'bg-blue-500/10 text-blue-600',
    green: 'bg-green-500/10 text-green-600',
    orange: 'bg-orange-500/10 text-orange-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-gray-600 text-sm">{title}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>
      </div>
      <div className={`p-2.5 rounded-lg shrink-0 ${colors[color]}`}>{icon}</div>
    </div>
  );
}

function ShopRow({ shop }: { shop: any }) {
  return (
    <tr className="border-b border-gray-200 last:border-0">
      <td className="py-3 font-medium text-gray-900">{shop.name}</td>
      <td className="py-3 text-gray-600 hidden sm:table-cell">{shop.owner}</td>
      <td className="py-3"><PlanChip plan={shop.plan} /></td>
      <td className="py-3">
        {shop.is_active
          ? <StatusChip status={shop.subscription_status} />
          : <span className="inline-block rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600">Suspended</span>}
      </td>
      <td className="py-3 text-gray-500 hidden md:table-cell">{fmtDate(shop.created_at)}</td>
    </tr>
  );
}
