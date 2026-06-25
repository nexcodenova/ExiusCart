'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, ClipboardList, X, Clock, CheckCircle2, FileText } from 'lucide-react';
import { quotationsApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

interface Quotation {
  id: string;
  customer: string;
  phone: string;
  items: number;
  total: number;
  status: 'pending' | 'accepted' | 'expired' | 'rejected';
  date: string;
  validUntil: string;
}

const STATUS_STYLES: Record<string, string> = {
  accepted: 'bg-green-500/10 text-green-600 dark:text-green-400',
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  expired: 'bg-red-500/10 text-red-600 dark:text-red-400',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
  const { sym } = useCurrency();

  useEffect(() => {
    if (!shopId) return;
    quotationsApi.getAll(shopId)
      .then((res) => setQuotations(res.data ?? []))
      .catch(() => setQuotations([]))
      .finally(() => setLoading(false));
  }, [shopId]);

  const filtered = quotations.filter((q) =>
    q.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quotations</h1>
          <p className="text-muted-foreground text-sm">Create and manage price quotes for customers</p>
        </div>
        <button type="button" onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2.5 rounded-lg font-semibold hover:opacity-90 transition text-sm">
          <Plus className="w-4 h-4" /> New Quotation
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total quotes', icon: FileText, value: quotations.length, color: '' },
          { label: 'Pending', icon: Clock, value: quotations.filter(q=>q.status==='pending').length, color: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Accepted', icon: CheckCircle2, value: quotations.filter(q=>q.status==='accepted').length, color: 'text-green-600 dark:text-green-400' },
        ].map(({ label, icon: Icon, value, color }) => (
          <div key={label} className="bg-card rounded-2xl border border-border p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><Icon className="h-5 w-5 text-foreground/70" /></div>
            <p className="mt-4 text-sm text-muted-foreground">{label}</p>
            <p className={`mt-0.5 text-2xl font-bold tracking-tight tabular-nums ${color || 'text-foreground'}`}>{loading ? '—' : value}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Search quotations..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-2.5 bg-card border border-border rounded-xl focus:ring-2 focus:ring-foreground/10 outline-none text-foreground placeholder:text-muted-foreground" />
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <ClipboardList className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold text-foreground mb-1">{searchQuery ? 'No quotations found' : 'No quotations yet'}</h3>
            <p className="text-sm text-muted-foreground mb-5">{searchQuery ? 'Try a different search' : 'Create your first quotation to send price quotes to customers'}</p>
            {!searchQuery && (
              <button type="button" onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition">
                <Plus className="w-4 h-4" /> New Quotation
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Quote #</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Customer</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Items</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Total</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Valid Until</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((q) => (
                  <tr key={q.id} className="hover:bg-muted/30 transition">
                    <td className="p-4"><span className="font-mono text-sm text-foreground">{q.id}</span></td>
                    <td className="p-4">
                      <p className="text-sm font-medium text-foreground">{q.customer}</p>
                      <p className="text-xs text-muted-foreground">{q.phone}</p>
                    </td>
                    <td className="p-4 text-center"><span className="text-sm text-muted-foreground">{q.items}</span></td>
                    <td className="p-4 text-right"><span className="text-sm font-semibold text-foreground">{q.total.toLocaleString()} {sym}</span></td>
                    <td className="p-4 text-center"><span className="text-sm text-muted-foreground">{q.validUntil}</span></td>
                    <td className="p-4 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[q.status] ?? 'bg-muted text-muted-foreground'}`}>{q.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
