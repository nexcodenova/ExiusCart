'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  TrendingUp, Plus, Search, Pencil, Trash2, Loader2,
  Flame, Star, Eye, EyeOff, X, Check, Package, Upload, ImageIcon,
  ExternalLink, Tag, AlertCircle, ShoppingBag,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShoppingProductVariant {
  color: string | null;
  color_hex: string | null;
}

interface ShoppingProduct {
  id: number;
  name: string;
  description: string | null;
  price: number;
  cost_price: number | null;
  currency: string;
  image_url: string | null;
  images?: string[];
  video_url: string | null;
  source_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  is_trending: boolean;
  sku: string | null;
  category_name: string | null;
  created_at: string;
  variants?: ShoppingProductVariant[];
  winning_score: number | null;
  trend_percent: number | null;
  competition_level: string | null;
  saturation_level: string | null;
  orders_count: number | null;
  supplier_name: string | null;
  supplier_rating: number | null;
  processing_time: string | null;
  shipping_time: string | null;
  warehouse_country: string | null;
  ad_facebook_url: string | null;
  ad_tiktok_url: string | null;
  ad_instagram_url: string | null;
  ad_pinterest_url: string | null;
  specs_json: string | null;
  tags: string | null;
}

const emptyForm = {
  name: '',
  description: '',
  cost_price: '',
  price: '',
  sku: '',
  image_url: '',
  video_url: '',
  source_url: '',
  category_name: '',
  is_featured: false,
  is_trending: false,
  is_active: true,
  winning_score: '',
  trend_percent: '',
  competition_level: '',
  saturation_level: '',
  orders_count: '',
  supplier_name: '',
  supplier_rating: '',
  processing_time: '',
  shipping_time: '',
  warehouse_country: '',
  ad_facebook_url: '',
  ad_tiktok_url: '',
  ad_instagram_url: '',
  ad_pinterest_url: '',
  tags: '',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${color}`}>
      {label}
    </span>
  );
}

function Toggle({
  on,
  onChange,
  color = 'bg-[#6B3FD9]',
}: {
  on: boolean;
  onChange: () => void;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-9 h-5 rounded-full transition-colors flex items-center flex-shrink-0 ${on ? color : 'bg-gray-700'}`}
    >
      <span className={`w-3.5 h-3.5 bg-white rounded-full shadow transition-transform mx-0.5 ${on ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );
}

function QuickToggle({
  active, onClick, icon, title,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded-lg transition ${active ? 'bg-[#6B3FD9]/20 text-[#6B3FD9]' : 'text-gray-600 hover:text-gray-400 hover:bg-gray-800'}`}
    >
      {icon}
    </button>
  );
}

// ── Meta Ad Library search panel ──────────────────────────────────────────────
// Real ads pulled live from Meta's public Ad Library API (ads_archive) —
// see admin_meta_ads_search in admin.py. Requires META_AD_LIBRARY_TOKEN to
// be configured server-side; shows a clear "not connected" message otherwise.

function MetaAdSearchPanel({ query, setQuery, ads, loading, error, onSearch, onPick, onClose }: {
  query: string; setQuery: (v: string) => void;
  ads: { id: string; page_name: string; snapshot_url: string; body: string | null }[];
  loading: boolean; error: string;
  onSearch: () => void; onPick: (url: string) => void; onClose: () => void;
}) {
  return (
    <div className="mt-2 p-3 bg-[#0B1121] border border-gray-700 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-400">Search real ads on Meta Ad Library</p>
        <button type="button" onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="flex gap-2">
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSearch(); } }}
          placeholder="Search by product or brand name…"
          className="flex-1 px-3 py-2 bg-[#151F32] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 text-sm focus:border-[#6B3FD9] focus:outline-none" />
        <button type="button" onClick={onSearch} disabled={loading}
          className="px-3 py-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white rounded-lg text-sm font-medium disabled:opacity-60 flex items-center gap-1.5">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </button>
      </div>
      {error && (
        <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
        </div>
      )}
      {ads.length > 0 && (
        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {ads.map((ad) => (
            <button key={ad.id} type="button" onClick={() => onPick(ad.snapshot_url)}
              className="w-full text-left px-3 py-2 bg-[#151F32] hover:bg-[#1c2842] border border-gray-800 rounded-lg transition">
              <p className="text-xs font-medium text-white truncate">{ad.page_name || 'Unknown advertiser'}</p>
              {ad.body && <p className="text-xs text-gray-500 truncate mt-0.5">{ad.body}</p>}
            </button>
          ))}
        </div>
      )}
      {!loading && !error && ads.length === 0 && query && (
        <p className="text-xs text-gray-500">No results yet — try searching.</p>
      )}
    </div>
  );
}

// ── CJ Import Modal ──────────────────────────────────────────────────────────

interface CJProduct {
  pid: string;
  name: string;
  image: string;
  cost_price: number;
  category: string;
}

function CJImportModal({ connected, onClose, onConnected, onImported }: {
  connected: boolean;
  onClose: () => void;
  onConnected: () => void;
  onImported: () => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');

  const [inputVal, setInputVal] = useState('');
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<CJProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingPid, setImportingPid] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true); setConnectError('');
    try {
      await adminApi.cjConnect(apiKey);
      onConnected();
    } catch (err: any) {
      setConnectError(err?.response?.data?.detail?.message ?? err?.response?.data?.detail ?? 'Connection failed. Check your API key.');
    } finally { setConnecting(false); }
  };

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!inputVal.trim()) { setProducts([]); setQuery(''); return; }
    searchTimeout.current = setTimeout(() => setQuery(inputVal.trim()), 500);
  }, [inputVal]);

  useEffect(() => {
    if (!query || !connected) return;
    setLoading(true);
    setProducts([]);
    adminApi.cjSearch(query)
      .then((r: any) => setProducts(r.data?.products ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [query, connected]);

  const handleImport = async (p: CJProduct) => {
    setImportingPid(p.pid);
    try {
      await adminApi.cjImport(p.pid, undefined, p.category || undefined);
      setImportedCount((c) => c + 1);
      onImported();
    } catch {
      // leave product in the list so they can retry
    } finally { setImportingPid(null); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0F1729] border border-gray-800 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-800 sticky top-0 bg-[#0F1729] z-10">
          <div>
            <p className="font-semibold text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#6B3FD9]" /> Import from CJ Dropshipping
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Products go straight into the Prodora catalog</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        {!connected ? (
          <form onSubmit={connect} className="p-5 space-y-4">
            {connectError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{connectError}</div>
            )}
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">CJ API Key *</label>
              <div className="relative">
                <input type={showApiKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} required
                  placeholder="CJUserNum@api@..."
                  className="w-full px-3 py-2.5 pr-10 bg-[#0B1121] border border-gray-700 rounded-lg focus:ring-2 focus:ring-[#6B3FD9] outline-none text-white text-sm" />
                <button type="button" onClick={() => setShowApiKey((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}>
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400 bg-[#0B1121] rounded-lg px-3 py-2.5 leading-relaxed">
              Generate a key at CJ &rarr; My CJ &rarr; API management &rarr; Add API &rarr; Type: &quot;API Key&quot;. This connects CJ to the Prodora catalog only, separate from any individual seller&apos;s own CJ connection.
            </p>
            <button type="submit" disabled={connecting}
              className="w-full py-2.5 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white rounded-lg text-sm font-medium transition disabled:opacity-60 flex items-center justify-center gap-2">
              {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
              {connecting ? 'Connecting...' : 'Connect CJ Dropshipping'}
            </button>
          </form>
        ) : (
          <div className="p-5 space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Search CJ products e.g. wireless earbuds, phone case, yoga mat…"
                className="w-full pl-10 pr-4 py-3 bg-[#0B1121] border border-gray-700 rounded-xl text-sm text-white placeholder:text-gray-500 focus:ring-2 focus:ring-[#6B3FD9] outline-none"
              />
              {loading && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-500" />}
            </div>

            {inputVal.trim().split(/\s+/).filter(Boolean).length > 4 && (
              <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>CJ&apos;s search works best with short, simple terms (1–3 words) — long phrases tend to return unrelated results.</span>
              </div>
            )}

            {importedCount > 0 && (
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2.5 text-sm text-green-400">
                <Check className="w-4 h-4" /> {importedCount} product{importedCount > 1 ? 's' : ''} imported into Prodora
              </div>
            )}

            {!query && (
              <div className="text-center py-16 text-sm text-gray-500">Start typing above to search CJ&apos;s catalog.</div>
            )}

            {products.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {products.map((p) => (
                  <div key={p.pid} className="bg-[#0B1121] border border-gray-800 rounded-xl overflow-hidden flex flex-col">
                    <div className="relative aspect-square bg-gray-900">
                      {p.image
                        ? <Image src={p.image} alt={p.name} fill className="object-cover" unoptimized />
                        : <div className="absolute inset-0 flex items-center justify-center"><Package className="w-8 h-8 text-gray-700" /></div>
                      }
                    </div>
                    <div className="p-3 flex flex-col gap-2 flex-1">
                      <p className="text-xs text-white font-medium line-clamp-2 leading-snug">{p.name}</p>
                      <div className="flex items-center justify-between mt-auto">
                        <div>
                          <p className="text-[10px] text-gray-500">CJ cost</p>
                          <p className="text-sm font-bold text-white">${p.cost_price.toFixed(2)}</p>
                        </div>
                        <button onClick={() => handleImport(p)} disabled={importingPid === p.pid}
                          className="text-xs px-2.5 py-1.5 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white rounded-lg transition font-medium shrink-0 disabled:opacity-60 flex items-center gap-1">
                          {importingPid === p.pid ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Import'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && query && products.length === 0 && (
              <div className="text-center py-10 text-sm text-gray-500">No products found for &ldquo;{query}&rdquo;. Try a different keyword.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TrendingDropshippingPage() {
  const [products, setProducts] = useState<ShoppingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // CJ import
  const [cjConnected, setCjConnected] = useState(false);
  const [showCjModal, setShowCjModal] = useState(false);

  useEffect(() => {
    adminApi.cjStatus().then((r: any) => setCjConnected(!!r.data?.connected)).catch(() => {});
  }, []);

  // modal state
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<ShoppingProduct | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // image upload
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // extra gallery images (beyond the primary upload), variants, specs
  const [extraImages, setExtraImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<{ color: string; color_hex: string }[]>([]);
  const [specs, setSpecs] = useState<{ key: string; value: string }[]>([]);

  // Meta Ad Library search (Facebook/Instagram — real ads, see admin_meta_ads_search)
  const [showMetaSearch, setShowMetaSearch] = useState<'facebook' | 'instagram' | null>(null);
  const [metaQuery, setMetaQuery] = useState('');
  const [metaAds, setMetaAds] = useState<{ id: string; page_name: string; snapshot_url: string; body: string | null }[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState('');

  // delete confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // toggling flags
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const firstInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      const res = await adminApi.getShoppingProducts(params);
      setProducts(res.data);
    } catch {
      // handled by empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, [search]);

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditProduct(null);
    setForm({ ...emptyForm });
    setImageFile(null);
    setImagePreview('');
    setExtraImages([]);
    setVariants([]);
    setSpecs([]);
    setModalError('');
    setShowModal(true);
    setTimeout(() => firstInputRef.current?.focus(), 80);
  };

  const openEdit = (p: ShoppingProduct) => {
    setEditProduct(p);
    setForm({
      name: p.name,
      description: p.description || '',
      cost_price: p.cost_price ? String(p.cost_price) : '',
      price: String(p.price),
      sku: p.sku || '',
      image_url: p.image_url || '',
      video_url: p.video_url || '',
      source_url: p.source_url || '',
      category_name: p.category_name || '',
      is_featured: p.is_featured,
      is_trending: p.is_trending,
      is_active: p.is_active,
      winning_score: p.winning_score != null ? String(p.winning_score) : '',
      trend_percent: p.trend_percent != null ? String(p.trend_percent) : '',
      competition_level: p.competition_level || '',
      saturation_level: p.saturation_level || '',
      orders_count: p.orders_count != null ? String(p.orders_count) : '',
      supplier_name: p.supplier_name || '',
      supplier_rating: p.supplier_rating != null ? String(p.supplier_rating) : '',
      processing_time: p.processing_time || '',
      shipping_time: p.shipping_time || '',
      warehouse_country: p.warehouse_country || '',
      ad_facebook_url: p.ad_facebook_url || '',
      ad_tiktok_url: p.ad_tiktok_url || '',
      ad_instagram_url: p.ad_instagram_url || '',
      ad_pinterest_url: p.ad_pinterest_url || '',
      tags: p.tags || '',
    });
    setImageFile(null);
    setImagePreview(p.image_url || '');
    setExtraImages((p.images || []).filter((u) => u !== p.image_url));
    setVariants((p.variants || []).map((v) => ({ color: v.color || '', color_hex: v.color_hex || '' })));
    try {
      const parsed = p.specs_json ? JSON.parse(p.specs_json) : {};
      setSpecs(Object.entries(parsed).map(([key, value]) => ({ key, value: String(value) })));
    } catch { setSpecs([]); }
    setModalError('');
    setShowModal(true);
    setTimeout(() => firstInputRef.current?.focus(), 80);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) {
      setModalError('Product name and selling price are required.');
      return;
    }
    setSaving(true);
    setModalError('');
    try {
      let imageUrl = form.image_url || null;

      // Upload image first if a new file was selected
      if (imageFile) {
        setUploadingImage(true);
        try {
          const uploadRes = await adminApi.uploadShoppingImage(imageFile);
          imageUrl = uploadRes.data.url;
        } catch {
          setModalError('Image upload failed. Please try again.');
          setSaving(false);
          setUploadingImage(false);
          return;
        }
        setUploadingImage(false);
      }

      const specsObj = specs.filter((s) => s.key.trim()).reduce((acc, s) => ({ ...acc, [s.key.trim()]: s.value }), {} as Record<string, string>);

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: parseFloat(form.price),
        cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
        sku: form.sku.trim() || null,
        image_url: imageUrl,
        video_url: form.video_url.trim() || null,
        source_url: form.source_url.trim() || null,
        category_name: form.category_name.trim() || null,
        is_featured: form.is_featured,
        is_trending: form.is_trending,
        is_active: form.is_active,
        images: [imageUrl, ...extraImages].filter((u): u is string => !!u),
        variants: variants.filter((v) => v.color.trim()).map((v) => ({ color: v.color.trim(), color_hex: v.color_hex || null })),
        winning_score: form.winning_score ? parseInt(form.winning_score, 10) : null,
        trend_percent: form.trend_percent ? parseFloat(form.trend_percent) : null,
        competition_level: form.competition_level || null,
        saturation_level: form.saturation_level || null,
        orders_count: form.orders_count ? parseInt(form.orders_count, 10) : null,
        supplier_name: form.supplier_name.trim() || null,
        supplier_rating: form.supplier_rating ? parseFloat(form.supplier_rating) : null,
        processing_time: form.processing_time.trim() || null,
        shipping_time: form.shipping_time.trim() || null,
        warehouse_country: form.warehouse_country.trim() || null,
        ad_facebook_url: form.ad_facebook_url.trim() || null,
        ad_tiktok_url: form.ad_tiktok_url.trim() || null,
        ad_instagram_url: form.ad_instagram_url.trim() || null,
        ad_pinterest_url: form.ad_pinterest_url.trim() || null,
        specs_json: Object.keys(specsObj).length ? JSON.stringify(specsObj) : null,
        tags: form.tags.trim() || null,
      };
      if (editProduct) {
        await adminApi.updateShoppingProduct(editProduct.id, payload);
      } else {
        await adminApi.createShoppingProduct(payload);
      }
      setShowModal(false);
      await fetchProducts();
    } catch (err: any) {
      setModalError(err?.response?.data?.detail || 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  const runMetaSearch = async () => {
    if (!metaQuery.trim()) return;
    setMetaLoading(true);
    setMetaError('');
    setMetaAds([]);
    try {
      const res = await adminApi.metaAdsSearch(metaQuery.trim());
      setMetaAds(res.data?.ads ?? []);
    } catch (err: any) {
      setMetaError(err?.response?.data?.detail?.message ?? err?.response?.data?.detail ?? 'Meta Ad Library search failed.');
    } finally {
      setMetaLoading(false);
    }
  };

  const pickMetaAd = (url: string) => {
    if (showMetaSearch === 'facebook') setForm((f) => ({ ...f, ad_facebook_url: url }));
    if (showMetaSearch === 'instagram') setForm((f) => ({ ...f, ad_instagram_url: url }));
    setShowMetaSearch(null);
    setMetaAds([]);
    setMetaQuery('');
  };

  // ── Quick toggles ──────────────────────────────────────────────────────────

  const toggle = async (product: ShoppingProduct, field: 'is_trending' | 'is_featured' | 'is_active') => {
    setTogglingId(product.id);
    try {
      await adminApi.updateShoppingProduct(product.id, { [field]: !product[field] });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, [field]: !p[field] } : p))
      );
    } finally {
      setTogglingId(null);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await adminApi.deleteShoppingProduct(deleteId);
      setDeleteId(null);
      await fetchProducts();
    } finally {
      setDeleting(false);
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────

  const trending = products.filter((p) => p.is_trending).length;
  const featured = products.filter((p) => p.is_featured).length;
  const active = products.filter((p) => p.is_active).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#6B3FD9]" />
            Prodora Products
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Products you add here appear on the Prodora dropshipping storefront
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://prodora.exiuscart.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-[#6B3FD9]/50 transition text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Preview Prodora
          </a>
          <button
            type="button"
            onClick={() => setShowCjModal(true)}
            className="inline-flex items-center gap-2 bg-[#0B1121] border border-gray-700 hover:border-[#6B3FD9]/50 text-white font-semibold px-4 py-2.5 rounded-lg transition"
          >
            <ShoppingBag className="w-4 h-4 text-[#6B3FD9]" />
            {cjConnected ? 'Import from CJ' : 'Connect CJ'}
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold px-4 py-2.5 rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      {showCjModal && (
        <CJImportModal
          connected={cjConnected}
          onClose={() => setShowCjModal(false)}
          onConnected={() => setCjConnected(true)}
          onImported={fetchProducts}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Products" value={String(products.length)} icon={<Package className="w-5 h-5" />} />
        <StatCard label="Trending" value={String(trending)} icon={<Flame className="w-5 h-5" />} accent="orange" />
        <StatCard label="Featured" value={String(featured)} icon={<Star className="w-5 h-5" />} accent="yellow" />
        <StatCard label="Active / Visible" value={String(active)} icon={<Eye className="w-5 h-5" />} accent="green" />
      </div>

      {/* Search */}
      <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4 mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search dropshipping products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:border-[#6B3FD9] focus:outline-none text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#151F32] rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-[#6B3FD9]" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <TrendingUp className="w-12 h-12 mb-2 opacity-30" />
            <p className="text-sm">No dropshipping products yet</p>
            <button
              type="button"
              onClick={openAdd}
              className="mt-3 text-sm text-[#6B3FD9] hover:underline"
            >
              Add your first product
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-800 uppercase tracking-wider">
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium text-right">Buying Price</th>
                    <th className="px-4 py-3 font-medium text-right">Selling Price</th>
                    <th className="px-4 py-3 font-medium text-center">Margin</th>
                    <th className="px-4 py-3 font-medium text-center">Flags</th>
                    <th className="px-4 py-3 font-medium text-center">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {products.map((p) => {
                    const margin = p.cost_price && p.price > p.cost_price
                      ? Math.round(((p.price - p.cost_price) / p.price) * 100)
                      : null;
                    return (
                      <tr key={p.id} className="hover:bg-[#0B1121]/50 transition">
                        {/* Product */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-[#0B1121] border border-gray-800 flex-shrink-0 overflow-hidden">
                              {p.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="w-5 h-5 text-gray-600" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-white text-sm truncate max-w-[200px]">{p.name}</p>
                              {p.category_name && (
                                <span className="inline-flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                  <Tag className="w-3 h-3" /> {p.category_name}
                                </span>
                              )}
                              {p.sku && <p className="text-xs text-gray-600 mt-0.5">SKU: {p.sku}</p>}
                            </div>
                          </div>
                        </td>

                        {/* Buying price */}
                        <td className="px-4 py-4 text-right">
                          {p.cost_price ? (
                            <span className="text-sm text-gray-400">
                              {p.cost_price.toFixed(2)} <span className="text-xs text-gray-600">{p.currency}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-700">—</span>
                          )}
                        </td>

                        {/* Selling price */}
                        <td className="px-4 py-4 text-right">
                          <span className="text-sm font-semibold text-[#6B3FD9]">
                            {p.price.toFixed(2)} <span className="text-xs font-normal text-gray-500">{p.currency}</span>
                          </span>
                        </td>

                        {/* Margin */}
                        <td className="px-4 py-4 text-center">
                          {margin !== null ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                              {margin}%
                            </span>
                          ) : (
                            <span className="text-xs text-gray-700">—</span>
                          )}
                        </td>

                        {/* Flags */}
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-1">
                            <QuickToggle
                              active={p.is_trending}
                              onClick={() => toggle(p, 'is_trending')}
                              icon={<Flame className="w-4 h-4" />}
                              title={p.is_trending ? 'Remove Trending' : 'Mark Trending'}
                            />
                            <QuickToggle
                              active={p.is_featured}
                              onClick={() => toggle(p, 'is_featured')}
                              icon={<Star className="w-4 h-4" />}
                              title={p.is_featured ? 'Remove Featured' : 'Mark Featured'}
                            />
                            {togglingId === p.id && <Loader2 className="w-3 h-3 animate-spin text-gray-500" />}
                          </div>
                        </td>

                        {/* Active */}
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggle(p, 'is_active')}
                            className={`text-xs px-2.5 py-1 rounded-full border font-medium transition ${
                              p.is_active
                                ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                                : 'bg-gray-500/10 text-gray-500 border-gray-700 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20'
                            }`}
                          >
                            {p.is_active ? 'Active' : 'Hidden'}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(p)}
                              className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteId(p.id)}
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-800">
              {products.map((p) => (
                <div key={p.id} className="p-4 flex gap-3">
                  <div className="w-14 h-14 rounded-xl bg-[#0B1121] border border-gray-800 flex-shrink-0 overflow-hidden">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-6 h-6 text-gray-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-white text-sm truncate">{p.name}</p>
                      <span className="text-sm font-bold text-[#6B3FD9] flex-shrink-0">
                        {p.price.toFixed(2)} {p.currency}
                      </span>
                    </div>
                    {p.cost_price && (
                      <p className="text-xs text-gray-500 mt-0.5">Cost: {p.cost_price.toFixed(2)}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {p.is_trending && <Badge label="🔥 Trending" color="bg-orange-500/10 text-orange-400 border-orange-500/20" />}
                      {p.is_featured && <Badge label="⭐ Featured" color="bg-yellow-500/10 text-yellow-400 border-yellow-500/20" />}
                      {!p.is_active && <Badge label="Hidden" color="bg-gray-700 text-gray-400 border-gray-600" />}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button type="button" onClick={() => openEdit(p)} className="p-1.5 text-gray-500 hover:text-white rounded-lg">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => setDeleteId(p.id)} className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#151F32] rounded-2xl border border-gray-800 w-full max-w-xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="sticky top-0 bg-[#151F32] flex items-center justify-between px-5 py-4 border-b border-gray-800 z-10">
              <h2 className="text-lg font-semibold text-white">
                {editProduct ? 'Edit Dropshipping Product' : 'Add Dropshipping Product'}
              </h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              {modalError && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {modalError}
                </div>
              )}

              {/* Product Image Upload */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Product Image</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative cursor-pointer group border-2 border-dashed border-gray-700 hover:border-[#6B3FD9]/60 rounded-xl transition overflow-hidden"
                  style={{ minHeight: '160px' }}
                >
                  {imagePreview ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-40 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <div className="text-white text-sm font-medium flex items-center gap-2">
                          <Upload className="w-4 h-4" /> Change Image
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-500 group-hover:text-gray-400 transition">
                      <ImageIcon className="w-10 h-10 opacity-40" />
                      <div className="text-center">
                        <p className="text-sm font-medium">Click to upload image</p>
                        <p className="text-xs mt-0.5">JPG, PNG, WEBP · Max 10 MB</p>
                      </div>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
                {imagePreview && (
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); setImagePreview(''); setForm(f => ({ ...f, image_url: '' })); }}
                    className="mt-1 text-xs text-gray-500 hover:text-red-400 transition"
                  >
                    Remove image
                  </button>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Product Name *</label>
                <input
                  ref={firstInputRef}
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Wireless Earbuds Pro"
                  className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:border-[#6B3FD9] focus:outline-none text-sm"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the product for buyers..."
                  rows={3}
                  className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:border-[#6B3FD9] focus:outline-none text-sm resize-none"
                />
              </div>

              {/* Buying Price + Selling Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">
                    Buying Price <span className="text-xs text-gray-600">(USD · your cost)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.cost_price}
                      onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:border-[#6B3FD9] focus:outline-none text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">
                    Selling Price * <span className="text-xs text-gray-600">(USD · shown publicly)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:border-[#6B3FD9] focus:outline-none text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Margin preview */}
              {form.cost_price && form.price && parseFloat(form.price) > parseFloat(form.cost_price) && (
                <div className="px-3 py-2 bg-green-500/5 border border-green-500/20 rounded-lg flex items-center justify-between">
                  <span className="text-xs text-gray-400">Profit margin</span>
                  <span className="text-sm font-bold text-green-400">
                    {Math.round(((parseFloat(form.price) - parseFloat(form.cost_price)) / parseFloat(form.price)) * 100)}%
                    &nbsp;·&nbsp;
                    +{(parseFloat(form.price) - parseFloat(form.cost_price)).toFixed(2)} per sale
                  </span>
                </div>
              )}

              {/* Category + SKU */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Category</label>
                  <input
                    type="text"
                    value={form.category_name}
                    onChange={(e) => setForm((f) => ({ ...f, category_name: e.target.value }))}
                    placeholder="e.g. Electronics, Fashion"
                    className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:border-[#6B3FD9] focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">
                    SKU
                    <span className="ml-1 text-xs text-gray-600">(product code)</span>
                  </label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                    placeholder="e.g. WBT-BLK-001"
                    className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:border-[#6B3FD9] focus:outline-none text-sm"
                  />
                </div>
              </div>

              {/* Video URL */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">
                  Video URL
                  <span className="ml-2 text-xs text-gray-600">optional · product promo video</span>
                </label>
                <input
                  type="url"
                  value={form.video_url}
                  onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
                  placeholder="https://... (MP4, YouTube, TikTok)"
                  className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:border-[#6B3FD9] focus:outline-none text-sm"
                />
              </div>

              {/* Source / Supplier Link */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">
                  Supplier / Source Link
                  <span className="ml-2 text-xs text-gray-600">where dropshippers can find &amp; order this product</span>
                </label>
                <input
                  type="url"
                  value={form.source_url}
                  onChange={(e) => setForm((f) => ({ ...f, source_url: e.target.value }))}
                  placeholder="https://aliexpress.com/... or CJ, Temu, etc."
                  className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:border-[#6B3FD9] focus:outline-none text-sm"
                />
              </div>

              {/* Gallery images (beyond the primary upload above) */}
              <div className="border border-gray-800 rounded-xl p-4 bg-[#0B1121]/40 space-y-2">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Extra Gallery Images</p>
                <p className="text-xs text-gray-600 -mt-1">Optional — paste more image URLs for the product gallery, in addition to the primary image above.</p>
                {extraImages.map((url, i) => (
                  <div key={i} className="flex gap-2">
                    <input type="url" value={url}
                      onChange={(e) => setExtraImages((arr) => arr.map((u, j) => j === i ? e.target.value : u))}
                      placeholder="https://..."
                      className="flex-1 px-3 py-2 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:border-[#6B3FD9] focus:outline-none text-sm" />
                    <button type="button" onClick={() => setExtraImages((arr) => arr.filter((_, j) => j !== i))}
                      className="px-2 text-gray-500 hover:text-red-400"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setExtraImages((arr) => [...arr, ''])}
                  className="text-xs text-[#6B3FD9] hover:underline">+ Add image URL</button>
              </div>

              {/* Variants (color swatches) */}
              <div className="border border-gray-800 rounded-xl p-4 bg-[#0B1121]/40 space-y-2">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Variants</p>
                <p className="text-xs text-gray-600 -mt-1">Optional — informational color swatches shown on the product page (not stock-managed).</p>
                {variants.map((v, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input type="text" value={v.color}
                      onChange={(e) => setVariants((arr) => arr.map((x, j) => j === i ? { ...x, color: e.target.value } : x))}
                      placeholder="e.g. Black"
                      className="flex-1 px-3 py-2 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:border-[#6B3FD9] focus:outline-none text-sm" />
                    <input type="color" value={v.color_hex || '#888888'}
                      onChange={(e) => setVariants((arr) => arr.map((x, j) => j === i ? { ...x, color_hex: e.target.value } : x))}
                      className="w-9 h-9 rounded border border-gray-700 bg-[#0B1121] cursor-pointer" />
                    <button type="button" onClick={() => setVariants((arr) => arr.filter((_, j) => j !== i))}
                      className="px-2 text-gray-500 hover:text-red-400"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setVariants((arr) => [...arr, { color: '', color_hex: '' }])}
                  className="text-xs text-[#6B3FD9] hover:underline">+ Add variant</button>
              </div>

              {/* Market Data — real, admin-entered; blank = hidden on the product page */}
              <div className="border border-gray-800 rounded-xl p-4 bg-[#0B1121]/40 space-y-3">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Market Data</p>
                <p className="text-xs text-gray-600 -mt-2">Optional. Leave blank to hide the Winning Analytics block entirely for this product.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Winning Score (0-100)</label>
                    <input type="number" min="0" max="100" value={form.winning_score}
                      onChange={(e) => setForm((f) => ({ ...f, winning_score: e.target.value }))}
                      className="w-full px-3 py-2 bg-[#0B1121] border border-gray-700 rounded-lg text-white text-sm focus:border-[#6B3FD9] focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Trend %</label>
                    <input type="number" step="0.01" value={form.trend_percent}
                      onChange={(e) => setForm((f) => ({ ...f, trend_percent: e.target.value }))}
                      placeholder="e.g. 68"
                      className="w-full px-3 py-2 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 text-sm focus:border-[#6B3FD9] focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Competition</label>
                    <select value={form.competition_level}
                      onChange={(e) => setForm((f) => ({ ...f, competition_level: e.target.value }))}
                      className="w-full px-3 py-2 bg-[#0B1121] border border-gray-700 rounded-lg text-white text-sm focus:border-[#6B3FD9] focus:outline-none">
                      <option value="">—</option>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Saturation</label>
                    <select value={form.saturation_level}
                      onChange={(e) => setForm((f) => ({ ...f, saturation_level: e.target.value }))}
                      className="w-full px-3 py-2 bg-[#0B1121] border border-gray-700 rounded-lg text-white text-sm focus:border-[#6B3FD9] focus:outline-none">
                      <option value="">—</option>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Orders (social proof count)</label>
                    <input type="number" min="0" value={form.orders_count}
                      onChange={(e) => setForm((f) => ({ ...f, orders_count: e.target.value }))}
                      className="w-full px-3 py-2 bg-[#0B1121] border border-gray-700 rounded-lg text-white text-sm focus:border-[#6B3FD9] focus:outline-none" />
                  </div>
                </div>
              </div>

              {/* Supplier Info */}
              <div className="border border-gray-800 rounded-xl p-4 bg-[#0B1121]/40 space-y-3">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Supplier Info</p>
                <p className="text-xs text-gray-600 -mt-2">Auto-filled when importing from CJ. Optional otherwise — leave blank to hide this block.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Supplier Name</label>
                    <input type="text" value={form.supplier_name}
                      onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))}
                      className="w-full px-3 py-2 bg-[#0B1121] border border-gray-700 rounded-lg text-white text-sm focus:border-[#6B3FD9] focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Supplier Rating (0-5)</label>
                    <input type="number" min="0" max="5" step="0.1" value={form.supplier_rating}
                      onChange={(e) => setForm((f) => ({ ...f, supplier_rating: e.target.value }))}
                      className="w-full px-3 py-2 bg-[#0B1121] border border-gray-700 rounded-lg text-white text-sm focus:border-[#6B3FD9] focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Processing Time</label>
                    <input type="text" value={form.processing_time}
                      onChange={(e) => setForm((f) => ({ ...f, processing_time: e.target.value }))}
                      placeholder="e.g. 1-3 Days"
                      className="w-full px-3 py-2 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 text-sm focus:border-[#6B3FD9] focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Shipping Time</label>
                    <input type="text" value={form.shipping_time}
                      onChange={(e) => setForm((f) => ({ ...f, shipping_time: e.target.value }))}
                      placeholder="e.g. 7-12 Days"
                      className="w-full px-3 py-2 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 text-sm focus:border-[#6B3FD9] focus:outline-none" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Warehouse Country</label>
                    <input type="text" value={form.warehouse_country}
                      onChange={(e) => setForm((f) => ({ ...f, warehouse_country: e.target.value }))}
                      placeholder="e.g. US Warehouse"
                      className="w-full px-3 py-2 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 text-sm focus:border-[#6B3FD9] focus:outline-none" />
                  </div>
                </div>
              </div>

              {/* Social Proof Links */}
              <div className="border border-gray-800 rounded-xl p-4 bg-[#0B1121]/40 space-y-3">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Social Proof Links</p>
                <p className="text-xs text-gray-600 -mt-2">Optional — link to a real running ad per platform. Facebook/Instagram can be searched live from Meta&apos;s Ad Library.</p>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500">Facebook Ad URL</label>
                    <button type="button" onClick={() => { setShowMetaSearch('facebook'); setMetaAds([]); setMetaError(''); }}
                      className="text-xs text-[#6B3FD9] hover:underline">Search Meta Ads</button>
                  </div>
                  <input type="url" value={form.ad_facebook_url}
                    onChange={(e) => setForm((f) => ({ ...f, ad_facebook_url: e.target.value }))}
                    placeholder="https://www.facebook.com/ads/library/?id=..."
                    className="w-full px-3 py-2 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 text-sm focus:border-[#6B3FD9] focus:outline-none" />
                  {showMetaSearch === 'facebook' && (
                    <MetaAdSearchPanel query={metaQuery} setQuery={setMetaQuery} ads={metaAds} loading={metaLoading}
                      error={metaError} onSearch={runMetaSearch} onPick={pickMetaAd} onClose={() => setShowMetaSearch(null)} />
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500">Instagram Ad URL</label>
                    <button type="button" onClick={() => { setShowMetaSearch('instagram'); setMetaAds([]); setMetaError(''); }}
                      className="text-xs text-[#6B3FD9] hover:underline">Search Meta Ads</button>
                  </div>
                  <input type="url" value={form.ad_instagram_url}
                    onChange={(e) => setForm((f) => ({ ...f, ad_instagram_url: e.target.value }))}
                    placeholder="https://www.facebook.com/ads/library/?id=..."
                    className="w-full px-3 py-2 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 text-sm focus:border-[#6B3FD9] focus:outline-none" />
                  {showMetaSearch === 'instagram' && (
                    <MetaAdSearchPanel query={metaQuery} setQuery={setMetaQuery} ads={metaAds} loading={metaLoading}
                      error={metaError} onSearch={runMetaSearch} onPick={pickMetaAd} onClose={() => setShowMetaSearch(null)} />
                  )}
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">TikTok Ad URL</label>
                  <input type="url" value={form.ad_tiktok_url}
                    onChange={(e) => setForm((f) => ({ ...f, ad_tiktok_url: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 text-sm focus:border-[#6B3FD9] focus:outline-none" />
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Pinterest Pin URL</label>
                  <input type="url" value={form.ad_pinterest_url}
                    onChange={(e) => setForm((f) => ({ ...f, ad_pinterest_url: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 text-sm focus:border-[#6B3FD9] focus:outline-none" />
                </div>
              </div>

              {/* Specs & Tags */}
              <div className="border border-gray-800 rounded-xl p-4 bg-[#0B1121]/40 space-y-3">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Specs &amp; Tags</p>
                <div className="space-y-2">
                  {specs.map((s, i) => (
                    <div key={i} className="flex gap-2">
                      <input type="text" value={s.key}
                        onChange={(e) => setSpecs((arr) => arr.map((x, j) => j === i ? { ...x, key: e.target.value } : x))}
                        placeholder="Material" className="w-1/3 px-3 py-2 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 text-sm focus:border-[#6B3FD9] focus:outline-none" />
                      <input type="text" value={s.value}
                        onChange={(e) => setSpecs((arr) => arr.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                        placeholder="Stainless Steel" className="flex-1 px-3 py-2 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 text-sm focus:border-[#6B3FD9] focus:outline-none" />
                      <button type="button" onClick={() => setSpecs((arr) => arr.filter((_, j) => j !== i))}
                        className="px-2 text-gray-500 hover:text-red-400"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setSpecs((arr) => [...arr, { key: '', value: '' }])}
                    className="text-xs text-[#6B3FD9] hover:underline">+ Add spec</button>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Feature Tags (comma-separated)</label>
                  <input type="text" value={form.tags}
                    onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                    placeholder="BPA Free, Leak Proof, Eco Friendly"
                    className="w-full px-3 py-2 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 text-sm focus:border-[#6B3FD9] focus:outline-none" />
                </div>
              </div>

              {/* Flags */}
              <div className="space-y-3 border border-gray-800 rounded-xl p-4 bg-[#0B1121]/40">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">Visibility & Flags</p>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-300 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-400" /> Mark as Trending
                  </span>
                  <Toggle on={form.is_trending} onChange={() => setForm((f) => ({ ...f, is_trending: !f.is_trending }))} color="bg-orange-500" />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-300 flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-400" /> Mark as Featured
                  </span>
                  <Toggle on={form.is_featured} onChange={() => setForm((f) => ({ ...f, is_featured: !f.is_featured }))} color="bg-yellow-500" />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-300 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-green-400" /> Active (visible on storefront)
                  </span>
                  <Toggle on={form.is_active} onChange={() => setForm((f) => ({ ...f, is_active: !f.is_active }))} color="bg-green-500" />
                </label>
              </div>

              {/* Save button */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 rounded-xl text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {uploadingImage ? 'Uploading image...' : 'Saving...'}
                    </>
                  ) : (
                    <><Check className="w-4 h-4" /> {editProduct ? 'Save Changes' : 'Add Product'}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ─────────────────────────────────────────── */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#151F32] rounded-2xl border border-gray-800 w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Delete Product?</h3>
            <p className="text-sm text-gray-400 mb-6">
              This product will be permanently removed from the dropshipping storefront.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 border border-gray-700 text-gray-400 hover:text-white rounded-xl text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label, value, icon, accent,
}: {
  label: string; value: string; icon: React.ReactNode; accent?: 'orange' | 'yellow' | 'red' | 'green';
}) {
  const colorMap = {
    orange: 'bg-orange-500/10 text-orange-400',
    yellow: 'bg-yellow-500/10 text-yellow-400',
    red: 'bg-red-500/10 text-red-400',
    green: 'bg-green-500/10 text-green-400',
  };
  const iconColor = accent ? colorMap[accent] : 'bg-[#6B3FD9]/10 text-[#6B3FD9]';
  return (
    <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${iconColor}`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}
