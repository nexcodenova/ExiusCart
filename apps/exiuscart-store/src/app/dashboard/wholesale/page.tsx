'use client';
import { useState, useEffect } from 'react';
import {
  Plus, X, Loader2, Trash2, Edit2, Package, Users, ShoppingBag,
  TrendingUp, DollarSign, BarChart3, Copy, Check, Mail, MessageCircle,
  ChevronDown, ChevronUp, Lock, Crown, Eye, EyeOff, ArrowRight,
  AlertCircle, RefreshCw, CheckCircle, XCircle, Clock,
} from 'lucide-react';
import { wholesaleApi, subscriptionApi } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WProduct {
  id: number; name: string; description: string | null; sku: string | null;
  wholesale_price: number; retail_price: number | null; moq: number;
  stock: number | null; unit: string; is_active: boolean;
  show_in_pos: boolean; show_in_thedersi: boolean; show_in_storefront: boolean;
  created_at: string;
}

interface Buyer {
  id: number; name: string; email: string | null; phone: string | null;
  company: string | null; address: string | null; notes: string | null;
  token: string; is_active: boolean; catalogue_url: string;
  total_orders: number; total_spent: number; created_at: string;
}

interface WOrder {
  id: number; order_number: string; status: string; items: any[];
  subtotal: number; total: number; notes: string | null; quotation_id: number | null;
  buyer: { id: number; name: string; email: string | null; phone: string | null; company: string | null } | null;
  created_at: string;
}

interface Stats {
  total_revenue: number; this_month_revenue: number;
  total_orders: number; pending_orders: number; confirmed_orders: number; fulfilled_orders: number;
  active_buyers: number; total_products: number; avg_order_value: number;
  monthly_revenue: { month: string; revenue: number }[];
  top_buyers: { id: number; name: string; company: string | null; revenue: number; orders: number }[];
  top_products: { id: number; name: string; revenue: number; qty_sold: number }[];
}

const EMPTY_PRODUCT = {
  name: '', description: '', sku: '', wholesale_price: '', retail_price: '',
  moq: '1', stock: '', unit: 'pcs', is_active: true,
  show_in_pos: false, show_in_thedersi: false, show_in_storefront: false,
};

const EMPTY_BUYER = { name: '', email: '', phone: '', company: '', address: '', notes: '' };

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  confirmed: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  fulfilled: 'bg-green-500/10 text-green-600 dark:text-green-400',
  cancelled: 'bg-red-500/10 text-red-500',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3 h-3" />,
  confirmed: <CheckCircle className="w-3 h-3" />,
  fulfilled: <CheckCircle className="w-3 h-3" />,
  cancelled: <XCircle className="w-3 h-3" />,
};

function fmt(n: number, currency = 'LKR') {
  return `${currency} ${n.toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WholesalePage() {
  const [shopId, setShopId] = useState('');
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [planType, setPlanType] = useState<string>('');
  const [tab, setTab] = useState<'overview' | 'catalogue' | 'buyers' | 'orders'>('overview');
  const [products, setProducts] = useState<WProduct[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [orders, setOrders] = useState<WOrder[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderFilter, setOrderFilter] = useState('all');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  // Product modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<WProduct | null>(null);
  const [pForm, setPForm] = useState<typeof EMPTY_PRODUCT>({ ...EMPTY_PRODUCT });
  const [savingProduct, setSavingProduct] = useState(false);

  // Buyer modal
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState<Buyer | null>(null);
  const [bForm, setBForm] = useState<typeof EMPTY_BUYER>({ ...EMPTY_BUYER });
  const [savingBuyer, setSavingBuyer] = useState(false);

  useEffect(() => {
    const id = localStorage.getItem('shop_id') || '';
    setShopId(id);
  }, []);

  useEffect(() => {
    if (!shopId) return;
    subscriptionApi.getCurrent(shopId).then(r => {
      const pt = r.data?.plan?.plan_type ?? '';
      setPlanType(pt);
      setIsPremium(pt === 'premium');
    }).catch(() => { setPlanType(''); setIsPremium(false); });
  }, [shopId]);

  const loadAll = async () => {
    if (!shopId || !isPremium) return;
    setLoading(true);
    try {
      const [pRes, bRes, oRes, sRes] = await Promise.all([
        wholesaleApi.getProducts(shopId),
        wholesaleApi.getBuyers(shopId),
        wholesaleApi.getOrders(shopId),
        wholesaleApi.getStats(shopId),
      ]);
      setProducts(pRes.data ?? []);
      setBuyers(bRes.data ?? []);
      setOrders(oRes.data ?? []);
      setStats(sRes.data ?? null);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { if (isPremium) loadAll(); else if (isPremium === false) setLoading(false); }, [shopId, isPremium]);

  // ── Product CRUD ──

  const openNewProduct = () => { setEditingProduct(null); setPForm({ ...EMPTY_PRODUCT }); setShowProductModal(true); };
  const openEditProduct = (p: WProduct) => {
    setEditingProduct(p);
    setPForm({
      name: p.name, description: p.description || '', sku: p.sku || '',
      wholesale_price: String(p.wholesale_price), retail_price: p.retail_price ? String(p.retail_price) : '',
      moq: String(p.moq), stock: p.stock !== null ? String(p.stock) : '', unit: p.unit,
      is_active: p.is_active, show_in_pos: p.show_in_pos,
      show_in_thedersi: p.show_in_thedersi, show_in_storefront: p.show_in_storefront,
    });
    setShowProductModal(true);
  };

  const saveProduct = async () => {
    if (!pForm.name.trim() || !pForm.wholesale_price) return;
    setSavingProduct(true);
    const payload = {
      name: pForm.name.trim(), description: pForm.description || null,
      sku: pForm.sku || null, wholesale_price: parseFloat(pForm.wholesale_price),
      retail_price: pForm.retail_price ? parseFloat(pForm.retail_price) : null,
      moq: parseInt(pForm.moq) || 1, stock: pForm.stock ? parseInt(pForm.stock) : null,
      unit: pForm.unit, is_active: pForm.is_active,
      show_in_pos: pForm.show_in_pos, show_in_thedersi: pForm.show_in_thedersi,
      show_in_storefront: pForm.show_in_storefront,
    };
    try {
      if (editingProduct) await wholesaleApi.updateProduct(shopId, editingProduct.id, payload);
      else await wholesaleApi.createProduct(shopId, payload);
      setShowProductModal(false); loadAll();
    } catch {}
    setSavingProduct(false);
  };

  const deleteProduct = async (id: number) => {
    if (!confirm('Delete this wholesale product?')) return;
    try { await wholesaleApi.deleteProduct(shopId, id); loadAll(); } catch {}
  };

  // ── Buyer CRUD ──

  const openNewBuyer = () => { setEditingBuyer(null); setBForm({ ...EMPTY_BUYER }); setShowBuyerModal(true); };
  const openEditBuyer = (b: Buyer) => {
    setEditingBuyer(b);
    setBForm({ name: b.name, email: b.email || '', phone: b.phone || '', company: b.company || '', address: b.address || '', notes: b.notes || '' });
    setShowBuyerModal(true);
  };

  const saveBuyer = async () => {
    if (!bForm.name.trim()) return;
    setSavingBuyer(true);
    const payload = { name: bForm.name.trim(), email: bForm.email || null, phone: bForm.phone || null, company: bForm.company || null, address: bForm.address || null, notes: bForm.notes || null };
    try {
      if (editingBuyer) await wholesaleApi.updateBuyer(shopId, editingBuyer.id, payload);
      else await wholesaleApi.createBuyer(shopId, payload);
      setShowBuyerModal(false); loadAll();
    } catch {}
    setSavingBuyer(false);
  };

  const toggleBuyer = async (b: Buyer) => {
    try { await wholesaleApi.toggleBuyer(shopId, b.id); loadAll(); } catch {}
  };

  const deleteBuyer = async (id: number) => {
    if (!confirm('Remove this buyer? Their catalogue link will stop working.')) return;
    try { await wholesaleApi.deleteBuyer(shopId, id); loadAll(); } catch {}
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/wholesale/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const shareWhatsApp = (b: Buyer) => {
    const url = `${window.location.origin}/wholesale/${b.token}`;
    const msg = encodeURIComponent(`Hi ${b.name}! Here is your exclusive wholesale catalogue link:\n${url}\n\nBrowse and place your order directly.`);
    window.open(`https://wa.me/${(b.phone || '').replace(/\D/g, '')}?text=${msg}`, '_blank');
  };

  const shareEmail = (b: Buyer) => {
    const url = `${window.location.origin}/wholesale/${b.token}`;
    const subject = encodeURIComponent('Your Wholesale Catalogue');
    const body = encodeURIComponent(`Hi ${b.name},\n\nPlease find your exclusive wholesale catalogue here:\n${url}\n\nBrowse the catalogue and place your order directly. Feel free to reach out if you need any help.\n\nBest regards`);
    window.location.href = `mailto:${b.email || ''}?subject=${subject}&body=${body}`;
  };

  // ── Order status ──

  const updateOrderStatus = async (oid: number, status: string) => {
    try { await wholesaleApi.updateOrderStatus(shopId, oid, status); loadAll(); } catch {}
  };

  // ── Premium gate ──

  if (isPremium === false) {
    const isTheDersiPlan = planType === 'thedersi_basic' || planType === 'thedersi_pro';
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-card border border-border rounded-2xl p-10 max-w-md text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground mb-2">Wholesale — Premium Feature</h2>
            {isTheDersiPlan ? (
              <p className="text-sm text-muted-foreground">
                Wholesale B2B is available for <span className="font-semibold text-foreground">ExiusCart Premium subscribers</span> only.
                Your plan is managed by TheDersi — contact TheDersi for plan information.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Build a wholesale catalogue, manage B2B buyers, auto-generate quotations, and track wholesale revenue — all on Premium.
              </p>
            )}
          </div>
          {!isTheDersiPlan && (
            <a href="/dashboard/billing" className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-semibold text-sm transition">
              <Crown className="w-4 h-4" /> Upgrade to Premium
            </a>
          )}
        </div>
      </div>
    );
  }

  const filteredOrders = orderFilter === 'all' ? orders : orders.filter(o => o.status === orderFilter);
  const maxMonthlyRev = Math.max(...(stats?.monthly_revenue.map(m => m.revenue) ?? [1]), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-indigo-500" /> Wholesale
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">B2B catalogue, buyer management, and wholesale order tracking</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
        {(['overview', 'catalogue', 'buyers', 'orders'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {t}
            {t === 'orders' && stats?.pending_orders ? (
              <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{stats.pending_orders}</span>
            ) : null}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-28 bg-muted rounded-2xl animate-pulse" />)}</div>
      ) : (
        <>
          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div className="space-y-6">
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Revenue', value: fmt(stats?.total_revenue ?? 0), sub: `${fmt(stats?.this_month_revenue ?? 0)} this month`, icon: DollarSign, color: 'text-green-500 bg-green-500/10' },
                  { label: 'Total Orders', value: stats?.total_orders ?? 0, sub: `${stats?.pending_orders ?? 0} pending`, icon: ShoppingBag, color: 'text-blue-500 bg-blue-500/10' },
                  { label: 'Active Buyers', value: stats?.active_buyers ?? 0, sub: 'approved resellers', icon: Users, color: 'text-purple-500 bg-purple-500/10' },
                  { label: 'Avg. Order Value', value: fmt(stats?.avg_order_value ?? 0), sub: `${stats?.total_products ?? 0} products in catalogue`, icon: TrendingUp, color: 'text-indigo-500 bg-indigo-500/10' },
                ].map(card => (
                  <div key={card.label} className="bg-card border border-border rounded-2xl p-5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color} mb-3`}>
                      <card.icon className="w-5 h-5" />
                    </div>
                    <p className="text-2xl font-bold text-foreground">{card.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
                    <p className="text-xs text-muted-foreground mt-1 opacity-70">{card.sub}</p>
                  </div>
                ))}
              </div>

              {/* Revenue chart + top buyers */}
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Monthly revenue bar chart */}
                <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
                  <h3 className="font-semibold text-foreground mb-5 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-500" /> Monthly Wholesale Revenue
                  </h3>
                  <div className="flex items-end gap-3 h-40">
                    {(stats?.monthly_revenue ?? []).map(m => (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                        <p className="text-xs text-muted-foreground">{fmt(m.revenue)}</p>
                        <div className="w-full bg-muted rounded-t-lg relative overflow-hidden" style={{ height: '80px' }}>
                          <div className="absolute bottom-0 left-0 right-0 bg-indigo-500 rounded-t-lg transition-all"
                            style={{ height: `${Math.max(4, (m.revenue / maxMonthlyRev) * 80)}px` }} />
                        </div>
                        <p className="text-xs text-muted-foreground">{m.month.split(' ')[0]}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order breakdown */}
                <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                  <h3 className="font-semibold text-foreground">Order Status</h3>
                  {[
                    { label: 'Pending', count: stats?.pending_orders ?? 0, color: 'bg-amber-500' },
                    { label: 'Confirmed', count: stats?.confirmed_orders ?? 0, color: 'bg-blue-500' },
                    { label: 'Fulfilled', count: stats?.fulfilled_orders ?? 0, color: 'bg-green-500' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${s.color} shrink-0`} />
                      <span className="text-sm text-muted-foreground flex-1">{s.label}</span>
                      <span className="text-sm font-semibold text-foreground">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top buyers + top products */}
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-purple-500" /> Top Buyers</h3>
                  {(stats?.top_buyers ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No fulfilled orders yet</p>
                  ) : (
                    <div className="space-y-3">
                      {stats?.top_buyers.map((b, i) => (
                        <div key={b.id} className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-purple-500/10 text-purple-600 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{b.name}</p>
                            {b.company && <p className="text-xs text-muted-foreground truncate">{b.company}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-foreground">{fmt(b.revenue)}</p>
                            <p className="text-xs text-muted-foreground">{b.orders} orders</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Package className="w-4 h-4 text-indigo-500" /> Top Products</h3>
                  {(stats?.top_products ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No fulfilled orders yet</p>
                  ) : (
                    <div className="space-y-3">
                      {stats?.top_products.map((p, i) => (
                        <div key={p.id} className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-indigo-500/10 text-indigo-600 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                          <p className="text-sm font-medium text-foreground flex-1 truncate">{p.name}</p>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-foreground">{fmt(p.revenue)}</p>
                            <p className="text-xs text-muted-foreground">{p.qty_sold} units</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── CATALOGUE ── */}
          {tab === 'catalogue' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{products.length} products in catalogue</p>
                <button onClick={openNewProduct} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
                  <Plus className="w-4 h-4" /> Add Product
                </button>
              </div>

              {products.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-16 text-center">
                  <Package className="w-14 h-14 mx-auto text-muted-foreground opacity-30 mb-4" />
                  <h3 className="font-semibold text-foreground mb-1">No wholesale products yet</h3>
                  <p className="text-sm text-muted-foreground mb-5">Add products to your wholesale catalogue to start selling B2B.</p>
                  <button onClick={openNewProduct} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
                    <Plus className="w-4 h-4" /> Add First Product
                  </button>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map(p => (
                    <div key={p.id} className={`bg-card border rounded-2xl p-5 space-y-3 transition hover:border-primary/40 ${p.is_active ? 'border-border' : 'border-border opacity-60'}`}>
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.is_active ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                            {p.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <button onClick={() => openEditProduct(p)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteProduct(p.id)} className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{p.name}</h3>
                        {p.sku && <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>}
                        {p.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-bold text-foreground">LKR {p.wholesale_price.toLocaleString()}</p>
                          {p.retail_price && <p className="text-xs text-muted-foreground line-through">LKR {p.retail_price.toLocaleString()}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Min {p.moq} {p.unit}</p>
                          {p.stock !== null && <p className="text-xs text-muted-foreground">{p.stock} in stock</p>}
                        </div>
                      </div>
                      {/* Channel toggles display */}
                      <div className="flex gap-1.5 flex-wrap">
                        {p.show_in_pos && <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full">POS</span>}
                        {p.show_in_thedersi && <span className="text-xs px-2 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full">TheDersi</span>}
                        {p.show_in_storefront && <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full">Storefront</span>}
                        {!p.show_in_pos && !p.show_in_thedersi && !p.show_in_storefront && (
                          <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full">Wholesale only</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── BUYERS ── */}
          {tab === 'buyers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{buyers.length} buyers — each has a unique private catalogue link</p>
                <button onClick={openNewBuyer} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
                  <Plus className="w-4 h-4" /> Add Buyer
                </button>
              </div>

              {buyers.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-16 text-center">
                  <Users className="w-14 h-14 mx-auto text-muted-foreground opacity-30 mb-4" />
                  <h3 className="font-semibold text-foreground mb-1">No buyers yet</h3>
                  <p className="text-sm text-muted-foreground mb-5">Add a buyer to generate their private catalogue link and share it via WhatsApp or email.</p>
                  <button onClick={openNewBuyer} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
                    <Plus className="w-4 h-4" /> Add First Buyer
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {buyers.map(b => (
                    <div key={b.id} className={`bg-card border rounded-2xl p-5 transition ${b.is_active ? 'border-border' : 'border-border opacity-60'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0 text-purple-600 font-bold text-sm">
                            {b.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-foreground">{b.name}</h3>
                              {b.company && <span className="text-xs text-muted-foreground">{b.company}</span>}
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.is_active ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                                {b.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                              {b.phone && <span>{b.phone}</span>}
                              {b.email && <span>{b.email}</span>}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              <span>{b.total_orders} orders</span>
                              <span className="font-medium text-foreground">LKR {b.total_spent.toLocaleString()} spent</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button onClick={() => copyLink(b.token)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted transition">
                            {copiedToken === b.token ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            {copiedToken === b.token ? 'Copied!' : 'Copy Link'}
                          </button>
                          <button onClick={() => shareWhatsApp(b)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/30 rounded-lg text-xs font-medium hover:bg-[#25D366]/20 transition">
                            <MessageCircle className="w-3 h-3" /> WhatsApp
                          </button>
                          <button onClick={() => shareEmail(b)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 border border-blue-500/20 rounded-lg text-xs font-medium hover:bg-blue-500/20 transition">
                            <Mail className="w-3 h-3" /> Email
                          </button>
                          <button onClick={() => openEditBuyer(b)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => toggleBuyer(b)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition" title={b.is_active ? 'Deactivate' : 'Activate'}>
                            {b.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button onClick={() => deleteBuyer(b.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Catalogue link preview */}
                      <div className="mt-3 flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                        <span className="text-xs text-muted-foreground truncate flex-1">
                          {typeof window !== 'undefined' ? window.location.origin : ''}/wholesale/{b.token}
                        </span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ORDERS ── */}
          {tab === 'orders' && (
            <div className="space-y-4">
              {/* Filter */}
              <div className="flex gap-2 flex-wrap">
                {['all', 'pending', 'confirmed', 'fulfilled', 'cancelled'].map(s => (
                  <button key={s} onClick={() => setOrderFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${orderFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                    {s} {s === 'all' ? `(${orders.length})` : `(${orders.filter(o => o.status === s).length})`}
                  </button>
                ))}
              </div>

              {filteredOrders.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-16 text-center">
                  <ShoppingBag className="w-14 h-14 mx-auto text-muted-foreground opacity-30 mb-4" />
                  <h3 className="font-semibold text-foreground mb-1">No orders yet</h3>
                  <p className="text-sm text-muted-foreground">Wholesale orders will appear here when buyers submit requests from their catalogue link.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredOrders.map(o => (
                    <div key={o.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                      <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground">{o.order_number}</span>
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] ?? 'bg-muted text-muted-foreground'}`}>
                              {STATUS_ICONS[o.status]} {o.status}
                            </span>
                            {o.quotation_id && (
                              <a href={`/dashboard/quotations/${o.quotation_id}`} className="text-xs text-primary hover:underline">
                                View Quotation →
                              </a>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {o.buyer?.name} {o.buyer?.company ? `— ${o.buyer.company}` : ''} · {o.items.length} items · <span className="font-semibold text-foreground">LKR {o.total.toLocaleString()}</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{new Date(o.created_at).toLocaleString('en-LK')}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          {o.status === 'pending' && (
                            <button onClick={() => updateOrderStatus(o.id, 'confirmed')}
                              className="px-3 py-1.5 bg-blue-500/10 text-blue-600 border border-blue-500/20 rounded-lg text-xs font-medium hover:bg-blue-500/20 transition">
                              Confirm
                            </button>
                          )}
                          {o.status === 'confirmed' && (
                            <button onClick={() => updateOrderStatus(o.id, 'fulfilled')}
                              className="px-3 py-1.5 bg-green-500/10 text-green-600 border border-green-500/20 rounded-lg text-xs font-medium hover:bg-green-500/20 transition">
                              Mark Fulfilled
                            </button>
                          )}
                          {(o.status === 'pending' || o.status === 'confirmed') && (
                            <button onClick={() => updateOrderStatus(o.id, 'cancelled')}
                              className="px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-xs font-medium hover:bg-red-500/20 transition">
                              Cancel
                            </button>
                          )}
                          <button onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition">
                            {expandedOrder === o.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded items */}
                      {expandedOrder === o.id && (
                        <div className="border-t border-border">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/40">
                                <tr>
                                  {['Product', 'SKU', 'Qty', 'Unit Price', 'Total'].map(h => (
                                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {o.items.map((item: any, i: number) => (
                                  <tr key={i} className="hover:bg-muted/20">
                                    <td className="px-4 py-2.5 font-medium text-foreground text-xs">{item.name}</td>
                                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{item.sku || '—'}</td>
                                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{item.qty} {item.unit}</td>
                                    <td className="px-4 py-2.5 text-xs text-muted-foreground">LKR {item.unit_price?.toLocaleString()}</td>
                                    <td className="px-4 py-2.5 text-xs font-semibold text-foreground">LKR {item.total?.toLocaleString()}</td>
                                  </tr>
                                ))}
                                <tr className="bg-muted/20">
                                  <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-right text-foreground">Order Total</td>
                                  <td className="px-4 py-2.5 text-sm font-bold text-foreground">LKR {o.total.toLocaleString()}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          {o.notes && (
                            <div className="px-4 py-3 bg-muted/20 text-xs text-muted-foreground border-t border-border">
                              <span className="font-medium text-foreground">Buyer note: </span>{o.notes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Product Modal ── */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h2 className="font-semibold text-foreground">{editingProduct ? 'Edit Product' : 'Add Wholesale Product'}</h2>
              <button onClick={() => setShowProductModal(false)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Product Name *</label>
                  <input value={pForm.name} onChange={e => setPForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Silk Fabric Roll"
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">SKU</label>
                  <input value={pForm.sku} onChange={e => setPForm(p => ({ ...p, sku: e.target.value }))} placeholder="WP-001"
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Unit</label>
                  <select value={pForm.unit} onChange={e => setPForm(p => ({ ...p, unit: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary outline-none">
                    {['pcs', 'meters', 'kg', 'liters', 'boxes', 'rolls', 'pairs'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Wholesale Price (LKR) *</label>
                  <input type="number" value={pForm.wholesale_price} onChange={e => setPForm(p => ({ ...p, wholesale_price: e.target.value }))} placeholder="0"
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Retail Price (optional)</label>
                  <input type="number" value={pForm.retail_price} onChange={e => setPForm(p => ({ ...p, retail_price: e.target.value }))} placeholder="0"
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Min. Order Qty (MOQ)</label>
                  <input type="number" min={1} value={pForm.moq} onChange={e => setPForm(p => ({ ...p, moq: e.target.value }))} placeholder="1"
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Stock (leave blank = unlimited)</label>
                  <input type="number" value={pForm.stock} onChange={e => setPForm(p => ({ ...p, stock: e.target.value }))} placeholder="∞"
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Description</label>
                  <textarea value={pForm.description} onChange={e => setPForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Brief product description..."
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary outline-none resize-none" />
                </div>
              </div>

              {/* Channel toggles */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Also show in</p>
                {[
                  { key: 'show_in_pos' as const, label: 'Point of Sale (POS)', desc: 'Visible to cashier at counter' },
                  { key: 'show_in_thedersi' as const, label: 'TheDersi Marketplace', desc: 'Only if you are a TheDersi Pro seller' },
                  { key: 'show_in_storefront' as const, label: 'Online Storefront', desc: 'Visible on your public store' },
                ].map(ch => (
                  <label key={ch.key} className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl cursor-pointer hover:bg-muted transition">
                    <input type="checkbox" checked={pForm[ch.key]} onChange={e => setPForm(p => ({ ...p, [ch.key]: e.target.checked }))} className="w-4 h-4 accent-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{ch.label}</p>
                      <p className="text-xs text-muted-foreground">{ch.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={pForm.is_active} onChange={e => setPForm(p => ({ ...p, is_active: e.target.checked }))} className="w-4 h-4 accent-primary" />
                <span className="text-sm text-foreground">Active (visible to buyers)</span>
              </label>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-border shrink-0">
              <button onClick={() => setShowProductModal(false)} className="flex-1 py-2.5 border border-border rounded-xl text-sm text-foreground hover:bg-muted transition">Cancel</button>
              <button onClick={saveProduct} disabled={savingProduct || !pForm.name.trim() || !pForm.wholesale_price}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition inline-flex items-center justify-center gap-2">
                {savingProduct && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingProduct ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Buyer Modal ── */}
      {showBuyerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">{editingBuyer ? 'Edit Buyer' : 'Add Wholesale Buyer'}</h2>
              <button onClick={() => setShowBuyerModal(false)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-3">
              {[
                { key: 'name' as const, label: 'Buyer Name *', placeholder: 'Full name' },
                { key: 'company' as const, label: 'Company / Shop Name', placeholder: 'Business name (optional)' },
                { key: 'phone' as const, label: 'WhatsApp / Phone', placeholder: '+94 77 XXX XXXX' },
                { key: 'email' as const, label: 'Email', placeholder: 'buyer@email.com' },
                { key: 'address' as const, label: 'Address', placeholder: 'City, Province' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">{f.label}</label>
                  <input value={bForm[f.key]} onChange={e => setBForm(b => ({ ...b, [f.key]: e.target.value }))} placeholder={f.placeholder}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary outline-none" />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Notes</label>
                <textarea value={bForm.notes} onChange={e => setBForm(b => ({ ...b, notes: e.target.value }))} rows={2} placeholder="Payment terms, delivery notes..."
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary outline-none resize-none" />
              </div>
              {!editingBuyer && (
                <div className="bg-indigo-500/8 border border-indigo-500/20 rounded-xl p-3 text-xs text-indigo-600 dark:text-indigo-400">
                  A unique private catalogue link will be generated for this buyer automatically.
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setShowBuyerModal(false)} className="flex-1 py-2.5 border border-border rounded-xl text-sm text-foreground hover:bg-muted transition">Cancel</button>
              <button onClick={saveBuyer} disabled={savingBuyer || !bForm.name.trim()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition inline-flex items-center justify-center gap-2">
                {savingBuyer && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingBuyer ? 'Save Changes' : 'Add Buyer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
