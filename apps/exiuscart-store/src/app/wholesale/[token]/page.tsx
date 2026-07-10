'use client';
import { useState, useEffect } from 'react';
import { use } from 'react';
import {
  ShoppingBag, Plus, Minus, Package, Loader2, CheckCircle,
  AlertCircle, MessageCircle, Phone, Mail, ChevronRight,
} from 'lucide-react';
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const publicApi = axios.create({ baseURL: `${API_BASE}/api/v1` });

interface CatalogueProduct {
  id: number; name: string; description: string | null; sku: string | null;
  wholesale_price: number; retail_price: number | null; moq: number;
  stock: number | null; unit: string; is_active: boolean;
}

interface CatalogueData {
  buyer: { id: number; name: string; company: string | null };
  shop: { name: string; logo_url: string | null; currency: string; phone: string | null; email: string | null };
  products: CatalogueProduct[];
}

export default function BuyerPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [catalogue, setCatalogue] = useState<CatalogueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerCompany, setBuyerCompany] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ order_number: string; total: number } | null>(null);
  const [error, setError] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    publicApi.get(`/wholesale/catalogue/${token}`)
      .then(r => {
        setCatalogue(r.data);
        // Pre-fill buyer info from catalogue
        setBuyerName(r.data.buyer.name || '');
        setBuyerCompany(r.data.buyer.company || '');
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const setQty = (productId: number, qty: number, moq: number) => {
    if (qty < 0) return;
    if (qty === 0) {
      setCart(prev => { const n = { ...prev }; delete n[productId]; return n; });
    } else {
      setCart(prev => ({ ...prev, [productId]: Math.max(qty, 0) }));
    }
  };

  const cartItems = Object.entries(cart)
    .map(([id, qty]) => {
      const p = catalogue?.products.find(p => p.id === Number(id));
      return p ? { ...p, qty } : null;
    })
    .filter(Boolean) as (CatalogueProduct & { qty: number })[];

  const cartTotal = cartItems.reduce((sum, i) => sum + i.qty * i.wholesale_price, 0);
  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0);

  const belowMOQ = cartItems.filter(i => i.qty < i.moq);

  const submitOrder = async () => {
    if (!buyerName.trim()) { setError('Please enter your name.'); return; }
    if (belowMOQ.length > 0) {
      setError(`Minimum order not met for: ${belowMOQ.map(i => `${i.name} (min ${i.moq})`).join(', ')}`);
      return;
    }
    setSubmitting(true); setError('');
    try {
      const res = await publicApi.post(`/wholesale/catalogue/${token}/order`, {
        buyer_name: buyerName.trim(),
        buyer_phone: buyerPhone || null,
        buyer_email: buyerEmail || null,
        buyer_company: buyerCompany || null,
        notes: orderNote || null,
        items: cartItems.map(i => ({
          product_id: i.id, name: i.name, sku: i.sku,
          qty: i.qty, unit_price: i.wholesale_price, unit: i.unit,
        })),
      });
      setSubmitted({ order_number: res.data.order_number, total: res.data.total });
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to submit order. Please try again.');
    }
    setSubmitting(false);
  };

  const currency = catalogue?.shop.currency || 'LKR';

  // ── Loading / Error states ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <ShoppingBag className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Catalogue Unavailable</h1>
          <p className="text-sm text-muted-foreground">This catalogue link is invalid or has been deactivated by the seller.</p>
        </div>
      </div>
    );
  }

  // ── Order Submitted ─────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl p-10 max-w-md w-full text-center space-y-5 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Order Submitted!</h1>
            <p className="text-muted-foreground text-sm mt-1">Your order request has been sent to {catalogue?.shop.name}.</p>
          </div>
          <div className="bg-muted rounded-xl p-4 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order #</span>
              <span className="font-semibold text-foreground">{submitted.order_number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-bold text-foreground">{currency} {submitted.total.toLocaleString()}</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            The seller will review your order and contact you with a formal quotation shortly.
          </p>
          {catalogue?.shop.phone && (
            <a href={`https://wa.me/${catalogue.shop.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-[#25D366]/90 transition">
              <MessageCircle className="w-4 h-4" /> Chat on WhatsApp
            </a>
          )}
          <button onClick={() => { setSubmitted(null); setCart({}); setShowCheckout(false); }}
            className="block text-sm text-muted-foreground hover:text-foreground transition mx-auto">
            Browse more products
          </button>
        </div>
      </div>
    );
  }

  // ── Main Catalogue ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Shop Header */}
      <div className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {catalogue?.shop.logo_url ? (
              <img src={catalogue.shop.logo_url} alt={catalogue?.shop.name} className="w-10 h-10 rounded-xl object-cover" />
            ) : (
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <ShoppingBag className="w-5 h-5 text-primary" />
              </div>
            )}
            <div>
              <h1 className="font-bold text-foreground text-sm sm:text-base">{catalogue?.shop.name}</h1>
              <p className="text-xs text-muted-foreground">Wholesale Catalogue · {catalogue?.buyer.name}</p>
            </div>
          </div>

          {/* Cart summary */}
          {cartCount > 0 && !showCheckout && (
            <button onClick={() => setShowCheckout(true)}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition shrink-0">
              <ShoppingBag className="w-4 h-4" />
              {cartCount} items · {currency} {cartTotal.toLocaleString()}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {!showCheckout ? (
          <>
            {/* Catalogue header */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground">Wholesale Catalogue</h2>
              <p className="text-sm text-muted-foreground mt-1">{catalogue?.products.length} products · Trade prices · Select quantity and request order</p>
            </div>

            {catalogue?.products.length === 0 ? (
              <div className="text-center py-24 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No products available yet</p>
                <p className="text-sm">Check back later or contact the seller.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {catalogue?.products.map(p => {
                  const qty = cart[p.id] ?? 0;
                  const inCart = qty > 0;
                  const belowMin = inCart && qty < p.moq;

                  return (
                    <div key={p.id} className={`bg-card border rounded-2xl p-5 space-y-4 transition ${inCart ? 'border-primary/50 shadow-sm' : 'border-border'}`}>
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center shrink-0">
                          <Package className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground">{p.name}</h3>
                          {p.sku && <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>}
                          {p.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                        </div>
                      </div>

                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-xl font-bold text-foreground">{currency} {p.wholesale_price.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">per {p.unit}</p>
                          {p.retail_price && (
                            <p className="text-xs text-muted-foreground">Retail: <span className="line-through">{currency} {p.retail_price.toLocaleString()}</span></p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-medium text-primary">Min {p.moq} {p.unit}</p>
                          {p.stock !== null && (
                            <p className={`text-xs mt-0.5 ${p.stock < 10 ? 'text-red-500' : 'text-muted-foreground'}`}>
                              {p.stock} in stock
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Qty selector */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2 flex-1">
                          <button onClick={() => setQty(p.id, qty - 1, p.moq)}
                            className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted transition text-foreground">
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number" min={0} value={qty || ''}
                            onChange={e => setQty(p.id, parseInt(e.target.value) || 0, p.moq)}
                            placeholder="0"
                            className="flex-1 text-center bg-transparent text-foreground text-sm font-medium outline-none w-0 min-w-0"
                          />
                          <button onClick={() => setQty(p.id, qty + 1, p.moq)}
                            className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        {inCart && (
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-foreground">{currency} {(qty * p.wholesale_price).toLocaleString()}</p>
                          </div>
                        )}
                      </div>

                      {belowMin && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" /> Minimum order is {p.moq} {p.unit}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sticky cart footer */}
            {cartCount > 0 && (
              <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 z-20">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-foreground">{cartCount} items selected</p>
                    <p className="text-sm text-muted-foreground">Total: <span className="font-bold text-foreground">{currency} {cartTotal.toLocaleString()}</span></p>
                  </div>
                  <button onClick={() => setShowCheckout(true)}
                    className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 transition">
                    Request Order <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* ── Checkout ── */
          <div className="max-w-lg mx-auto space-y-6">
            <div>
              <button onClick={() => setShowCheckout(false)} className="text-sm text-muted-foreground hover:text-foreground transition mb-4 flex items-center gap-1">
                ← Back to catalogue
              </button>
              <h2 className="text-xl font-bold text-foreground">Review & Request Order</h2>
            </div>

            {/* Order summary */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h3 className="font-medium text-foreground text-sm">Order Summary</h3>
              </div>
              <div className="divide-y divide-border">
                {cartItems.map(i => (
                  <div key={i.id} className="px-5 py-3 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{i.name}</p>
                      <p className="text-xs text-muted-foreground">{i.qty} × {currency} {i.wholesale_price.toLocaleString()}</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground shrink-0">{currency} {(i.qty * i.wholesale_price).toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
                <span className="font-semibold text-foreground">Total</span>
                <span className="text-lg font-bold text-foreground">{currency} {cartTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Buyer details */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <h3 className="font-medium text-foreground text-sm mb-1">Your Details</h3>
              {[
                { key: 'buyerName', label: 'Your Name *', value: buyerName, set: setBuyerName, placeholder: 'Full name' },
                { key: 'buyerCompany', label: 'Company / Shop', value: buyerCompany, set: setBuyerCompany, placeholder: 'Business name (optional)' },
                { key: 'buyerPhone', label: 'WhatsApp / Phone', value: buyerPhone, set: setBuyerPhone, placeholder: '+94 77 XXX XXXX' },
                { key: 'buyerEmail', label: 'Email', value: buyerEmail, set: setBuyerEmail, placeholder: 'your@email.com' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-muted-foreground block mb-1">{f.label}</label>
                  <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary outline-none" />
                </div>
              ))}
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Order Notes (optional)</label>
                <textarea value={orderNote} onChange={e => setOrderNote(e.target.value)} rows={2}
                  placeholder="Delivery instructions, special requests..."
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary outline-none resize-none" />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center">
              By submitting, the seller will receive your order request and contact you with a formal quotation.
            </p>

            <button onClick={submitOrder} disabled={submitting || cartItems.length === 0}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition inline-flex items-center justify-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Submitting...' : `Send Order Request — ${currency} ${cartTotal.toLocaleString()}`}
            </button>

            {/* Seller contact */}
            {(catalogue?.shop.phone || catalogue?.shop.email) && (
              <div className="flex items-center justify-center gap-4 pt-2">
                {catalogue.shop.phone && (
                  <a href={`https://wa.me/${catalogue.shop.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-[#25D366] hover:underline">
                    <MessageCircle className="w-4 h-4" /> WhatsApp seller
                  </a>
                )}
                {catalogue.shop.email && (
                  <a href={`mailto:${catalogue.shop.email}`}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                    <Mail className="w-4 h-4" /> Email seller
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
