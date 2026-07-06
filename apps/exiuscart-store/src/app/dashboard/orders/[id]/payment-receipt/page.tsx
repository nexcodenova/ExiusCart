'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ordersApi, shopApi } from '@/lib/api';

export default function PaymentReceiptPage() {
  const params = useParams();
  const orderId = params.id as string;
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  const [order, setOrder] = useState<any>(null);
  const [shop, setShop] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!shopId || !orderId) return;
    Promise.all([
      ordersApi.getDetails(shopId, orderId),
      shopApi.getMyShop(),
    ]).then(([orderRes, shopRes]) => {
      setOrder(orderRes.data);
      setShop(shopRes.data);
      setReady(true);
    });
  }, [shopId, orderId]);

  useEffect(() => {
    if (ready) setTimeout(() => window.print(), 400);
  }, [ready]);

  if (!ready || !order) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#666' }}>
        Preparing payment receipt...
      </div>
    );
  }

  const sym = localStorage.getItem('currency_symbol') || 'AED';
  const fmt = (n: number) => `${sym} ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const dateStr = new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = new Date(order.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const paymentMethod = (() => {
    if (order.payment_method === 'cod') return 'Cash on Delivery';
    if (order.payment_method === 'bank_transfer') return 'Bank Transfer';
    if (order.payment_method === 'card') return 'Card';
    if (order.payment_method === 'online') return 'Online Payment';
    return order.payment_method ? order.payment_method.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : 'Cash';
  })();

  const isPaid = order.payment_status === 'paid';
  const customer = order.customer;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; background: #fff; }

        @media print {
          @page { margin: 10mm; size: A5 portrait; }
          body * { visibility: hidden !important; }
          #payment-receipt, #payment-receipt * { visibility: visible !important; }
          #payment-receipt {
            position: fixed !important;
            top: 0; left: 0;
            width: 100% !important;
            padding: 0 !important;
          }
          .no-print { display: none !important; }
        }

        .no-print {
          position: fixed; top: 16px; right: 16px;
          display: flex; gap: 8px; z-index: 9999;
        }

        #payment-receipt {
          max-width: 500px;
          margin: 0 auto;
          padding: 28px 24px;
          background: #fff;
        }

        /* Header */
        .rct-header { text-align: center; margin-bottom: 20px; }
        .rct-logo { height: 44px; object-fit: contain; margin-bottom: 8px; }
        .rct-shop-name { font-size: 18px; font-weight: 800; color: #111; margin-bottom: 2px; }
        .rct-shop-sub { font-size: 11px; color: #6b7280; }

        /* Status stamp */
        .rct-stamp-wrap { text-align: center; margin: 16px 0 20px; }
        .rct-stamp {
          display: inline-block;
          border: 3px solid #16a34a;
          border-radius: 6px;
          padding: 6px 22px;
          font-size: 22px;
          font-weight: 900;
          color: #16a34a;
          letter-spacing: 3px;
          text-transform: uppercase;
          transform: rotate(-3deg);
        }
        .rct-stamp.pending {
          border-color: #d97706;
          color: #d97706;
        }

        /* Amount hero */
        .rct-amount-wrap { text-align: center; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
        .rct-amount-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #166534; margin-bottom: 4px; }
        .rct-amount { font-size: 34px; font-weight: 900; color: #15803d; line-height: 1; }
        .rct-amount.pending-amount { color: #d97706; }
        .rct-amount-wrap.pending-wrap { background: #fffbeb; border-color: #fde68a; }

        /* Divider */
        hr.rct-divider { border: none; border-top: 1.5px dashed #e5e7eb; margin: 16px 0; }

        /* Details rows */
        .rct-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 6px 0; font-size: 12px; border-bottom: 1px solid #f9fafb; }
        .rct-row:last-child { border-bottom: none; }
        .rct-row .lbl { color: #6b7280; font-weight: 500; }
        .rct-row .val { font-weight: 700; color: #111; text-align: right; max-width: 60%; }

        /* Items mini-table */
        .rct-items { margin-top: 8px; }
        .rct-sec-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 6px; }
        .rct-item-row { display: flex; justify-content: space-between; font-size: 11px; padding: 3px 0; color: #374151; }
        .rct-item-name { flex: 1; }
        .rct-item-qty { color: #6b7280; margin: 0 8px; }
        .rct-item-total { font-weight: 700; }

        /* Footer */
        .rct-footer { margin-top: 20px; text-align: center; }
        .rct-footer-thanks { font-size: 14px; font-weight: 700; color: #374151; margin-bottom: 4px; }
        .rct-footer-sub { font-size: 10px; color: #9ca3af; line-height: 1.6; }
        .rct-powered { font-size: 9px; color: #c4b5fd; margin-top: 8px; }

        /* Receipt number */
        .rct-num { text-align: center; font-size: 11px; color: #9ca3af; letter-spacing: 1px; margin-bottom: 12px; font-family: monospace; }
      `}</style>

      {/* Toolbar */}
      <div className="no-print">
        <button onClick={() => window.print()}
          style={{ background: '#15803d', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          🖨 Print Receipt
        </button>
        <button onClick={() => window.close()}
          style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14 }}>
          Close
        </button>
      </div>

      <div id="payment-receipt">

        {/* Shop Header */}
        <div className="rct-header">
          {shop?.logo_url && <img src={shop.logo_url} alt={shop.name} className="rct-logo" />}
          <div className="rct-shop-name">{shop?.name || 'ExiusCart'}</div>
          {(shop?.phone || shop?.email) && (
            <div className="rct-shop-sub">
              {[shop.phone, shop.email].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>

        {/* Receipt number */}
        <div className="rct-num">RECEIPT #{order.order_number}</div>

        {/* Paid stamp */}
        <div className="rct-stamp-wrap">
          <div className={`rct-stamp ${!isPaid ? 'pending' : ''}`}>
            {isPaid ? 'Payment Received' : 'Pending Payment'}
          </div>
        </div>

        {/* Amount hero */}
        <div className={`rct-amount-wrap ${!isPaid ? 'pending-wrap' : ''}`}>
          <div className="rct-amount-label">{isPaid ? 'Amount Received' : 'Amount Due'}</div>
          <div className={`rct-amount ${!isPaid ? 'pending-amount' : ''}`}>{fmt(order.total)}</div>
        </div>

        {/* Details */}
        <div>
          <div className="rct-row">
            <span className="lbl">Received From</span>
            <span className="val">{customer?.name || 'Customer'}</span>
          </div>
          {customer?.phone && (
            <div className="rct-row">
              <span className="lbl">Phone</span>
              <span className="val">{customer.phone}</span>
            </div>
          )}
          {customer?.email && (
            <div className="rct-row">
              <span className="lbl">Email</span>
              <span className="val">{customer.email}</span>
            </div>
          )}
          <div className="rct-row">
            <span className="lbl">Order Number</span>
            <span className="val" style={{ fontFamily: 'monospace' }}>{order.order_number}</span>
          </div>
          <div className="rct-row">
            <span className="lbl">Date</span>
            <span className="val">{dateStr}</span>
          </div>
          <div className="rct-row">
            <span className="lbl">Time</span>
            <span className="val">{timeStr}</span>
          </div>
          <div className="rct-row">
            <span className="lbl">Payment Method</span>
            <span className="val">{paymentMethod}</span>
          </div>
          <div className="rct-row">
            <span className="lbl">Payment Status</span>
            <span className="val" style={{ color: isPaid ? '#16a34a' : '#d97706' }}>
              {isPaid ? 'Paid' : 'Pending'}
            </span>
          </div>
        </div>

        <hr className="rct-divider" />

        {/* Items */}
        <div className="rct-items">
          <div className="rct-sec-label">Items Purchased</div>
          {order.items.map((item: any, idx: number) => (
            <div key={item.id ?? idx} className="rct-item-row">
              <span className="rct-item-name">{item.product_name}</span>
              <span className="rct-item-qty">×{item.quantity}</span>
              <span className="rct-item-total">{fmt(item.total_price)}</span>
            </div>
          ))}
        </div>

        <hr className="rct-divider" />

        {/* Totals */}
        <div>
          {order.discount_amount > 0 && (
            <div className="rct-row">
              <span className="lbl">Subtotal</span>
              <span className="val">{fmt(order.subtotal)}</span>
            </div>
          )}
          {order.discount_amount > 0 && (
            <div className="rct-row">
              <span className="lbl">Discount</span>
              <span className="val" style={{ color: '#dc2626' }}>-{fmt(order.discount_amount)}</span>
            </div>
          )}
          {order.delivery_charge > 0 && (
            <div className="rct-row">
              <span className="lbl">Delivery</span>
              <span className="val">{fmt(order.delivery_charge)}</span>
            </div>
          )}
          {order.tax_amount > 0 && (
            <div className="rct-row">
              <span className="lbl">VAT (5%)</span>
              <span className="val">{fmt(order.tax_amount)}</span>
            </div>
          )}
          <div className="rct-row" style={{ borderTop: '1.5px solid #e5e7eb', marginTop: 4, paddingTop: 8 }}>
            <span className="lbl" style={{ fontWeight: 800, color: '#111', fontSize: 13 }}>Total Paid</span>
            <span className="val" style={{ fontSize: 15, color: isPaid ? '#15803d' : '#d97706' }}>{fmt(order.total)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="rct-footer">
          <div className="rct-footer-thanks">Thank you for your purchase!</div>
          {shop?.address && <div className="rct-footer-sub">{shop.address}</div>}
          {shop?.email && <div className="rct-footer-sub">{shop.email}</div>}
          <div className="rct-powered">Powered by ExiusCart</div>
        </div>

      </div>
    </>
  );
}
