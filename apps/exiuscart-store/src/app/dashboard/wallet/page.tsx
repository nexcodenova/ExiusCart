'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Wallet as WalletIcon, Search, Loader2, X, Plus, Minus, ArrowUpRight, ArrowDownLeft, Users, Coins,
} from 'lucide-react';
import { walletApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface WalletAccountRow {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_email: string | null;
  balance: number;
  currency: string;
  last_activity: string | null;
}

interface WalletTx {
  id: number;
  type: 'credit' | 'debit';
  amount: number;
  description: string | null;
  order_id: number | null;
  created_at: string | null;
}

function AdjustModal({ mode, account, shopId, onClose, onDone }: {
  mode: 'credit' | 'debit'; account: WalletAccountRow; shopId: string; onClose: () => void; onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const value = Number(amount);
    if (!value || value <= 0) return;
    setSaving(true); setError('');
    try {
      const fn = mode === 'credit' ? walletApi.credit : walletApi.debit;
      await fn(shopId, account.id, { amount: value, description: description.trim() || undefined });
      onDone();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-foreground">{mode === 'credit' ? 'Add to balance' : 'Deduct from balance'}</p>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        {error && <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-3 py-2">{error}</div>}
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Amount *</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus
            className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Note (optional)</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Goodwill credit"
            className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm" />
        </div>
        <button onClick={submit} disabled={saving || !amount || Number(amount) <= 0}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {mode === 'credit' ? 'Add' : 'Deduct'}
        </button>
      </div>
    </div>
  );
}

function AccountDetailModal({ account, shopId, onClose, onChanged }: {
  account: WalletAccountRow; shopId: string; onClose: () => void; onChanged: () => void;
}) {
  const { fmt } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(account.balance);
  const [txs, setTxs] = useState<WalletTx[]>([]);
  const [adjustMode, setAdjustMode] = useState<'credit' | 'debit' | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    walletApi.getAccount(shopId, account.id)
      .then((r) => { setBalance(r.data?.balance ?? 0); setTxs(r.data?.transactions ?? []); })
      .finally(() => setLoading(false));
  }, [shopId, account.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <p className="font-semibold text-foreground">{account.customer_name}</p>
            <p className="text-xs text-muted-foreground">{account.customer_email}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="bg-muted/40 border border-border rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Current balance</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{fmt(balance)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAdjustMode('credit')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-500/20 transition">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
              <button onClick={() => setAdjustMode('debit')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition">
                <Minus className="w-3.5 h-3.5" /> Deduct
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-2">Transaction history</p>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-sm">Loading...</span>
              </div>
            ) : txs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No transactions yet.</p>
            ) : (
              <div className="space-y-1.5">
                {txs.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {t.type === 'credit'
                        ? <ArrowUpRight className="w-4 h-4 text-green-500 shrink-0" />
                        : <ArrowDownLeft className="w-4 h-4 text-destructive shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate">{t.description || (t.type === 'credit' ? 'Credit' : 'Debit')}</p>
                        <p className="text-xs text-muted-foreground">{t.created_at ? new Date(t.created_at).toLocaleString() : ''}</p>
                      </div>
                    </div>
                    <p className={`text-sm font-medium tabular-nums shrink-0 ${t.type === 'credit' ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                      {t.type === 'credit' ? '+' : '−'}{fmt(t.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {adjustMode && (
        <AdjustModal mode={adjustMode} account={account} shopId={shopId} onClose={() => setAdjustMode(null)}
          onDone={() => { load(); onChanged(); }} />
      )}
    </div>
  );
}

export default function WalletPage() {
  const { fmt } = useCurrency();
  const [shopId, setShopId] = useState('');
  const [tab, setTab] = useState<'members' | 'settings'>('members');
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<WalletAccountRow[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<WalletAccountRow | null>(null);

  const [isEnabled, setIsEnabled] = useState(false);
  const [cashbackPercent, setCashbackPercent] = useState('0');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const loadAccounts = useCallback(() => {
    if (!shopId) return;
    setLoading(true);
    walletApi.listAccounts(shopId, search || undefined)
      .then((r) => setAccounts(r.data ?? []))
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }, [shopId, search]);

  const loadSettings = useCallback(() => {
    if (!shopId) return;
    walletApi.getSettings(shopId).then((r) => {
      setIsEnabled(!!r.data?.is_enabled);
      setCashbackPercent(String(r.data?.cashback_percent ?? 0));
    });
  }, [shopId]);

  useEffect(() => { loadAccounts(); loadSettings(); }, [loadAccounts, loadSettings]);

  const saveSettings = async () => {
    setSavingSettings(true); setSettingsSaved(false);
    try {
      await walletApi.setSettings(shopId, { is_enabled: isEnabled, cashback_percent: Number(cashbackPercent) || 0 });
      setSettingsSaved(true);
    } finally {
      setSavingSettings(false);
    }
  };

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <WalletIcon className="w-5 h-5 text-primary" /> Wallet
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customer cashback balances for your storefront — separate from Loyalty points. Credits automatically when an order is paid, debits when a customer spends it at checkout.
        </p>
      </div>

      <div className="inline-flex bg-muted rounded-lg p-1">
        {(['members', 'settings'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {t === 'members' ? 'Members' : 'Settings'}
          </button>
        ))}
      </div>

      {tab === 'settings' ? (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4 max-w-md">
          <label className="flex items-center justify-between p-3 border border-border rounded-lg cursor-pointer">
            <div>
              <p className="text-sm font-medium text-foreground">Enable Wallet</p>
              <p className="text-xs text-muted-foreground">Customers earn and spend a cashback balance on your storefront</p>
            </div>
            <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} className="w-4 h-4" />
          </label>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Cashback % on paid orders</label>
            <div className="relative w-32">
              <input type="number" min="0" max="100" step="0.5" value={cashbackPercent}
                onChange={(e) => setCashbackPercent(e.target.value)}
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm pr-7" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">e.g. 3 means a customer gets 3% of their order total back as wallet balance once it's paid. Your call — not fixed.</p>
          </div>
          <button onClick={saveSettings} disabled={savingSettings}
            className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center gap-2">
            {savingSettings && <Loader2 className="w-4 h-4 animate-spin" />}
            {settingsSaved && !savingSettings ? 'Saved' : 'Save Settings'}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Users className="w-4 h-4 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Wallet accounts</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{accounts.length}</p>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Coins className="w-4 h-4 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total balance outstanding</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{fmt(totalBalance)}</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border bg-card py-2.5 pl-11 pr-4 text-foreground outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-foreground/10" />
          </div>

          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            {loading ? (
              <div className="p-8 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div>
            ) : accounts.length === 0 ? (
              <div className="p-16 text-center">
                <WalletIcon className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
                <p className="text-muted-foreground text-sm">No wallet accounts yet.</p>
                <p className="text-muted-foreground/60 text-xs mt-1">Accounts appear automatically once a customer earns or spends wallet balance.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    {['Customer', 'Email', 'Balance', 'Last Activity'].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {accounts.map((a) => (
                    <tr key={a.id} onClick={() => setSelected(a)} className="hover:bg-muted/30 cursor-pointer transition">
                      <td className="px-4 py-3 text-foreground font-medium">{a.customer_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.customer_email || '—'}</td>
                      <td className="px-4 py-3 text-foreground tabular-nums font-medium">{fmt(a.balance)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{a.last_activity ? new Date(a.last_activity).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {selected && (
        <AccountDetailModal account={selected} shopId={shopId} onClose={() => setSelected(null)} onChanged={loadAccounts} />
      )}
    </div>
  );
}
