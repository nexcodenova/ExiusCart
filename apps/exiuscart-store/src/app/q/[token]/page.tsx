'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';

interface Quotation {
  quote_number: string;
  shop_name: string;
  shop_logo?: string;
  currency: string;
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
  company_address?: string;
  company_trn?: string;
  company_bank?: string;
  status: string;
  valid_until: string;
  created_at: string;
  client_accepted_name?: string;
  client_accepted_at?: string;
}

export default function ClientQuotationPage() {
  const { token } = useParams() as { token: string };
  const [quote, setQuote] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [responding, setResponding] = useState(false);
  const [responded, setResponded] = useState<'accepted' | 'rejected' | null>(null);
  const [confirmAction, setConfirmAction] = useState<'accept' | 'reject' | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/public/quotation/${token}`)
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(d => setQuote(d))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const handleRespond = async (action: 'accept' | 'reject') => {
    if (!quote) return;
    setResponding(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/public/quotation/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, name: quote.customer_name }),
      });
      if (res.ok) {
        setResponded(action === 'accept' ? 'accepted' : 'rejected');
        setQuote(q => q ? { ...q, status: action === 'accept' ? 'accepted' : 'rejected' } : q);
      }
    } catch {}
    finally { setResponding(false); setConfirmAction(null); }
  };

  const fmt = (v: number) => quote ? `${quote.currency} ${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '';
  const date = (s: string) => new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f9fafb' }}>
        <Loader2 style={{ width: 32, height: 32, color: '#6B3FD9', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (notFound || !quote) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f9fafb', fontFamily: 'sans-serif' }}>
        <AlertCircle style={{ width: 48, height: 48, color: '#ef4444', marginBottom: 16 }} />
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 8 }}>Quotation Not Found</h1>
        <p style={{ fontSize: 14, color: '#666' }}>This link may be invalid or expired.</p>
      </div>
    );
  }

  const isPending = quote.status === 'pending';
  const isExpired = new Date(quote.valid_until) < new Date();

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f3f4f6; color: #1a1a1a; }
        @media print {
          @page { size: A4; margin: 0; }
          body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#f3f4f6', paddingBottom: 48 }}>

        {/* Action bar */}
        {isPending && !isExpired && (
          <div className="no-print" style={{
            position: 'sticky', top: 0, zIndex: 50,
            background: '#fff', borderBottom: '1px solid #e5e7eb',
            padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Quotation from {quote.shop_name}</p>
              <p style={{ fontSize: 12, color: '#888' }}>{quote.quote_number} · Valid until {quote.valid_until}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmAction('reject')}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fff', color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Decline
              </button>
              <button onClick={() => setConfirmAction('accept')}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#6B3FD9', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Accept Quotation
              </button>
            </div>
          </div>
        )}

        {/* Responded banner */}
        {responded && (
          <div style={{
            background: responded === 'accepted' ? '#f0fdf4' : '#fef2f2',
            borderBottom: `2px solid ${responded === 'accepted' ? '#86efac' : '#fca5a5'}`,
            padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            {responded === 'accepted'
              ? <CheckCircle2 style={{ width: 20, height: 20, color: '#16a34a', flexShrink: 0 }} />
              : <XCircle style={{ width: 20, height: 20, color: '#ef4444', flexShrink: 0 }} />
            }
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: responded === 'accepted' ? '#15803d' : '#b91c1c' }}>
                {responded === 'accepted' ? 'Quotation Accepted!' : 'Quotation Declined'}
              </p>
              <p style={{ fontSize: 13, color: responded === 'accepted' ? '#166534' : '#991b1b', marginTop: 2 }}>
                {responded === 'accepted'
                  ? `Thank you! ${quote.shop_name} has been notified and will be in touch soon.`
                  : `Your response has been recorded. ${quote.shop_name} has been notified.`
                }
              </p>
            </div>
          </div>
        )}

        {/* Already accepted/rejected */}
        {!responded && !isPending && (
          <div style={{
            background: quote.status === 'accepted' ? '#f0fdf4' : '#fef2f2',
            padding: '12px 24px', textAlign: 'center', fontSize: 13,
            color: quote.status === 'accepted' ? '#15803d' : '#b91c1c',
            fontWeight: 600,
          }}>
            This quotation has been {quote.status}.
            {quote.client_accepted_name && quote.status === 'accepted' && ` Accepted by ${quote.client_accepted_name}.`}
          </div>
        )}

        {isExpired && isPending && (
          <div className="no-print" style={{ background: '#fffbeb', borderBottom: '1px solid #fcd34d', padding: '10px 24px', textAlign: 'center', fontSize: 13, color: '#92400e', fontWeight: 500 }}>
            This quotation expired on {quote.valid_until}. Please contact {quote.shop_name} for an updated quote.
          </div>
        )}

        {/* Document */}
        <div style={{ maxWidth: 794, margin: '32px auto', background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, #6B3FD9, #8b5cf6)', padding: '40px 48px 32px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                {quote.shop_logo && (
                  <img src={quote.shop_logo} alt={quote.shop_name}
                    style={{ maxHeight: 56, maxWidth: 160, objectFit: 'contain', marginBottom: 12, borderRadius: 6 }} />
                )}
                <h1 style={{ fontSize: 24, fontWeight: 800 }}>{quote.shop_name}</h1>
                {quote.company_address && (
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4, whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                    {quote.company_address}
                  </p>
                )}
                {quote.company_trn && (
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4 }}>TRN: {quote.company_trn}</p>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price Quotation</p>
                <p style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', marginTop: 4 }}>{quote.quote_number}</p>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 6 }}>{date(quote.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Client */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, padding: '28px 48px', borderBottom: '1px solid #f0f0f0' }}>
            <div>
              <p style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Prepared for</p>
              <p style={{ fontSize: 17, fontWeight: 700 }}>{quote.customer_name}</p>
              {quote.customer_company && <p style={{ fontSize: 13, color: '#555', marginTop: 2 }}>{quote.customer_company}</p>}
              {quote.customer_email && <p style={{ fontSize: 13, color: '#555', marginTop: 2 }}>{quote.customer_email}</p>}
              {quote.customer_phone && <p style={{ fontSize: 13, color: '#555' }}>{quote.customer_phone}</p>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Valid Until</p>
              <p style={{ fontSize: 17, fontWeight: 700 }}>{quote.valid_until}</p>
            </div>
          </div>

          {/* Items */}
          <div style={{ padding: '24px 48px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  {['Item / Service', 'Unit', 'Qty', 'Unit Price', 'Total'].map((h, hi) => (
                    <th key={h} style={{
                      padding: '10px 12px',
                      textAlign: hi === 0 ? 'left' : hi >= 3 ? 'right' : 'center',
                      fontSize: 11, color: '#888', fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                      borderBottom: '2px solid #f0f0f0',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quote.items.map((item: any, i: number) => {
                  if (item.type === 'section') {
                    return (
                      <tr key={i}>
                        <td colSpan={5} style={{ padding: '16px 12px 6px', borderBottom: '2px solid #e5e7eb' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B3FD9' }}>
                            {item.section_title || 'Section'}
                          </span>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '12px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <div>
                            <span style={{ fontWeight: 600 }}>{item.name}</span>
                            {item.is_optional && (
                              <span style={{ marginLeft: 6, fontSize: 10, background: '#EEF2FF', color: '#6B3FD9', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                                OPTIONAL
                              </span>
                            )}
                            {item.description && (
                              <p style={{ fontSize: 11, color: '#888', marginTop: 3, lineHeight: 1.4 }}>{item.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 12px', textAlign: 'center', color: '#888', fontSize: 12 }}>{item.unit || 'pcs'}</td>
                      <td style={{ padding: '12px 12px', textAlign: 'center' }}>{item.qty}</td>
                      <td style={{ padding: '12px 12px', textAlign: 'right', color: '#555' }}>{fmt(item.unit_price)}</td>
                      <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600 }}>
                        {item.is_optional ? <span style={{ color: '#aaa', fontSize: 12 }}>—</span> : fmt(item.total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div style={{ padding: '0 48px 24px', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ minWidth: 260 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: '#666' }}>
                <span>Subtotal</span><span>{fmt(quote.subtotal)}</span>
              </div>
              {quote.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: '#ef4444' }}>
                  <span>Discount</span><span>-{fmt(quote.discount)}</span>
                </div>
              )}
              {quote.tax > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: '#666' }}>
                  <span>Tax{quote.tax_type === 'percent' ? ` (${quote.tax_rate}% VAT)` : ''}</span>
                  <span>+{fmt(quote.tax)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: 18, fontWeight: 800, borderTop: '2px solid #6B3FD9', marginTop: 6, color: '#6B3FD9' }}>
                <span>TOTAL</span><span>{fmt(quote.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div style={{ margin: '0 48px 20px', padding: '12px 16px', background: '#f9f9f9', borderLeft: '4px solid #6B3FD9', borderRadius: '0 8px 8px 0', fontSize: 13, color: '#555' }}>
              <strong style={{ color: '#333' }}>Note:</strong> {quote.notes}
            </div>
          )}

          {/* Terms */}
          {quote.terms && (
            <div style={{ margin: '0 48px 20px', padding: '16px', background: '#fafafa', border: '1px solid #eee', borderRadius: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: 8 }}>
                Terms & Conditions
              </p>
              <p style={{ fontSize: 12, color: '#555', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{quote.terms}</p>
            </div>
          )}

          {/* Bank */}
          {quote.company_bank && (
            <div style={{ margin: '0 48px 20px', padding: '16px', background: '#fafafa', border: '1px solid #eee', borderRadius: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: 8 }}>Payment Details</p>
              <p style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>{quote.company_bank}</p>
            </div>
          )}

          {/* Footer */}
          <div style={{ margin: '16px 48px', paddingTop: 20, borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', paddingBottom: 32 }}>
            <p style={{ fontSize: 11, color: '#bbb' }}>Computer-generated quotation — {quote.shop_name}</p>
            <p style={{ fontSize: 11, color: '#ccc' }}>Powered by <strong style={{ color: '#6B3FD9' }}>ExiusCart</strong></p>
          </div>
        </div>

        {/* Bottom CTA */}
        {isPending && !isExpired && !responded && (
          <div className="no-print" style={{ maxWidth: 794, margin: '0 auto 48px', padding: '0 24px', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirmAction('reject')}
              style={{ padding: '12px 24px', borderRadius: 10, border: '1px solid #fca5a5', background: '#fff', color: '#ef4444', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Decline
            </button>
            <button onClick={() => setConfirmAction('accept')}
              style={{ padding: '12px 28px', borderRadius: 10, border: 'none', background: '#6B3FD9', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Accept Quotation
            </button>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {confirmAction && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 400, width: '100%', textAlign: 'center' }}>
            {confirmAction === 'accept'
              ? <CheckCircle2 style={{ width: 40, height: 40, color: '#16a34a', margin: '0 auto 16px' }} />
              : <XCircle style={{ width: 40, height: 40, color: '#ef4444', margin: '0 auto 16px' }} />
            }
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              {confirmAction === 'accept' ? 'Accept this quotation?' : 'Decline this quotation?'}
            </h2>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>
              {confirmAction === 'accept'
                ? `By accepting, you confirm agreement to the quoted amount of ${fmt(quote.total)}. ${quote.shop_name} will be notified.`
                : `Are you sure you want to decline this quotation? ${quote.shop_name} will be notified.`
              }
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => setConfirmAction(null)} disabled={responding}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => handleRespond(confirmAction)} disabled={responding}
                style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none',
                  background: confirmAction === 'accept' ? '#6B3FD9' : '#ef4444',
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                {responding && <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />}
                {confirmAction === 'accept' ? 'Yes, Accept' : 'Yes, Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
