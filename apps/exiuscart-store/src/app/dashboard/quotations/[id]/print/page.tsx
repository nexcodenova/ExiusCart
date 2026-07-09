'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { quotationsApi } from '@/lib/api';

interface Quotation {
  id: number;
  quote_number: string;
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
  status: string;
  valid_until: string;
  created_at: string;
  currency: string;
}

export default function QuotationPrintPage() {
  const { id } = useParams() as { id: string };
  const [quote, setQuote] = useState<Quotation | null>(null);

  useEffect(() => {
    const shopId = localStorage.getItem('shop_id') ?? '';
    quotationsApi.get(shopId, parseInt(id)).then(r => {
      setQuote(r.data);
      setTimeout(() => window.print(), 700);
    }).catch(() => window.close());
  }, [id]);

  if (!quote) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#666' }}>
        Loading quotation...
      </div>
    );
  }

  const fmt = (v: number) => `${quote.currency} ${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const date = new Date(quote.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #1a1a1a; }
        @media print {
          @page { size: A4; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, zIndex: 99 }}>
        <button onClick={() => window.print()}
          style={{ background: '#6B3FD9', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Download / Print PDF
        </button>
      </div>

      <div style={{ maxWidth: 794, margin: '0 auto', paddingBottom: 48 }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #6B3FD9, #8b5cf6)', padding: '40px 48px 32px', color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              {quote.shop_logo && (
                <img src={quote.shop_logo} alt={quote.shop_name}
                  style={{ maxHeight: 60, maxWidth: 180, objectFit: 'contain', marginBottom: 12, borderRadius: 6 }} />
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
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 6 }}>{date}</p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4, textTransform: 'capitalize' }}>{quote.status}</p>
            </div>
          </div>
        </div>

        {/* Client + Validity */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, padding: '28px 48px', borderBottom: '1px solid #f0f0f0' }}>
          <div>
            <p style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Prepared for</p>
            <p style={{ fontSize: 16, fontWeight: 700 }}>{quote.customer_name}</p>
            {quote.customer_company && <p style={{ fontSize: 13, color: '#555', marginTop: 2 }}>{quote.customer_company}</p>}
            {quote.customer_email && <p style={{ fontSize: 13, color: '#555', marginTop: 2 }}>{quote.customer_email}</p>}
            {quote.customer_phone && <p style={{ fontSize: 13, color: '#555' }}>{quote.customer_phone}</p>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Valid Until</p>
            <p style={{ fontSize: 16, fontWeight: 700 }}>{quote.valid_until}</p>
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
                    textAlign: hi === 0 ? 'left' : 'center',
                    fontSize: 11, color: '#888', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    borderBottom: '2px solid #f0f0f0',
                    ...(hi >= 3 ? { textAlign: 'right' } : {}),
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
                          <span style={{ fontWeight: 600, color: '#111' }}>{item.name}</span>
                          {item.is_optional && (
                            <span style={{ marginLeft: 6, fontSize: 10, background: '#EEF2FF', color: '#6B3FD9', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                              OPTIONAL
                            </span>
                          )}
                          {item.description && (
                            <p style={{ fontSize: 11, color: '#888', marginTop: 3, lineHeight: 1.4 }}>{item.description}</p>
                          )}
                          {item.sku && <p style={{ fontSize: 11, color: '#aaa' }}>SKU: {item.sku}</p>}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: 17, fontWeight: 800, borderTop: '2px solid #6B3FD9', marginTop: 6, color: '#6B3FD9' }}>
              <span>TOTAL</span>
              <span>{fmt(quote.total)}</span>
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

        {/* Bank Details */}
        {quote.company_bank && (
          <div style={{ margin: '0 48px 20px', padding: '16px', background: '#fafafa', border: '1px solid #eee', borderRadius: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: 8 }}>
              Payment Details
            </p>
            <p style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>{quote.company_bank}</p>
          </div>
        )}

        {/* Footer */}
        <div style={{ margin: '24px 48px 0', paddingTop: 20, borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 11, color: '#bbb' }}>Computer-generated quotation — {quote.shop_name}</p>
          <p style={{ fontSize: 11, color: '#ccc' }}>Powered by <strong style={{ color: '#6B3FD9' }}>ExiusCart</strong></p>
        </div>
      </div>
    </>
  );
}
