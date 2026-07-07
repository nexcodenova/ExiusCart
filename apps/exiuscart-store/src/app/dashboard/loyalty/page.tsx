'use client';

import { useState, useEffect } from 'react';
import {
  Star, Users, Plus, X, Loader2, Search, Gift,
  CheckCircle, TrendingUp, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { loyaltyApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

type Tab = 'settings' | 'members' | 'transactions';

interface LoyaltySettings {
  enabled: boolean;
  points_per_currency_unit: number;
  redemption_rate: number;
}

interface LoyaltyAccount {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  points: number;
  total_spent: number;
  tier: 'Bronze' | 'Silver' | 'Gold';
  created_at: string;
  transactions?: LoyaltyTx[];
}

interface LoyaltyTx {
  id: number;
  type: 'earn' | 'redeem';
  points: number;
  description?: string;
  created_at: string;
}

const TIER_BADGE: Record<string, string> = {
  Bronze: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  Silver: 'bg-slate-400/10 text-slate-500 dark:text-slate-300',
  Gold: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
};

const TIER_EMOJI: Record<string, string> = {
  Bronze: '🥉',
  Silver: '🥈',
  Gold: '🥇',
};

function tierFromPoints(points: number): 'Bronze' | 'Silver' | 'Gold' {
  if (points >= 5000) return 'Gold';
  if (points >= 1000) return 'Silver';
  return 'Bronze';
}

export default function LoyaltyPage() {
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
  const { fmt } = useCurrency();
  const [tab, setTab] = useState<Tab>('settings');

  const [lsLoading, setLsLoading] = useState(true);
  const [lsSaving, setLsSaving] = useState(false);
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings>({
    enabled: false,
    points_per_currency_unit: 1,
    redemption_rate: 0.01,
  });

  const [membersLoading, setMembersLoading] = useState(false);
  const [members, setMembers] = useState<LoyaltyAccount[]>([]);
  const [search, setSearch] = useState('');

  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', phone: '', email: '' });
  const [addSaving, setAddSaving] = useState(false);

  const [detailModal, setDetailModal] = useState<LoyaltyAccount | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [earnModal, setEarnModal] = useState(false);
  const [earnPoints, setEarnPoints] = useState('');
  const [earnDesc, setEarnDesc] = useState('');
  const [earnSaving, setEarnSaving] = useState(false);

  const [redeemModal, setRedeemModal] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState('');
  const [redeemSaving, setRedeemSaving] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (!shopId) { setLsLoading(false); return; }
    loyaltyApi.getSettings(shopId)
      .then(r => setLoyaltySettings(r.data ?? { enabled: false, points_per_currency_unit: 1, redemption_rate: 0.01 }))
      .catch(() => {})
      .finally(() => setLsLoading(false));
  }, [shopId]);

  useEffect(() => {
    if (tab !== 'members' || !shopId) return;
    setMembersLoading(true);
    loyaltyApi.getAccounts(shopId, search || undefined)
      .then(r => setMembers(r.data ?? []))
      .catch(() => {})
      .finally(() => setMembersLoading(false));
  }, [tab, shopId, search]);

  async function saveSettings() {
    setLsSaving(true);
    try {
      await loyaltyApi.updateSettings(shopId, loyaltySettings);
      showToast('Settings saved', 'success');
    } catch {
      showToast('Failed to save', 'error');
    } finally {
      setLsSaving(false);
    }
  }

  async function addMember() {
    setAddSaving(true);
    try {
      const res = await loyaltyApi.createAccount(shopId, addForm);
      setMembers(prev => [res.data, ...prev]);
      setAddModal(false);
      setAddForm({ name: '', phone: '', email: '' });
      showToast('Member added', 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Failed', 'error');
    } finally {
      setAddSaving(false);
    }
  }

  async function openDetail(member: LoyaltyAccount) {
    setDetailModal(member);
    setDetailLoading(true);
    try {
      const res = await loyaltyApi.getAccount(shopId, member.id);
      setDetailModal(res.data);
    } catch {
    } finally {
      setDetailLoading(false);
    }
  }

  async function submitEarn() {
    if (!detailModal) return;
    setEarnSaving(true);
    try {
      const res = await loyaltyApi.earn(shopId, detailModal.id, { points: Number(earnPoints), description: earnDesc });
      setDetailModal(res.data);
      setMembers(prev => prev.map(m => m.id === detailModal.id ? res.data : m));
      setEarnModal(false);
      setEarnPoints(''); setEarnDesc('');
      showToast(`${earnPoints} points earned`, 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Failed', 'error');
    } finally {
      setEarnSaving(false);
    }
  }

  async function submitRedeem() {
    if (!detailModal) return;
    setRedeemSaving(true);
    try {
      const res = await loyaltyApi.redeem(shopId, detailModal.id, { points: Number(redeemPoints) });
      setDetailModal(res.data);
      setMembers(prev => prev.map(m => m.id === detailModal.id ? res.data : m));
      setRedeemModal(false);
      setRedeemPoints('');
      showToast(`${redeemPoints} points redeemed`, 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Failed', 'error');
    } finally {
      setRedeemSaving(false);
    }
  }

  const totalMembers = members.length;
  const totalPointsIssued = members.reduce((s, m) => s + m.points, 0);
  const goldMembers = members.filter(m => (m.tier ?? tierFromPoints(m.points)) === 'Gold').length;

  if (lsLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Loyalty</h1>
          <p className="text-muted-foreground text-sm">Reward your loyal customers with points</p>
        </div>
        {tab === 'members' && (
          <button type="button" onClick={() => setAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
            <Plus className="w-4 h-4" /> Add Member
          </button>
        )}
      </div>

      {tab === 'members' && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Members', value: totalMembers, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'Total Points Issued', value: totalPointsIssued.toLocaleString(), icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
            { label: 'Gold Members', value: goldMembers, icon: TrendingUp, color: 'text-yellow-600', bg: 'bg-yellow-500/10' },
          ].map(s => (
            <div key={s.label} className="bg-card rounded-xl border border-border p-5">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border p-1.5">
        <div className="flex gap-1">
          {(['settings', 'members', 'transactions'] as Tab[]).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium capitalize transition ${tab === t ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
              {t === 'settings' && <Star className="w-4 h-4" />}
              {t === 'members' && <Users className="w-4 h-4" />}
              {t === 'transactions' && <Gift className="w-4 h-4" />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {tab === 'settings' && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-6">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" /> Loyalty Program Settings
          </h2>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="font-medium text-foreground">Enable Loyalty Program</p>
              <p className="text-sm text-muted-foreground">Allow customers to earn and redeem points</p>
            </div>
            <button type="button"
              onClick={() => setLoyaltySettings(s => ({ ...s, enabled: !s.enabled }))}
              className={`relative w-12 h-6 rounded-full transition ${loyaltySettings.enabled ? 'bg-primary' : 'bg-muted'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${loyaltySettings.enabled ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Points per Currency Unit</label>
              <input type="number" min="0" step="0.1" value={loyaltySettings.points_per_currency_unit}
                onChange={e => setLoyaltySettings(s => ({ ...s, points_per_currency_unit: Number(e.target.value) }))}
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
              <p className="text-xs text-muted-foreground mt-1">e.g. 1 point per 1 AED spent</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Redemption Rate (currency per point)</label>
              <input type="number" min="0" step="0.001" value={loyaltySettings.redemption_rate}
                onChange={e => setLoyaltySettings(s => ({ ...s, redemption_rate: Number(e.target.value) }))}
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
              <p className="text-xs text-muted-foreground mt-1">e.g. 0.01 AED per point = 100 points = 1 AED</p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Tier Thresholds</p>
            <div className="flex gap-4 text-sm flex-wrap">
              <span className="flex items-center gap-1.5">🥉 <span className="text-orange-500 font-medium">Bronze</span> <span className="text-muted-foreground">0 – 999 pts</span></span>
              <span className="flex items-center gap-1.5">🥈 <span className="text-slate-400 font-medium">Silver</span> <span className="text-muted-foreground">1,000 – 4,999 pts</span></span>
              <span className="flex items-center gap-1.5">🥇 <span className="text-yellow-500 font-medium">Gold</span> <span className="text-muted-foreground">5,000+ pts</span></span>
            </div>
          </div>

          <button type="button" onClick={saveSettings} disabled={lsSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60">
            {lsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Save Settings
          </button>
        </div>
      )}

      {tab === 'members' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {membersLoading ? (
              <div className="space-y-3 p-4">
                {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}
              </div>
            ) : members.length === 0 ? (
              <div className="py-16 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-muted-foreground text-sm">No members yet. Add your first loyalty member.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {['Member','Phone','Points','Tier','Total Spent'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {members.map(m => {
                      const tier = m.tier ?? tierFromPoints(m.points);
                      return (
                        <tr key={m.id} onClick={() => openDetail(m)} className="hover:bg-muted/30 cursor-pointer">
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{m.name}</p>
                            {m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{m.phone || '—'}</td>
                          <td className="px-4 py-3 font-semibold text-foreground">{m.points.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${TIER_BADGE[tier] ?? ''}`}>
                              {TIER_EMOJI[tier]} {tier}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{fmt(m.total_spent ?? 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'transactions' && (
        <div className="py-16 text-center">
          <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="text-muted-foreground text-sm">Click on a member in the Members tab to view their transaction history.</p>
        </div>
      )}

      {addModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">Add Loyalty Member</h2>
              <button type="button" onClick={() => setAddModal(false)} className="p-1.5 hover:bg-muted rounded-lg transition text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Full Name *</label>
                <input type="text" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Phone *</label>
                <input type="tel" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                <input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button type="button" onClick={() => setAddModal(false)}
                className="flex-1 py-2.5 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={addMember} disabled={addSaving || !addForm.name || !addForm.phone}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
                {addSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Add Member
              </button>
            </div>
          </div>
        </div>
      )}

      {detailModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">{detailModal.name}</h2>
                <p className="text-xs text-muted-foreground">{detailModal.phone}</p>
              </div>
              <button type="button" onClick={() => setDetailModal(null)} className="p-1.5 hover:bg-muted rounded-lg transition text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground">Current Points</p>
                  <p className="text-2xl font-bold text-foreground">{detailModal.points.toLocaleString()}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground">Tier</p>
                  <p className="text-xl font-bold text-foreground">
                    {TIER_EMOJI[detailModal.tier ?? tierFromPoints(detailModal.points)]} {detailModal.tier ?? tierFromPoints(detailModal.points)}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setEarnModal(true)}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 rounded-lg text-sm font-medium transition">
                  <ArrowUpRight className="w-4 h-4" /> Earn Points
                </button>
                <button type="button" onClick={() => setRedeemModal(true)}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-sm font-medium transition">
                  <ArrowDownRight className="w-4 h-4" /> Redeem Points
                </button>
              </div>

              {detailLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />)}
                </div>
              ) : detailModal.transactions?.length ? (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Transaction History</p>
                  <div className="space-y-2">
                    {detailModal.transactions.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/50 text-sm">
                        <div className="flex items-center gap-2">
                          {tx.type === 'earn'
                            ? <ArrowUpRight className="w-4 h-4 text-green-500" />
                            : <ArrowDownRight className="w-4 h-4 text-red-500" />}
                          <span className="text-muted-foreground">{tx.description || (tx.type === 'earn' ? 'Points earned' : 'Points redeemed')}</span>
                        </div>
                        <div className="text-right">
                          <span className={`font-medium ${tx.type === 'earn' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                            {tx.type === 'earn' ? '+' : '-'}{tx.points}
                          </span>
                          <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No transactions yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {earnModal && detailModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">Earn Points</h2>
              <button type="button" onClick={() => setEarnModal(false)} className="p-1.5 hover:bg-muted rounded-lg transition text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Points to Add *</label>
                <input type="number" min="1" value={earnPoints} onChange={e => setEarnPoints(e.target.value)}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                <input type="text" value={earnDesc} onChange={e => setEarnDesc(e.target.value)} placeholder="Purchase, bonus, etc."
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button type="button" onClick={() => setEarnModal(false)} className="flex-1 py-2.5 border border-border rounded-lg text-sm hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={submitEarn} disabled={earnSaving || !earnPoints}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-60 flex items-center justify-center gap-2">
                {earnSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Add Points
              </button>
            </div>
          </div>
        </div>
      )}

      {redeemModal && detailModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">Redeem Points</h2>
              <button type="button" onClick={() => setRedeemModal(false)} className="p-1.5 hover:bg-muted rounded-lg transition text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <span className="text-muted-foreground">Available: </span>
                <span className="font-semibold text-foreground">{detailModal.points.toLocaleString()} pts</span>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Points to Redeem *</label>
                <input type="number" min="1" max={detailModal.points} value={redeemPoints} onChange={e => setRedeemPoints(e.target.value)}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
              </div>
              {redeemPoints && (
                <p className="text-xs text-muted-foreground">
                  Currency value: <span className="font-medium text-foreground">{(Number(redeemPoints) * loyaltySettings.redemption_rate).toFixed(2)}</span>
                </p>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button type="button" onClick={() => setRedeemModal(false)} className="flex-1 py-2.5 border border-border rounded-lg text-sm hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={submitRedeem} disabled={redeemSaving || !redeemPoints || Number(redeemPoints) > detailModal.points}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-60 flex items-center justify-center gap-2">
                {redeemSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Redeem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
