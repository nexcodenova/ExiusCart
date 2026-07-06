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
  const date = new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const isTheDersi = order.source === 'thedersi' || order.channel_meta?.channel_type === 'thedersi';
  const customer = order.customer;
  const deliveryAddress = order.shipping_address || customer?.address || null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Barcode+128+Text&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; background: #fff; }

        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          @page { margin: 15mm; size: A4; }
        }

        .page { max-width: 760px; margin: 0 auto; padding: 32px 28px; }

        /* ── Header ── */
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
        .shop-brand { display: flex; align-items: center; gap: 12px; }
        .shop-brand img { height: 44px; object-fit: contain; }
        .shop-name { font-size: 20px; font-weight: 800; color: #111; }
        .shop-sub  { font-size: 11px; color: #6b7280; margin-top: 2px; }
        .slip-title { text-align: right; }
        .slip-title h1 { font-size: 26px; font-weight: 900; color: #6B3FD9; letter-spacing: -0.5px; }
        .slip-title .order-num { font-size: 13px; color: #374151; font-weight: 700; margin-top: 4px; }
        .slip-title .order-date { font-size: 12px; color: #6b7280; margin-top: 2px; }

        /* ── Status badges ── */
        .badges { display: flex; gap: 6px; justify-content: flex-end; margin-top: 6px; }
        .badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
        .badge-paid    { background: #dcfce7; color: #166534; }
        .badge-cod     { background: #fef9c3; color: #854d0e; }
        .badge-channel { background: #ede9fe; color: #5b21b6; }
        .badge-gift    { background: #fce7f3; color: #9d174d; }

        /* ── Divider ── */
        .divider { border: none; border-top: 2px solid #6B3FD9; margin: 18px 0; }
        .divider-light { border: none; border-top: 1px solid #e5e7eb; margin: 14px 0; }

        /* ── Address block ── */
        .address-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 20px; }
        .address-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; }
        .address-box.ship-to { border: 2px solid #6B3FD9; background: #faf5ff; }
        .addr-label { font-size: 10px; font-weight: 800; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .ship-to .addr-label { color: #6B3FD9; }
        .addr-name { font-size: 16px; font-weight: 800; color: #111; margin-bottom: 4px; }
        .addr-line { font-size: 12px; color: #374151; line-height: 1.6; }
        .addr-line-muted { font-size: 12px; color: #6b7280; line-height: 1.6; }

        /* ── Items table ── */
        .section-title { font-size: 11px; font-weight: 800; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; }
        thead tr { background: #6B3FD9; }
        thead th { padding: 9px 12px; font-size: 11px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
        thead th.right { text-align: right; }
        tbody tr:nth-child(even) { background: #f9fafb; }
        tbody tr:nth-child(odd)  { background: #fff; }
        tbody td { padding: 10px 12px; font-size: 13px; color: #111; vertical-align: top; border-bottom: 1px solid #f3f4f6; }
        tbody td.right { text-align: right; }
        tbody td.sku { font-family: monospace; font-size: 11px; color: #6b7280; }
        tbody td.qty { font-size: 14px; font-weight: 800; color: #6B3FD9; text-align: center; }
        .bundle-tag { font-size: 9px; background: #ede9fe; color: #6B3FD9; padding: 1px 5px; border-radius: 4px; font-weight: 700; margin-left: 4px; }
        .component-line { font-size: 11px; color: #6b7280; margin-top: 3px; padding-left: 8px; border-left: 2px solid #e5e7eb; }

        /* ── Summary strip ── */
        .summary-strip { display: flex; justify-content: flex-end; margin-top: 14px; }
        .summary-box { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; min-width: 240px; }
        .summary-row { display: flex; justify-content: space-between; padding: 7px 14px; font-size: 13px; border-bottom: 1px solid #f3f4f6; }
        .summary-row:last-child { border: none; }
        .summary-row .label { color: #6b7280; }
        .summary-row .value { font-weight: 600; color: #111; }
        .summary-total { display: flex; justify-content: space-between; padding: 10px 14px; background: #6B3FD9; }
        .summary-total .label { color: #ede9fe; font-weight: 700; font-size: 14px; }
        .summary-total .value { color: #fff; font-weight: 800; font-size: 16px; }

        /* ── Gift wrap ── */
        .gift-box { background: #fce7f3; border: 1px solid #f9a8d4; border-radius: 10px; padding: 12px 16px; margin-top: 14px; }
        .gift-box .gift-title { font-size: 13px; font-weight: 800; color: #9d174d; margin-bottom: 6px; }
        .gift-msg { font-size: 13px; color: #374151; font-style: italic; margin-top: 6px; padding: 8px 12px; background: #fff; border-radius: 8px; border: 1px solid #f9a8d4; }

        /* ── Special instructions ── */
        .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 12px 16px; margin-top: 14px; }
        .notes-box .notes-label { font-size: 10px; font-weight: 800; color: #92400e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
        .notes-box p { font-size: 13px; color: #374151; }

        /* ── Shipping info ── */
        .tracking-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px 16px; margin-top: 14px; }
        .tracking-box .tracking-label { font-size: 10px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
        .tracking-box p { font-size: 13px; color: #374151; }

        /* ── Barcode ── */
        .barcode-section { margin-top: 20px; padding-top: 16px; border-top: 1px dashed #d1d5db; display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .barcode-font { font-family: 'Libre Barcode 128 Text', cursive; font-size: 52px; line-height: 1; color: #111; letter-spacing: 2px; }
        .barcode-text { font-size: 11px; color: #6b7280; letter-spacing: 2px; margin-top: 2px; font-weight: 600; }

        /* ── Footer ── */
        .footer { margin-top: 20px; padding-top: 14px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
        .footer-left { font-size: 11px; color: #6b7280; line-height: 1.6; }
        .footer-right { font-size: 11px; color: #9ca3af; text-align: right; }
      `}</style>

      {/* No-print toolbar */}
      <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 100 }}>
        <button onClick={() => window.print()}
          style={{ background: '#6B3FD9', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          🖨 Print Packing Slip
        </button>
        <button onClick={() => window.close()}
          style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14 }}>
          Close
        </button>
      </div>

      <div className="page">

        {/* ── Header ── */}
        <div className="header">
          <div className="shop-brand">
            {shop?.logo_url && <img src={shop.logo_url} alt={shop.name} />}
            <div>
              <div className="shop-name">{shop?.name || 'ExiusCart'}</div>
              {shop?.phone && <div className="shop-sub">{shop.phone}</div>}
            </div>
          </div>
          <div className="slip-title">
            <h1>PACKING SLIP</h1>
            <div className="order-num">{order.order_number}</div>
            <div className="order-date">Date: {date}</div>
            <div className="badges">
              {order.payment_status === 'paid'
                ? <span className="badge badge-paid">Paid</span>
                : <span className="badge badge-cod">COD</span>}
              {isTheDersi && <span className="badge badge-channel">TheDersi</span>}
              {order.gift_wrap && <span className="badge badge-gift">🎁 Gift</span>}
            </div>
          </div>
        </div>

        <hr className="divider" />

        {/* ── Address block ── */}
        <div className="address-row">
          {/* FROM */}
          <div className="address-box">
            <div className="addr-label">From</div>
            <div className="addr-name">{shop?.name || 'Seller'}</div>
            {shop?.address && <div className="addr-line-muted">{shop.address}</div>}
            {shop?.phone && <div className="addr-line-muted">{shop.phone}</div>}
            {shop?.email && <div className="addr-line-muted">{shop.email}</div>}
          </div>

          {/* SHIP TO */}
          <div className="address-box ship-to">
            <div className="addr-label">Ship To</div>
            {customer?.name
              ? <div className="addr-name">{customer.name}</div>
              : <div className="addr-name">Customer</div>}
            {customer?.phone && <div className="addr-line">{customer.phone}</div>}
            {customer?.email && <div className="addr-line-muted">{customer.email}</div>}
            {deliveryAddress && <div className="addr-line" style={{ marginTop: 4 }}>{deliveryAddress}</div>}
            {!customer?.name && !customer?.phone && !deliveryAddress && (
              <div className="addr-line-muted">No delivery address on file</div>
            )}
          </div>
        </div>

        {/* ── Items ── */}
        <div className="section-title">Items to Pack — {order.items.length} line{order.items.length !== 1 ? 's' : ''}</div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '44%' }}>Item</th>
              <th style={{ width: '18%' }}>SKU</th>
              <th style={{ width: '10%', textAlign: 'center' }}>Qty</th>
              <th className="right" style={{ width: '14%' }}>Unit Price</th>
              <th className="right" style={{ width: '14%' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item: any, idx: number) => (
              <tr key={item.id ?? idx}>
                <td>
                  {item.product_name}
                  {item.is_bundle && <span className="bundle-tag">Bundle</span>}
                  {item.is_bundle && item.bundle_components?.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      {item.bundle_components.map((c: any, ci: number) => (
                        <div key={ci} className="component-line">
                          {c.product_name}
                          {c.variant_size ? ` · ${c.variant_size}` : ''}
                          {c.variant_color ? ` · ${c.variant_color}` : ''}
                          {' '}×{c.total_qty}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* TheDersi size/color variants */}
                  {(() => {
                    const detail = order.channel_meta?.items_detail?.find((d: any) => d.product_id === item.product_id);
                    if (!detail) return null;
                    return (
                      <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
                        {detail.size  && <span style={{ fontSize: 10, background: '#f3f4f6', padding: '1px 6px', borderRadius: 4, color: '#374151' }}>Size: {detail.size}</span>}
                        {detail.color && <span style={{ fontSize: 10, background: '#f3f4f6', padding: '1px 6px', borderRadius: 4, color: '#374151' }}>Color: {detail.color}</span>}
                      </div>
                    );
                  })()}
                </td>
                <td className="sku">{item.product_sku || '—'}</td>
                <td className="qty">{item.quantity}</td>
                <td className="right">{fmt(item.unit_price)}</td>
                <td className="right" style={{ fontWeight: 700 }}>{fmt(item.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Order summary ── */}
        <div className="summary-strip">
          <div className="summary-box">
            {order.discount_amount > 0 && (
              <div className="summary-row">
                <span className="label">Subtotal</span>
                <span className="value">{fmt(order.subtotal)}</span>
              </div>
            )}
            {order.discount_amount > 0 && (
              <div className="summary-row">
                <span className="label">Discount</span>
                <span className="value" style={{ color: '#dc2626' }}>-{fmt(order.discount_amount)}</span>
              </div>
            )}
            {order.delivery_charge > 0 && (
              <div className="summary-row">
                <span className="label">Delivery Charge</span>
                <span className="value">{fmt(order.delivery_charge)}</span>
              </div>
            )}
            {order.gift_wrap_fee > 0 && (
              <div className="summary-row">
                <span className="label">🎁 Gift Wrap</span>
                <span className="value">{fmt(order.gift_wrap_fee)}</span>
              </div>
            )}
            {order.tax_amount > 0 && (
              <div className="summary-row">
                <span className="label">VAT (5%)</span>
                <span className="value">{fmt(order.tax_amount)}</span>
              </div>
            )}
            <div className="summary-total">
              <span className="label">Order Total</span>
              <span className="value">{fmt(order.total)}</span>
            </div>
          </div>
        </div>

        {/* ── Gift wrap ── */}
        {order.gift_wrap && (
          <div className="gift-box">
            <div className="gift-title">🎁 Gift Order — Please wrap this parcel as a gift</div>
            {order.gift_wrap_fee > 0 && (
              <div style={{ fontSize: 12, color: '#9d174d' }}>Gift wrap fee: {fmt(order.gift_wrap_fee)}</div>
            )}
            {order.gift_message && (
              <div className="gift-msg">
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>GIFT MESSAGE TO INCLUDE:</span>
                &ldquo;{order.gift_message}&rdquo;
              </div>
            )}
          </div>
        )}

        {/* ── Tracking / Shipping ── */}
        {(order.tracking_number || order.carrier || order.estimated_delivery) && (
          <div className="tracking-box">
            <div className="tracking-label">Shipping Info</div>
            {order.carrier && <p>Carrier: <strong>{order.carrier}</strong></p>}
            {order.tracking_number && <p>Tracking: <strong style={{ fontFamily: 'monospace' }}>{order.tracking_number}</strong></p>}
            {order.estimated_delivery && <p>Est. Delivery: <strong>{order.estimated_delivery}</strong></p>}
          </div>
        )}

        {/* ── Notes ── */}
        {order.notes && (
          <div className="notes-box">
            <div className="notes-label">⚠ Special Instructions</div>
            <p>{order.notes}</p>
          </div>
        )}

        {/* ── Barcode ── */}
        <div className="barcode-section">
          <div className="barcode-font">{order.order_number}</div>
          <div className="barcode-text">{order.order_number}</div>
        </div>

        {/* ── Footer ── */}
        <div className="footer">
          <div className="footer-left">
            <strong>To return this order:</strong> Contact us at {shop?.email || shop?.phone || 'our support team'}<br />
            Please include your order number when reaching out.
          </div>
          <div className="footer-right">
            Thank you for your order!<br />
            <span style={{ color: '#c4b5fd' }}>Powered by ExiusCart</span>
          </div>
        </div>
      </div>
    </>
  );
}
