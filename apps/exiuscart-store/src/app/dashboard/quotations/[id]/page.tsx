'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft, Download, Send, Trash2, CheckCircle2, XCircle,
  Clock, Mail, AlertCircle, Printer,
} from 'lucide-react';
import { quotationsApi } from '@/lib/api';

interface QuotationItem {
  product_id?: number;
  name: string;
  sku?: string;
  quantity_available?: number;
  qty: number;
  unit_price: number;
  total: number;
}

interface Quotation {
  id: number;
  quote_number: string;
  shop_id: number;
  shop_name: string;
  shop_logo?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  items: QuotationItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes?: string;
  status: string;
  valid_until: string;
  created_at: string;
  currency: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  accepted: 'bg-green-500/10 text-green-600 dark:text-green-400',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
  expired: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export default function QuotationDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();

  const [quote, setQuote] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  const load = useCallback(() => {
    if (!shopId) return;
    quotationsApi.get(shopId, parseInt(id))
      .then(r => setQuote(r.data))
      .catch(() => router.push('/dashboard/quotations'))
      .finally(() => setLoading(false));
  }, [shopId, id, router]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSend = async () => {
    if (!quote?.customer_email) {
      showToast('No customer email on this quotation', 'error');
      return;
    }
    setSending(true);
    try {
      await quotationsApi.send(shopId, quote.id);
      showToast(`Quotation sent to ${quote.customer_email}`, 'success');
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? 'Failed to send';
      showToast(msg, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleStatus = async (status: string) => {
    if (!quote) return;
    await quotationsApi.updateStatus(shopId, quote.id, status);
    setQuote({ ...quote, status });
  };

  const handleDelete = async () => {
    if (!quote) return;
    if (!confirm(`Delete quotation ${quote.quote_number}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await quotationsApi.delete(shopId, quote.id);
      router.push('/dashboard/quotations');
    } catch {
      showToast('Failed to delete', 'error');
      setDeleting(false);
    }
  };

  const handlePrint = () => {
    window.open(`/dashboard/quotations/${id}/print`, '_blank');
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-40 bg-muted rounded-lg" />
        <div className="h-64 bg-muted rounded-2xl" />
      </div>
    );
  }

  if (!quote) return null;

  const fmt = (v: number) => `${v.toLocaleString()} ${quote.currency}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition
          ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => router.push('/dashboard/quotations')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="w-4 h-4" /> Back to Quotations
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition">
            <Printer className="w-4 h-4" /> Download PDF
          </button>
          <button type="button" onClick={handleSend} disabled={sending}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50">
            <Mail className="w-4 h-4" />
            {sending ? 'Sending...' : `Send to ${quote.customer_email ? quote.customer_email : 'Customer'}`}
          </button>
          <button type="button" onClick={handleDelete} disabled={deleting}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition disabled:opacity-50">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[quote.status] ?? 'bg-muted text-muted-foreground'}`}>
            {quote.status}
          </span>
          <span className="text-sm text-muted-foreground">
            Valid until <strong className="text-foreground">{quote.valid_until}</strong>
          </span>
        </div>
        {quote.status === 'pending' && (
          <div className="flex gap-2">
            <button type="button" onClick={() => handleStatus('accepted')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition">
              <CheckCircle2 className="w-3.5 h-3.5" /> Mark Accepted
            </button>
            <button type="button" onClick={() => handleStatus('rejected')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition">
              <XCircle className="w-3.5 h-3.5" /> Mark Rejected
            </button>
          </div>
        )}
        {(quote.status === 'accepted' || quote.status === 'rejected') && (
          <button type="button" onClick={() => handleStatus('pending')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border text-muted-foreground hover:text-foreground rounded-lg transition">
            <Clock className="w-3.5 h-3.5" /> Reset to Pending
          </button>
        )}
      </div>

      {/* Quote document */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-8 text-white">
          <div className="flex items-start justify-between">
            <div>
              {quote.shop_logo && (
                <Image src={quote.shop_logo} alt={quote.shop_name}
                  width={120} height={48}
                  className="h-12 w-auto object-contain mb-3 rounded"
                  unoptimized />
              )}
              <h2 className="text-2xl font-bold">{quote.shop_name}</h2>
              <p className="text-white/70 text-sm mt-1">Price Quotation</p>
            </div>
            <div className="text-right">
              <p className="text-white/60 text-xs uppercase tracking-widest">Quote #</p>
              <p className="text-xl font-bold font-mono mt-1">{quote.quote_number}</p>
              <p className="text-white/70 text-sm mt-1">
                {new Date(quote.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Customer */}
        <div className="grid grid-cols-2 gap-6 px-8 py-6 border-b border-border">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Prepared for</p>
            <p className="font-semibold text-foreground text-lg">{quote.customer_name}</p>
            {quote.customer_email && <p className="text-sm text-muted-foreground mt-0.5">{quote.customer_email}</p>}
            {quote.customer_phone && <p className="text-sm text-muted-foreground">{quote.customer_phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Valid Until</p>
            <p className="font-semibold text-foreground text-lg">{quote.valid_until}</p>
          </div>
        </div>

        {/* Line items */}
        <div className="px-8 py-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left pb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product</th>
                <th className="text-center pb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock</th>
                <th className="text-center pb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qty</th>
                <th className="text-right pb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unit Price</th>
                <th className="text-right pb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {quote.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-3 pr-4">
                    <p className="font-medium text-foreground">{item.name}</p>
                    {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                  </td>
                  <td className="py-3 text-center">
                    <span className={`text-xs font-medium ${(item.quantity_available ?? 0) > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                      {item.quantity_available ?? '—'}
                    </span>
                  </td>
                  <td className="py-3 text-center text-foreground">{item.qty}</td>
                  <td className="py-3 text-right text-muted-foreground">{fmt(item.unit_price)}</td>
                  <td className="py-3 text-right font-semibold text-foreground">{fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-8 pb-8">
          <div className="ml-auto w-64 space-y-2 border-t border-border pt-4">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span><span>{fmt(quote.subtotal)}</span>
            </div>
            {quote.discount > 0 && (
              <div className="flex justify-between text-sm text-red-500">
                <span>Discount</span><span>-{fmt(quote.discount)}</span>
              </div>
            )}
            {quote.tax > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Tax</span><span>+{fmt(quote.tax)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-foreground text-base border-t border-border pt-2">
              <span>Total</span><span className="text-indigo-600 dark:text-indigo-400">{fmt(quote.total)}</span>
            </div>
          </div>

          {quote.notes && (
            <div className="mt-6 p-4 bg-muted/50 border-l-4 border-indigo-500 rounded-r-xl">
              <p className="text-sm text-muted-foreground"><strong className="text-foreground">Note:</strong> {quote.notes}</p>
            </div>
          )}
        </div>

        {/* No email warning */}
        {!quote.customer_email && (
          <div className="mx-8 mb-6 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            No customer email — sending is disabled. Edit the quotation to add one.
          </div>
        )}
      </div>
    </div>
  );
}
