'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ordersApi, shopApi, channelsApi } from '@/lib/api';
import { symFor } from '@/components/providers/currency-provider';

// TheDersi's own real company info (Company Registration No. PV 00362065,
// registered office in Kinniya, Sri Lanka) and app-download QR — same
// content and same api.qrserver.com QR pattern already used in TheDersi's
// order-confirmation email footer (exiuscart-backend/app/core/email.py),
// reused here rather than inventing separate copy for the invoice.
const THEDERSI_APP_URL = 'https://thedersi.lk/app';

function PaymentMethodLabel(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const m = notes.match(/Payment:\s*(\w+)/i);
  if (!m) return null;
  const map: Record<string, string> = { cash: 'Cash', card: 'Card', bank_transfer: 'Bank Transfer', split: 'Split Payment' };
  return map[m[1].toLowerCase()] ?? m[1];
}

export default function InvoicePage() {
  const params = useParams();
  const orderId = params.id as string;
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  const [order, setOrder] = useState<any>(null);
  const [shop, setShop] = useState<any>(null);
  const [isTheDersiShop, setIsTheDersiShop] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!shopId || !orderId) return;
    Promise.all([
      ordersApi.getDetails(shopId, orderId),
      shopApi.getMyShop(),
      channelsApi.getConnections(shopId).catch(() => ({ data: [] })),
    ]).then(([orderRes, shopRes, connRes]) => {
      setOrder(orderRes.data);
      setShop(shopRes.data);
      setIsTheDersiShop((connRes.data ?? []).some((c: any) => c.channel_type === 'thedersi' && c.is_active));
      setReady(true);
    });
  }, [shopId, orderId]);

  useEffect(() => {
    if (ready) {
      setTimeout(() => window.print(), 400);
    }
  }, [ready]);

  if (!ready || !order) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#666' }}>
        Preparing invoice...
      </div>
    );
  }

  // A printed invoice is a real financial record — it must show the actual
  // charged amount (the shop's base currency), never a live-converted
  // preview that would drift over time relative to what was really paid.
  const sym = symFor(shop?.base_currency || shop?.currency || 'USD');
  const fmt = (n: number) => `${sym} ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const date = new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const paymentMethod = PaymentMethodLabel(order.notes);
  // The raw "Payment: cash" tag is already shown above as "Paid via: Cash" —
  // strip it out here so it doesn't also show up verbatim in Notes.
  const displayNotes = (order.notes || '')
    .split('|').map((s: string) => s.trim()).filter((s: string) => s && !/^Payment:/i.test(s)).join(' · ');
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(THEDERSI_APP_URL)}`;

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          @page { margin: 20mm; size: A4; }
        }
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; background: #fff; }
      `}</style>

      {/* Print button — hidden when printing */}
      <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 100 }}>
        <button onClick={() => window.print()}
          style={{ background: '#6B3FD9', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          ⬇ Download / Print PDF
        </button>
        <button onClick={() => window.close()}
          style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14 }}>
          Close
        </button>
      </div>

      <div style={{ maxWidth: 740, margin: '0 auto', padding: '40px 32px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
          <div>
            {shop?.logo_url && (
              <img src={shop.logo_url} alt={shop.name} style={{ height: 48, marginBottom: 8, objectFit: 'contain' }} />
            )}
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111' }}>{shop?.name || 'ExiusCart'}</h2>
            {shop?.address && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{shop.address}</p>}
            {shop?.phone && <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>{shop.phone}</p>}
            {shop?.email && <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>{shop.email}</p>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#6B3FD9', letterSpacing: -1 }}>INVOICE</h1>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: '#374151', fontWeight: 600 }}>{order.order_number}</p>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>Date: {date}</p>
            {paymentMethod && <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>Paid via: {paymentMethod}</p>}
            <p style={{ margin: '6px 0 0' }}>
              <span style={{
                background: order.payment_status === 'paid' ? '#dcfce7' : '#fef9c3',
                color: order.payment_status === 'paid' ? '#166534' : '#854d0e',
                padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              }}>
                {order.payment_status}
              </span>
            </p>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '2px solid #6B3FD9', marginBottom: 28 }} />

        {/* Bill To */}
        {order.customer && (
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Bill To</p>
            {order.customer.name && <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 600, color: '#111' }}>{order.customer.name}</p>}
            {order.customer.phone && <p style={{ margin: '0 0 2px', fontSize: 13, color: '#6b7280' }}>{order.customer.phone}</p>}
            {order.customer.email && <p style={{ margin: '0 0 2px', fontSize: 13, color: '#6b7280' }}>{order.customer.email}</p>}
            {order.customer.address && <p style={{ margin: '0 0 2px', fontSize: 13, color: '#6b7280' }}>{order.customer.address}</p>}
          </div>
        )}

        {/* Items table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr style={{ background: '#6B3FD9' }}>
              {['Item', 'SKU', 'Qty', 'Unit Price', 'Total'].map((h, i) => (
                <th key={h} style={{
                  padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#fff', textAlign: i >= 2 ? 'right' : 'left',
                  textTransform: 'uppercase', letterSpacing: 0.5,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.items.map((item: any, idx: number) => (
              <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fafafa' : '#fff' }}>
                <td style={{ padding: '10px 12px', fontSize: 13, color: '#111', fontWeight: 500 }}>
                  {item.product_name}
                  {item.is_bundle && <span style={{ marginLeft: 6, fontSize: 10, background: '#ede9fe', color: '#6B3FD9', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>Bundle</span>}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{item.product_sku || '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: '#111', textAlign: 'right' }}>{item.quantity}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: '#111', textAlign: 'right' }}>{fmt(item.unit_price)}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: '#111', textAlign: 'right' }}>{fmt(item.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
          <div style={{ width: 260 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>Subtotal</span>
              <span style={{ fontSize: 13, color: '#111' }}>{fmt(order.subtotal)}</span>
            </div>
            {order.discount_amount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>Discount</span>
                <span style={{ fontSize: 13, color: '#dc2626' }}>-{fmt(order.discount_amount)}</span>
              </div>
            )}
            {order.delivery_charge > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>Delivery Charge</span>
                <span style={{ fontSize: 13, color: '#111' }}>{fmt(order.delivery_charge)}</span>
              </div>
            )}
            {order.gift_wrap_fee > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>🎁 Gift Wrap</span>
                <span style={{ fontSize: 13, color: '#111' }}>{fmt(order.gift_wrap_fee)}</span>
              </div>
            )}
            {order.tax_amount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>VAT (5%)</span>
                <span style={{ fontSize: 13, color: '#111' }}>{fmt(order.tax_amount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>Total</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#6B3FD9' }}>{fmt(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {displayNotes && (
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 16px', marginBottom: 24 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Notes</p>
            <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>{displayNotes}</p>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
            Thank you for your business!
          </p>
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '10px 0 0' }}>
            Generated by <strong style={{ color: '#6b7280' }}>ExiusCart</strong> — a NexCodeNova product
          </p>
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '3px 0 0' }}>
            support@exiuscart.com · WhatsApp: +971 56 239 3573 · Sri Lanka | Dubai
          </p>
        </div>

        {/* TheDersi footer — only for TheDersi-affiliated shops, same real
            company info + app-QR already used in TheDersi's own emails */}
        {isTheDersiShop && (
          <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 20, paddingTop: 20, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px' }}>Get the TheDersi app</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
              <div style={{ textAlign: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc} alt="Scan to download the TheDersi app" width={88} height={88} style={{ display: 'block', borderRadius: 8, margin: '0 auto' }} />
                <p style={{ margin: '6px 0 0', fontSize: 10, color: '#9ca3af' }}>Scan for iOS</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc} alt="Scan to download the TheDersi app" width={88} height={88} style={{ display: 'block', borderRadius: 8, margin: '0 auto' }} />
                <p style={{ margin: '6px 0 0', fontSize: 10, color: '#9ca3af' }}>Scan for Android</p>
              </div>
            </div>
            <p style={{ margin: '14px 0 0', fontSize: 10, lineHeight: 1.6, color: '#9ca3af' }}>
              TheDersi is a marketplace operated by Fairam Private Limited, a company incorporated under the laws of Sri Lanka
              (Company Registration No. PV 00362065).<br />
              Registered office: No. 83/B, Arafa School Road, Kurinchakerny-03, Kinniya 31100, Sri Lanka.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
