'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { quotationsApi } from '@/lib/api';

interface QuotationItem {
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

export default function QuotationPrintPage() {
  const { id } = useParams() as { id: string };
  const [quote, setQuote] = useState<Quotation | null>(null);

  useEffect(() => {
    const shopId = localStorage.getItem('shop_id') ?? '';
    quotationsApi.get(shopId, parseInt(id)).then(r => {
      setQuote(r.data);
      setTimeout(() => window.print(), 600);
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

      {/* Print button — hidden when printing */}
      <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, zIndex: 99 }}>
        <button onClick={() => window.print()}
          style={{ background: '#6B3FD9', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Download / Print PDF
        </button>
      </div>

      <div style={{ maxWidth: 794, margin: '0 auto', padding: '0 0 40px' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #6B3FD9, #8b5cf6)', padding: '40px 48px 32px', color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              {quote.shop_logo && (
                <img src={quote.shop_logo} alt={quote.shop_name}
                  style={{ maxHeight: 60, maxWidth: 180, objectFit: 'contain', marginBottom: 12, borderRadius: 6 }} />
              )}
              <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{quote.shop_name}</h1>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 4 }}>Price Quotation</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quotation</p>
              <p style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', marginTop: 4 }}>{quote.quote_number}</p>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 6 }}>{date}</p>
            </div>
          </div>
        </div>

        {/* Customer & Validity */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, padding: '28px 48px', borderBottom: '1px solid #f0f0f0' }}>
          <div>
            <p style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Prepared for</p>
            <p style={{ fontSize: 16, fontWeight: 600 }}>{quote.customer_name}</p>
            {quote.customer_email && <p style={{ fontSize: 13, color: '#555', marginTop: 3 }}>{quote.customer_email}</p>}
            {quote.customer_phone && <p style={{ fontSize: 13, color: '#555' }}>{quote.customer_phone}</p>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Valid Until</p>
            <p style={{ fontSize: 16, fontWeight: 600 }}>{quote.valid_until}</p>
            <p style={{ fontSize: 13, color: '#888', marginTop: 4, textTransform: 'capitalize' }}>Status: {quote.status}</p>
          </div>
        </div>

        {/* Items */}
        <div style={{ padding: '24px 48px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                {['Product', 'SKU', 'Stock', 'Qty', 'Unit Price', 'Total'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Product' || h === 'SKU' ? 'left' : 'center', fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #f0f0f0' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                  <td style={{ padding: '12px 12px', fontWeight: 500 }}>{item.name}</td>
                  <td style={{ padding: '12px 12px', color: '#888', fontSize: 12 }}>{item.sku ?? '—'}</td>
                  <td style={{ padding: '12px 12px', textAlign: 'center', color: (item.quantity_available ?? 0) > 0 ? '#16a34a' : '#ef4444', fontWeight: 600, fontSize: 12 }}>
                    {item.quantity_available ?? '—'}
                  </td>
                  <td style={{ padding: '12px 12px', textAlign: 'center' }}>{item.qty}</td>
                  <td style={{ padding: '12px 12px', textAlign: 'center', color: '#555' }}>{fmt(item.unit_price)}</td>
                  <td style={{ padding: '12px 12px', textAlign: 'center', fontWeight: 600 }}>{fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ padding: '0 48px 24px', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: 240 }}>
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
                <span>Tax</span><span>+{fmt(quote.tax)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 16, fontWeight: 700, borderTop: '2px solid #f0f0f0', marginTop: 4 }}>
              <span>Total</span>
              <span style={{ color: '#6B3FD9' }}>{fmt(quote.total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div style={{ margin: '0 48px 24px', padding: '12px 16px', background: '#f9f9f9', borderLeft: '4px solid #6B3FD9', borderRadius: '0 8px 8px 0', fontSize: 13, color: '#555' }}>
            <strong style={{ color: '#333' }}>Note:</strong> {quote.notes}
          </div>
        )}

        {/* Footer */}
        <div style={{ margin: '0 48px', paddingTop: 24, borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#aaa' }}>This is a computer-generated quotation from {quote.shop_name}.</p>
          <p style={{ fontSize: 11, color: '#ccc', marginTop: 4 }}>Powered by <strong style={{ color: '#6B3FD9' }}>ExiusCart</strong></p>
        </div>
      </div>
    </>
  );
}
