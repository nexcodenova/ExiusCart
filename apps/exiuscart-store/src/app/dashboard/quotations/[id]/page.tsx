'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft, Download, Send, Trash2, CheckCircle2, XCircle,
  Clock, Mail, AlertCircle, Printer, Bell, Loader2, MessageCircle, Link, Copy,
} from 'lucide-react';
import { quotationsApi } from '@/lib/api';

interface Quotation {
  id: number;
  quote_number: string;
  shop_id: number;
  shop_name: string;
  shop_logo?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_company?: string;
  items: any[];
  subtotal: number;
  discount: number;
  tax: number;
  tax_rate: number;
  tax_type: string;
  total: number;
  notes?: string;
  terms?: string;
  payment_schedule?: any[];
  company_address?: string;
  company_trn?: string;
  company_bank?: string;
  client_token?: string;
  client_accepted_at?: string;
  client_accepted_name?: string;
  status: string;
  valid_until: string;
  created_at: string;
  currency: string;
  reminder_count?: number;
  last_reminded_at?: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  accepted: 'bg-green-500/10 text-green-600 dark:text-green-400',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
  expired: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export default function QuotationDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const [quote, setQuote] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [reminding, setReminding] = useState(false);
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
    if (!quote?.customer_email) { showToast('No customer email on this quotation', 'error'); return; }
    setSending(true);
    try {
      await quotationsApi.send(shopId, quote.id);
      showToast(`Quotation sent to ${quote.customer_email}`, 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Failed to send', 'error');
    } finally { setSending(false); }
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
    } catch { showToast('Failed to delete', 'error'); setDeleting(false); }
  };

  const handleReminder = async () => {
    if (!quote?.customer_email) { showToast('No customer email on this quotation', 'error'); return; }
    setReminding(true);
    try {
      const res = await quotationsApi.sendReminder(shopId, quote.id);
      setQuote(prev => prev ? { ...prev, reminder_count: res.data.reminder_count } : prev);
      showToast(`Reminder sent to ${quote.customer_email}`, 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Failed to send reminder', 'error');
    } finally { setReminding(false); }
  };

  const handleCopyLink = () => {
    if (!quote?.client_token) return;
    const link = `${window.location.origin}/q/${quote.client_token}`;
    navigator.clipboard.writeText(link);
    showToast('Client link copied to clipboard!', 'success');
  };

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-40 bg-muted rounded-lg" />
      <div className="h-64 bg-muted rounded-2xl" />
    </div>
  );

  if (!quote) return null;

  const fmt = (v: number) => `${v.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${quote.currency}`;
  const itemRows = quote.items.filter((i: any) => i.type !== 'section');

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => router.push('/dashboard/quotations')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {quote.client_token && (
            <button type="button" onClick={handleCopyLink}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition">
              <Copy className="w-4 h-4" /> Copy Client Link
            </button>
          )}
          <button type="button" onClick={() => window.open(`/dashboard/quotations/${id}/print`, '_blank')}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition">
            <Printer className="w-4 h-4" /> Download PDF
          </button>
          <button type="button" onClick={handleSend} disabled={sending}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50">
            <Mail className="w-4 h-4" />
            {sending ? 'Sending...' : `Send Email`}
          </button>
          {quote.status === 'pending' && quote.customer_email && (
            <button type="button" onClick={handleReminder} disabled={reminding}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition disabled:opacity-50">
              {reminding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              {quote.reminder_count ? `Remind (${quote.reminder_count}×)` : 'Send Reminder'}
            </button>
          )}
          <button type="button"
            onClick={() => {
              const phone = quote.customer_phone?.replace(/\D/g, '') ?? '';
              const link = quote.client_token ? ` View quote: ${window.location.origin}/q/${quote.client_token}` : '';
              const msg = encodeURIComponent(`Hi ${quote.customer_name}, your quotation ${quote.quote_number} from ${quote.shop_name} — Total: ${fmt(quote.total)}. Valid until ${quote.valid_until}.${link}`);
              window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
            }}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 rounded-lg transition font-medium">
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </button>
          <button type="button" onClick={handleDelete} disabled={deleting}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition disabled:opacity-50">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Client link info */}
      {quote.client_token && (
        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link className="w-4 h-4 text-indigo-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Client Link</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Share this link — client can view and accept/reject the quotation online
              </p>
            </div>
          </div>
          <button type="button" onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition font-medium whitespace-nowrap">
            <Copy className="w-3 h-3" /> Copy Link
          </button>
        </div>
      )}

      {/* Client accepted banner */}
      {quote.status === 'accepted' && quote.client_accepted_name && (
        <div className="bg-green-500/5 border border-green-500/20 rounded-2xl px-5 py-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-sm text-foreground">
            Accepted by <strong>{quote.client_accepted_name}</strong>
            {quote.client_accepted_at && (
              <span className="text-muted-foreground ml-1">
                on {new Date(quote.client_accepted_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            )}
          </p>
        </div>
      )}

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
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-8 text-white">
          <div className="flex items-start justify-between">
            <div>
              {quote.shop_logo && (
                <Image src={quote.shop_logo} alt={quote.shop_name} width={120} height={48}
                  className="h-12 w-auto object-contain mb-3 rounded" unoptimized />
              )}
              <h2 className="text-2xl font-bold">{quote.shop_name}</h2>
              {quote.company_address && (
                <p className="text-white/70 text-xs mt-1 whitespace-pre-line">{quote.company_address}</p>
              )}
              {quote.company_trn && (
                <p className="text-white/60 text-xs mt-1">TRN: {quote.company_trn}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-white/60 text-xs uppercase tracking-widest">Quotation</p>
              <p className="text-xl font-bold font-mono mt-1">{quote.quote_number}</p>
              <p className="text-white/70 text-sm mt-1">
                {new Date(quote.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 px-8 py-6 border-b border-border">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Prepared for</p>
            <p className="font-semibold text-foreground text-lg">{quote.customer_name}</p>
            {quote.customer_company && <p className="text-sm text-muted-foreground">{quote.customer_company}</p>}
            {quote.customer_email && <p className="text-sm text-muted-foreground mt-0.5">{quote.customer_email}</p>}
            {quote.customer_phone && <p className="text-sm text-muted-foreground">{quote.customer_phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Valid Until</p>
            <p className="font-semibold text-foreground text-lg">{quote.valid_until}</p>
          </div>
        </div>

        {/* Items with section support */}
        <div className="px-8 py-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left pb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item</th>
                <th className="text-center pb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-20">Unit</th>
                <th className="text-center pb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-16">Qty</th>
                <th className="text-right pb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28">Price</th>
                <th className="text-right pb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28">Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item: any, idx: number) => {
                if (item.type === 'section') {
                  return (
                    <tr key={idx}>
                      <td colSpan={5} className="pt-5 pb-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1 block">
                          {item.section_title || 'Section'}
                        </span>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={idx} className="border-b border-border/40">
                    <td className="py-3 pr-4">
                      <div className="flex items-start gap-2">
                        <div>
                          <p className="font-medium text-foreground">{item.name}</p>
                          {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                          {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                        </div>
                        {item.is_optional && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 flex-shrink-0">Optional</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-center text-xs text-muted-foreground">{item.unit || 'pcs'}</td>
                    <td className="py-3 text-center text-foreground">{item.qty}</td>
                    <td className="py-3 text-right text-muted-foreground">{fmt(item.unit_price)}</td>
                    <td className="py-3 text-right font-semibold text-foreground">
                      {item.is_optional ? <span className="text-muted-foreground text-xs">Optional</span> : fmt(item.total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-8 pb-6">
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
                <span>Tax{quote.tax_type === 'percent' ? ` (${quote.tax_rate}%)` : ''}</span>
                <span>+{fmt(quote.tax)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-foreground text-base border-t border-border pt-2">
              <span>Total</span>
              <span className="text-indigo-600 dark:text-indigo-400">{fmt(quote.total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="mx-8 mb-4 p-4 bg-muted/50 border-l-4 border-indigo-500 rounded-r-xl">
            <p className="text-sm text-muted-foreground"><strong className="text-foreground">Note:</strong> {quote.notes}</p>
          </div>
        )}

        {/* Terms */}
        {quote.terms && (
          <div className="mx-8 mb-4 p-4 bg-muted/30 rounded-xl border border-border">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Terms & Conditions</p>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{quote.terms}</p>
          </div>
        )}

        {/* Bank details */}
        {quote.company_bank && (
          <div className="mx-8 mb-6 p-4 bg-muted/30 rounded-xl border border-border">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Payment Details</p>
            <p className="text-sm text-muted-foreground">{quote.company_bank}</p>
          </div>
        )}

        {!quote.customer_email && (
          <div className="mx-8 mb-6 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            No customer email — email sending is disabled.
          </div>
        )}
      </div>
    </div>
  );
}
