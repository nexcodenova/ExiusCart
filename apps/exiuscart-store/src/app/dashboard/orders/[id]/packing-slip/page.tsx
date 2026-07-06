'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ordersApi, shopApi } from '@/lib/api';

export default function PackingSlipPage() {
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
        Preparing packing slip...
      </div>
    );
  }

  const sym = localStorage.getItem('currency_symbol') || 'LKR';
  const fmt = (n: number) => `${sym} ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const date = new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const isTheDersi = order.source === 'thedersi' || order.channel_meta?.channel_type === 'thedersi';
  const customer = order.customer;
  const deliveryAddress = order.shipping_address || customer?.address || null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Barcode+128+Text&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; background: #fff; }

        /* ── Print: hide EVERYTHING except the slip ── */
        @media print {
          @page { margin: 8mm; size: A4 portrait; }
          body * { visibility: hidden !important; }
          #packing-slip, #packing-slip * { visibility: visible !important; }
          #packing-slip {
            position: fixed !important;
            top: 0; left: 0;
            width: 100% !important;
            padding: 0 !important;
          }
          .no-print { display: none !important; }
        }

        /* ── Screen toolbar ── */
        .no-print {
          position: fixed; top: 16px; right: 16px;
          display: flex; gap: 8px; z-index: 9999;
        }

        /* ── Slip wrapper ── */
        #packing-slip {
          max-width: 760px;
          margin: 0 auto;
          padding: 28px 24px;
          background: #fff;
        }

        /* ── Header ── */
        .slip-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .brand { display: flex; align-items: center; gap: 10px; }
        .brand img { height: 36px; object-fit: contain; }
        .brand-name { font-size: 17px; font-weight: 800; color: #111; }
        .brand-sub  { font-size: 10px; color: #6b7280; margin-top: 1px; }
        .slip-right { text-align: right; }
        .slip-right h1 { font-size: 22px; font-weight: 900; color: #6B3FD9; letter-spacing: -0.5px; }
        .slip-right .onum { font-size: 12px; font-weight: 700; color: #374151; margin-top: 3px; }
        .slip-right .odate { font-size: 11px; color: #6b7280; margin-top: 1px; }
        .badges { display: flex; gap: 5px; justify-content: flex-end; margin-top: 5px; }
        .badge { font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
        .b-paid    { background: #dcfce7; color: #166534; }
        .b-cod     { background: #fef9c3; color: #854d0e; }
        .b-channel { background: #ede9fe; color: #5b21b6; }
        .b-gift    { background: #fce7f3; color: #9d174d; }

        hr.divider { border: none; border-top: 2px solid #6B3FD9; margin: 10px 0; }

        /* ── Address ── */
        .addr-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
        .addr-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; background: #f9fafb; }
        .addr-box.shipto { border: 2px solid #6B3FD9; background: #faf5ff; }
        .addr-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 5px; }
        .shipto .addr-label { color: #6B3FD9; }
        .addr-name { font-size: 14px; font-weight: 800; color: #111; margin-bottom: 2px; }
        .addr-line { font-size: 11px; color: #374151; line-height: 1.5; }
        .addr-muted { font-size: 11px; color: #6b7280; line-height: 1.5; }

        /* ── Items table ── */
        .sec-title { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        thead tr { background: #6B3FD9; }
        thead th { padding: 7px 10px; font-size: 10px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 0.4px; text-align: left; }
        thead th.r { text-align: right; }
        tbody tr:nth-child(even) { background: #f9fafb; }
        tbody td { padding: 7px 10px; color: #111; vertical-align: top; border-bottom: 1px solid #f3f4f6; }
        tbody td.sku { font-family: monospace; font-size: 10px; color: #6b7280; }
        tbody td.qty { font-size: 13px; font-weight: 800; color: #6B3FD9; text-align: center; }
        tbody td.r { text-align: right; }
        .bundle-tag { font-size: 8px; background: #ede9fe; color: #6B3FD9; padding: 1px 4px; border-radius: 3px; font-weight: 700; margin-left: 3px; }
        .comp-line { font-size: 10px; color: #6b7280; margin-top: 2px; padding-left: 6px; border-left: 2px solid #e5e7eb; }
        .variant-tag { font-size: 9px; background: #f3f4f6; padding: 1px 5px; border-radius: 3px; color: #374151; margin-right: 3px; margin-top: 2px; display: inline-block; }

        /* ── Summary ── */
        .summary-wrap { display: flex; justify-content: flex-end; margin-top: 10px; }
        .summary-box { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; min-width: 210px; }
        .sum-row { display: flex; justify-content: space-between; padding: 5px 12px; font-size: 11px; border-bottom: 1px solid #f3f4f6; }
        .sum-row .lbl { color: #6b7280; }
        .sum-row .val { font-weight: 600; color: #111; }
        .sum-total { display: flex; justify-content: space-between; padding: 8px 12px; background: #6B3FD9; }
        .sum-total .lbl { color: #ede9fe; font-weight: 700; font-size: 12px; }
        .sum-total .val { color: #fff; font-weight: 800; font-size: 14px; }

        /* ── Special boxes ── */
        .gift-box { background: #fce7f3; border: 1px solid #f9a8d4; border-radius: 8px; padding: 8px 12px; margin-top: 10px; font-size: 11px; }
        .gift-title { font-weight: 800; color: #9d174d; margin-bottom: 4px; }
        .gift-msg { font-style: italic; margin-top: 4px; padding: 6px 10px; background: #fff; border-radius: 6px; border: 1px solid #f9a8d4; }

        .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; margin-top: 8px; font-size: 11px; }
        .notes-lbl { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #92400e; margin-bottom: 3px; }

        .tracking-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 8px 12px; margin-top: 8px; font-size: 11px; }
        .tracking-lbl { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #166534; margin-bottom: 3px; }

        /* ── Barcode ── */
        .barcode-section { margin-top: 14px; padding-top: 10px; border-top: 1px dashed #d1d5db; text-align: center; }
        .barcode-font { font-family: 'Libre Barcode 128 Text', cursive; font-size: 44px; line-height: 1; color: #111; letter-spacing: 1px; }
        .barcode-text { font-size: 10px; color: #6b7280; letter-spacing: 2px; margin-top: 1px; font-weight: 600; }

        /* ── Footer ── */
        .slip-footer { margin-top: 12px; padding-top: 10px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; }
        .slip-footer-left { color: #6b7280; line-height: 1.6; }
        .slip-footer-right { color: #9ca3af; text-align: right; }
      `}</style>

      {/* Toolbar — hidden when printing */}
      <div className="no-print">
        <button onClick={() => window.print()}
          style={{ background: '#6B3FD9', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          🖨 Print Packing Slip
        </button>
        <button onClick={() => window.close()}
          style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14 }}>
          Close
        </button>
      </div>

      {/* ── PACKING SLIP ── */}
      <div id="packing-slip">

        {/* Header */}
        <div className="slip-header">
          <div className="brand">
            {shop?.logo_url && <img src={shop.logo_url} alt={shop.name} />}
            <div>
              <div className="brand-name">{shop?.name || 'ExiusCart'}</div>
              {shop?.phone && <div className="brand-sub">{shop.phone}</div>}
            </div>
          </div>
          <div className="slip-right">
            <h1>PACKING SLIP</h1>
            <div className="onum">{order.order_number}</div>
            <div className="odate">Date: {date}</div>
            <div className="badges">
              {order.payment_status === 'paid'
                ? <span className="badge b-paid">Paid</span>
                : <span className="badge b-cod">COD</span>}
              {isTheDersi && <span className="badge b-channel">TheDersi</span>}
              {order.gift_wrap && <span className="badge b-gift">🎁 Gift</span>}
            </div>
          </div>
        </div>

        <hr className="divider" />

        {/* Addresses */}
        <div className="addr-row">
          <div className="addr-box">
            <div className="addr-label">From</div>
            <div className="addr-name">{shop?.name || 'Seller'}</div>
            {shop?.address && <div className="addr-muted">{shop.address}</div>}
            {shop?.phone && <div className="addr-muted">{shop.phone}</div>}
            {shop?.email && <div className="addr-muted">{shop.email}</div>}
          </div>
          <div className="addr-box shipto">
            <div className="addr-label">Ship To</div>
            <div className="addr-name">{customer?.name || 'Customer'}</div>
            {customer?.phone && <div className="addr-line">{customer.phone}</div>}
            {customer?.email && <div className="addr-muted">{customer.email}</div>}
            {deliveryAddress && <div className="addr-line" style={{ marginTop: 3 }}>{deliveryAddress}</div>}
          </div>
        </div>

        {/* Items */}
        <div className="sec-title">Items to Pack — {order.items.length} line{order.items.length !== 1 ? 's' : ''}</div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '44%' }}>Item</th>
              <th style={{ width: '16%' }}>SKU</th>
              <th style={{ width: '8%', textAlign: 'center' }}>Qty</th>
              <th className="r" style={{ width: '16%' }}>Unit Price</th>
              <th className="r" style={{ width: '16%' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item: any, idx: number) => {
              const detail = order.channel_meta?.items_detail?.find((d: any) => d.product_id === item.product_id);
              return (
                <tr key={item.id ?? idx}>
                  <td>
                    {item.product_name}
                    {item.is_bundle && <span className="bundle-tag">Bundle</span>}
                    {detail && (detail.size || detail.color) && (
                      <div style={{ marginTop: 3 }}>
                        {detail.size  && <span className="variant-tag">Size: {detail.size}</span>}
                        {detail.color && <span className="variant-tag">Color: {detail.color}</span>}
                      </div>
                    )}
                    {item.is_bundle && item.bundle_components?.map((c: any, ci: number) => (
                      <div key={ci} className="comp-line">
                        {c.product_name}{c.variant_size ? ` · ${c.variant_size}` : ''}{c.variant_color ? ` · ${c.variant_color}` : ''} ×{c.total_qty}
                      </div>
                    ))}
                  </td>
                  <td className="sku">{item.product_sku || '—'}</td>
                  <td className="qty">{item.quantity}</td>
                  <td className="r">{fmt(item.unit_price)}</td>
                  <td className="r" style={{ fontWeight: 700 }}>{fmt(item.total_price)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Summary */}
        <div className="summary-wrap">
          <div className="summary-box">
            {order.discount_amount > 0 && (
              <div className="sum-row"><span className="lbl">Subtotal</span><span className="val">{fmt(order.subtotal)}</span></div>
            )}
            {order.discount_amount > 0 && (
              <div className="sum-row"><span className="lbl">Discount</span><span className="val" style={{ color: '#dc2626' }}>-{fmt(order.discount_amount)}</span></div>
            )}
            {order.delivery_charge > 0 && (
              <div className="sum-row"><span className="lbl">Delivery</span><span className="val">{fmt(order.delivery_charge)}</span></div>
            )}
            {order.gift_wrap_fee > 0 && (
              <div className="sum-row"><span className="lbl">🎁 Gift Wrap</span><span className="val">{fmt(order.gift_wrap_fee)}</span></div>
            )}
            {order.tax_amount > 0 && (
              <div className="sum-row"><span className="lbl">VAT (5%)</span><span className="val">{fmt(order.tax_amount)}</span></div>
            )}
            <div className="sum-total">
              <span className="lbl">Order Total</span>
              <span className="val">{fmt(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Gift wrap */}
        {order.gift_wrap && (
          <div className="gift-box">
            <div className="gift-title">🎁 Gift Order — Please wrap this parcel as a gift</div>
            {order.gift_message && (
              <div className="gift-msg">
                <span style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Gift Message to include:</span>
                &ldquo;{order.gift_message}&rdquo;
              </div>
            )}
          </div>
        )}

        {/* Tracking */}
        {(order.tracking_number || order.carrier || order.estimated_delivery) && (
          <div className="tracking-box">
            <div className="tracking-lbl">Shipping Info</div>
            {order.carrier && <span>Carrier: <strong>{order.carrier}</strong>&nbsp;&nbsp;</span>}
            {order.tracking_number && <span>Tracking: <strong style={{ fontFamily: 'monospace' }}>{order.tracking_number}</strong>&nbsp;&nbsp;</span>}
            {order.estimated_delivery && <span>Est. Delivery: <strong>{order.estimated_delivery}</strong></span>}
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="notes-box">
            <div className="notes-lbl">⚠ Special Instructions</div>
            <div>{order.notes}</div>
          </div>
        )}

        {/* Barcode */}
        <div className="barcode-section">
          <div className="barcode-font">{order.order_number}</div>
          <div className="barcode-text">{order.order_number}</div>
        </div>

        {/* Footer */}
        <div className="slip-footer">
          <div className="slip-footer-left">
            <strong>To return:</strong> Contact {shop?.email || shop?.phone || 'our support'} with your order number.
          </div>
          <div className="slip-footer-right">
            Thank you for your order!<br />
            <span style={{ color: '#c4b5fd' }}>Powered by ExiusCart</span>
          </div>
        </div>

      </div>
    </>
  );
}
