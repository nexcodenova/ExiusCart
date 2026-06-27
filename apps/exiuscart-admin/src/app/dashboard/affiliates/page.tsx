'use client';

import { useState, useEffect } from 'react';
import {
  Users, Search, Check, X, Copy, ExternalLink,
  ChevronDown, ChevronRight, Loader2, Link2,
  DollarSign, TrendingUp, Clock,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

interface Commission {
  id: number;
  shop_name: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid';
  paid_at: string | null;
  created_at: string;
}

interface Affiliate {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  website: string | null;
  how_promote: string | null;
  referral_code: string;
  referral_link: string;
  affiliate_type: 'external' | 'shop_owner';
  status: 'pending' | 'active' | 'suspended';
  commission_monthly: number;
  commission_yearly: number;
  total_earned: number;
  pending_amount: number;
  referral_count: number;
  notes: string | null;
  created_at: string;
  approved_at: string | null;
  commissions?: Commission[];
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  active: 'bg-green-500/10 text-green-400 border border-green-500/20',
  suspended: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

const STATUS_NEXT_LABEL: Record<string, string> = {
  pending: 'Approve',
  active: 'Suspend',
  suspended: 'Re-activate',
};

export default function AffiliatesPage() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<Record<number, Affiliate>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);

  const fetchAffiliates = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAffiliates({ search, status_filter: statusFilter });
      setAffiliates(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAffiliates(); }, [search, statusFilter]);

  const toggleStatus = async (id: number) => {
    setTogglingId(id);
    try {
      await adminApi.toggleAffiliateStatus(id);
      await fetchAffiliates();
      if (detailCache[id]) {
        const res = await adminApi.getAffiliate(id);
        setDetailCache((prev) => ({ ...prev, [id]: res.data }));
      }
    } finally {
      setTogglingId(null);
    }
  };

  const expand = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (detailCache[id]) return;
    setLoadingDetail(id);
    try {
      const res = await adminApi.getAffiliate(id);
      setDetailCache((prev) => ({ ...prev, [id]: res.data }));
    } finally {
      setLoadingDetail(null);
    }
  };

  const payCommission = async (commissionId: number, affiliateId: number) => {
    setPayingId(commissionId);
    try {
      await adminApi.payCommission(commissionId);
      const res = await adminApi.getAffiliate(affiliateId);
      setDetailCache((prev) => ({ ...prev, [affiliateId]: res.data }));
      await fetchAffiliates();
    } finally {
      setPayingId(null);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const pending = affiliates.filter((a) => a.status === 'pending').length;
  const totalEarned = affiliates.reduce((s, a) => s + a.total_earned, 0);
  const totalPending = affiliates.reduce((s, a) => s + a.pending_amount, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Affiliates</h1>
          <p className="text-gray-400 text-sm mt-1">Manage affiliate partners and their commissions</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Affiliates" value={String(affiliates.length)} icon={<Users className="w-5 h-5" />} />
        <StatCard label="Pending Approval" value={String(pending)} icon={<Clock className="w-5 h-5" />} highlight={pending > 0} />
        <StatCard label="Total Paid Out" value={`${totalEarned.toFixed(0)} AED`} icon={<DollarSign className="w-5 h-5" />} />
        <StatCard label="Pending Payout" value={`${totalPending.toFixed(0)} AED`} icon={<TrendingUp className="w-5 h-5" />} />
      </div>

      {/* Filters */}
      <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name, email, or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:border-[#6B3FD9] focus:outline-none text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white focus:border-[#6B3FD9] focus:outline-none text-sm"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#151F32] rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-[#6B3FD9]" />
          </div>
        ) : affiliates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <Users className="w-12 h-12 mb-2 opacity-30" />
            <p className="text-sm">No affiliates yet</p>
            <p className="text-xs mt-1">Applications will appear here once submitted</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {affiliates.map((affiliate) => {
              const detail = detailCache[affiliate.id];
              const isExpanded = expandedId === affiliate.id;

              return (
                <div key={affiliate.id}>
                  {/* Row */}
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Expand toggle */}
                    <button
                      type="button"
                      onClick={() => expand(affiliate.id)}
                      className="text-gray-500 hover:text-white transition flex-shrink-0"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    {/* Identity */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-white">{affiliate.name}</p>
                        {affiliate.company && (
                          <span className="text-xs text-gray-500">({affiliate.company})</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[affiliate.status]}`}>
                          {affiliate.status}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          affiliate.affiliate_type === 'shop_owner'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {affiliate.affiliate_type === 'shop_owner' ? 'Store Owner' : 'External'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 truncate">{affiliate.email}</p>
                      {affiliate.phone && <p className="text-xs text-gray-500">{affiliate.phone}</p>}
                    </div>

                    {/* Referral Code */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-[#0B1121] border border-gray-700 px-3 py-1.5 rounded-lg">
                        <Link2 className="w-3.5 h-3.5 text-[#6B3FD9]" />
                        <span className="text-sm font-mono text-white">{affiliate.referral_code}</span>
                        <button
                          type="button"
                          onClick={() => copyCode(affiliate.referral_code)}
                          className="text-gray-500 hover:text-white transition ml-1"
                          title="Copy code"
                        >
                          {copied === affiliate.referral_code ? (
                            <Check className="w-3.5 h-3.5 text-green-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-4 text-center">
                      <div>
                        <p className="text-xs text-gray-500">Referrals</p>
                        <p className="text-sm font-semibold text-white">{affiliate.referral_count}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Commission</p>
                        <p className="text-sm font-semibold text-[#6B3FD9]">${affiliate.commission_monthly} <span className="text-gray-500 font-normal text-xs">/ ${affiliate.commission_yearly}</span></p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Earned</p>
                        <p className="text-sm font-semibold text-white">{affiliate.total_earned.toFixed(0)} AED</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Pending</p>
                        <p className="text-sm font-semibold text-yellow-400">{affiliate.pending_amount.toFixed(0)} AED</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleStatus(affiliate.id)}
                        disabled={togglingId === affiliate.id}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                          affiliate.status === 'pending'
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : affiliate.status === 'active'
                            ? 'bg-red-600/20 hover:bg-red-600/30 text-red-400'
                            : 'bg-green-600/20 hover:bg-green-600/30 text-green-400'
                        }`}
                      >
                        {togglingId === affiliate.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          STATUS_NEXT_LABEL[affiliate.status]
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="bg-[#0B1121] border-t border-gray-800 p-5">
                      {loadingDetail === affiliate.id ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin text-[#6B3FD9]" />
                        </div>
                      ) : detail ? (
                        <div className="space-y-4">
                          {/* Application Details */}
                          <div>
                            <p className="text-gray-400 text-sm font-medium mb-3">Application Details</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              <AppField label="Applied" value={new Date(detail.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} />
                              {detail.phone && <AppField label="Phone" value={detail.phone} />}
                              {detail.website && (
                                <div className="bg-[#151F32] rounded-lg px-4 py-3">
                                  <p className="text-gray-500 text-xs mb-1">Website / Profile</p>
                                  <a href={detail.website} target="_blank" rel="noreferrer" className="text-[#6B3FD9] text-sm flex items-center gap-1 hover:underline truncate">
                                    {detail.website} <ExternalLink className="w-3 h-3 shrink-0" />
                                  </a>
                                </div>
                              )}
                              {detail.how_promote && (() => {
                                // Parse "Platform: X | Audience size: Y | Target region: Z | Experience: W | Details: ..."
                                const parseField = (key: string) => {
                                  const match = detail.how_promote!.match(new RegExp(`${key}:\\s*([^|]+)`));
                                  return match ? match[1].trim() : null;
                                };
                                const platform   = parseField('Platform');
                                const audience   = parseField('Audience size');
                                const region     = parseField('Target region');
                                const experience = parseField('Experience');
                                const desc       = parseField('Details');
                                return (
                                  <>
                                    {platform   && <AppField label="Promotion Channel" value={platform} />}
                                    {audience   && <AppField label="Audience / Reach" value={audience} />}
                                    {region     && <AppField label="Target Region" value={region} />}
                                    {experience && <AppField label="Experience" value={experience} />}
                                    {desc && (
                                      <div className="sm:col-span-2 lg:col-span-3 bg-[#151F32] rounded-lg px-4 py-3">
                                        <p className="text-gray-500 text-xs mb-1">Promotion Plan</p>
                                        <p className="text-gray-300 text-sm leading-relaxed">{desc}</p>
                                      </div>
                                    )}
                                    {!platform && !audience && !region && !experience && !desc && (
                                      <div className="sm:col-span-2 lg:col-span-3 bg-[#151F32] rounded-lg px-4 py-3">
                                        <p className="text-gray-500 text-xs mb-1">Promotion Plan</p>
                                        <p className="text-gray-300 text-sm">{detail.how_promote}</p>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Referral Link */}
                          <div>
                            <p className="text-gray-500 text-xs mb-1">Referral Link</p>
                            <div className="flex items-center gap-2">
                              <code className="text-xs text-[#6B3FD9] bg-[#6B3FD9]/5 border border-[#6B3FD9]/20 px-3 py-1.5 rounded-lg flex-1 truncate">
                                {detail.referral_link}
                              </code>
                              <button
                                type="button"
                                onClick={() => copyCode(detail.referral_link)}
                                className="text-gray-400 hover:text-white transition"
                              >
                                {copied === detail.referral_link ? (
                                  <Check className="w-4 h-4 text-green-400" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Commission History */}
                          <div>
                            <p className="text-gray-400 text-sm font-medium mb-2">Commission History</p>
                            {!detail.commissions || detail.commissions.length === 0 ? (
                              <p className="text-gray-600 text-sm">No commissions yet</p>
                            ) : (
                              <div className="space-y-2">
                                {detail.commissions.map((c) => (
                                  <div key={c.id} className="flex items-center justify-between bg-[#151F32] rounded-lg px-4 py-3">
                                    <div>
                                      <p className="text-sm font-medium text-white">{c.shop_name}</p>
                                      <p className="text-xs text-gray-500">
                                        {new Date(c.created_at).toLocaleDateString()}
                                        {c.paid_at && ` · Paid ${new Date(c.paid_at).toLocaleDateString()}`}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm font-semibold text-white">
                                        {c.amount.toFixed(2)} {c.currency}
                                      </span>
                                      {c.status === 'pending' ? (
                                        <button
                                          type="button"
                                          onClick={() => payCommission(c.id, affiliate.id)}
                                          disabled={payingId === c.id}
                                          className="text-xs px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
                                        >
                                          {payingId === c.id ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            'Mark Paid'
                                          )}
                                        </button>
                                      ) : (
                                        <span className="text-xs px-2 py-1 bg-green-500/10 text-green-400 rounded-full">Paid</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AppField({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#151F32] rounded-lg px-4 py-3">
      <p className="text-gray-500 text-xs mb-1">{label}</p>
      <p className="text-gray-200 text-sm font-medium">{value}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-[#151F32] border-gray-800'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${highlight ? 'bg-yellow-500/10 text-yellow-400' : 'bg-[#6B3FD9]/10 text-[#6B3FD9]'}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}

