'use client';

import { useState, useEffect } from 'react';
import { Plus, X, Loader2, Trash2, Edit2, Upload, Search, AlertCircle, Download, Users } from 'lucide-react';
import { adminApi } from '@/lib/api';

interface Bundle {
  id: number;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  editable_file_url: string | null;
  pdf_file_url: string | null;
  price: number;
  suggested_resale_price: number | null;
  resale_notes: string | null;
  ad_facebook_url: string | null;
  ad_tiktok_url: string | null;
  ad_instagram_url: string | null;
  ad_pinterest_url: string | null;
  whop_checkout_url: string | null;
  whop_product_id: string | null;
  is_active: boolean;
  is_trending?: boolean;
  is_bestseller?: boolean;
  purchase_count: number;
}

const emptyForm = {
  name: '', description: '', cover_image_url: '', editable_file_url: '', pdf_file_url: '',
  price: '', suggested_resale_price: '', resale_notes: '',
  ad_facebook_url: '', ad_tiktok_url: '', ad_instagram_url: '', ad_pinterest_url: '',
  whop_checkout_url: '', whop_product_id: '', is_active: true, is_trending: false, is_bestseller: false,
};

// ── Meta Ad Library search — same shared backend as the Prodora winning-
// products screen, just its own copy here (this codebase's own convention
// is per-file components, not a shared lib, see MetaAdSearchPanel in
// dashboard/shopping/page.tsx).
function MetaAdSearchPanel({ query, setQuery, onPick, onClose }: {
  query: string; setQuery: (v: string) => void; onPick: (url: string) => void; onClose: () => void;
}) {
  const [ads, setAds] = useState<{ id: string; page_name: string; snapshot_url: string; body: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const runSearch = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(''); setHasSearched(true);
    try {
      const r = await adminApi.metaAdsSearch(query.trim());
      setAds(r.data?.ads ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.detail?.message ?? e?.response?.data?.detail ?? 'Meta Ad Library search failed.');
    } finally { setLoading(false); }
  };

  return (
    <div className="mt-2 p-3 bg-gray-50 border border-gray-300 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-600">Search real ads on Meta Ad Library</p>
        <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-900"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="flex gap-2">
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } }}
          placeholder="Search by product or brand name…"
          className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-600 text-sm focus:border-[#6B3FD9] focus:outline-none" />
        <button type="button" onClick={runSearch} disabled={loading}
          className="px-3 py-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white rounded-lg text-sm font-medium disabled:opacity-60 flex items-center gap-1.5">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </button>
      </div>
      {error && (
        <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
        </div>
      )}
      {ads.length > 0 && (
        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {ads.map((ad) => (
            <button key={ad.id} type="button" onClick={() => onPick(ad.snapshot_url)}
              className="w-full text-left px-3 py-2 bg-white hover:bg-gray-200 border border-gray-200 rounded-lg transition">
              <p className="text-xs font-medium text-gray-900 truncate">{ad.page_name || 'Unknown advertiser'}</p>
              {ad.body && <p className="text-xs text-gray-500 truncate mt-0.5">{ad.body}</p>}
            </button>
          ))}
        </div>
      )}
      {!loading && !error && ads.length === 0 && hasSearched && (
        <p className="text-xs text-gray-500">No ads found for &ldquo;{query}&rdquo;. Try a different keyword.</p>
      )}
    </div>
  );
}

function FlagRow({ label, on, color, onChange }: { label: string; on: boolean; color: string; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <button type="button" onClick={onChange} aria-pressed={on} className={`flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${on ? color : 'bg-gray-200'}`}>
        <span className={`mx-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </label>
  );
}

export default function DigitalBundlesPage() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingEditable, setUploadingEditable] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [showMetaSearch, setShowMetaSearch] = useState<'facebook' | 'instagram' | null>(null);
  const [metaQuery, setMetaQuery] = useState('');
  const [grantTarget, setGrantTarget] = useState<Bundle | null>(null);
  const [grantShopId, setGrantShopId] = useState('');
  const [granting, setGranting] = useState(false);
  const [pushingWhop, setPushingWhop] = useState(false);
  const [pushWhopError, setPushWhopError] = useState('');

  const load = () => {
    setLoading(true);
    adminApi.listDigitalBundles().then((r) => setBundles(r.data?.bundles ?? [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const [deepLinkDone, setDeepLinkDone] = useState(false);
  useEffect(() => {
    if (deepLinkDone || loading) return;
    const params = new URLSearchParams(window.location.search);
    const edit = params.get('edit');
    if (params.get('add') === '1') {
      openCreate();
    } else if (edit) {
      const target = bundles.find((b) => String(b.id) === edit);
      if (target) openEdit(target);
    }
    setDeepLinkDone(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, bundles, deepLinkDone]);

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowForm(true); setError(''); };
  const openEdit = (b: Bundle) => {
    setEditingId(b.id);
    setForm({
      ...b,
      price: String(b.price), suggested_resale_price: b.suggested_resale_price != null ? String(b.suggested_resale_price) : '',
      description: b.description ?? '', cover_image_url: b.cover_image_url ?? '',
      editable_file_url: b.editable_file_url ?? '', pdf_file_url: b.pdf_file_url ?? '',
      resale_notes: b.resale_notes ?? '',
      ad_facebook_url: b.ad_facebook_url ?? '', ad_tiktok_url: b.ad_tiktok_url ?? '',
      ad_instagram_url: b.ad_instagram_url ?? '', ad_pinterest_url: b.ad_pinterest_url ?? '',
      whop_checkout_url: b.whop_checkout_url ?? '', whop_product_id: b.whop_product_id ?? '',
    });
    setShowForm(true); setError('');
  };

  const handleFileUpload = async (file: File, kind: 'editable' | 'pdf') => {
    const setUploading = kind === 'editable' ? setUploadingEditable : setUploadingPdf;
    setUploading(true);
    try {
      const r = await adminApi.uploadBundleFile(file);
      setForm((f: any) => ({ ...f, [kind === 'editable' ? 'editable_file_url' : 'pdf_file_url']: r.data?.url ?? '' }));
    } catch (e: any) {
      setError('File upload failed.');
    } finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) { setError('Name and price are required.'); return; }
    setSaving(true); setError('');
    const payload = {
      ...form,
      price: parseFloat(form.price) || 0,
      suggested_resale_price: form.suggested_resale_price ? parseFloat(form.suggested_resale_price) : null,
    };
    try {
      if (editingId) await adminApi.updateDigitalBundle(editingId, payload);
      else await adminApi.createDigitalBundle(payload);
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.detail?.message ?? e?.response?.data?.detail ?? 'Save failed.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this bundle? Sellers who already bought it keep their purchase record, but the files will no longer be accessible.')) return;
    await adminApi.deleteDigitalBundle(id);
    load();
  };

  const handlePushToWhop = async () => {
    if (!editingId) return;
    setPushingWhop(true); setPushWhopError('');
    try {
      const r = await adminApi.pushBundleToWhop(editingId);
      setForm((f: any) => ({
        ...f,
        whop_checkout_url: r.data?.whop_checkout_url || f.whop_checkout_url,
        whop_product_id: r.data?.whop_product_id || f.whop_product_id,
      }));
      load();
    } catch (e: any) {
      setPushWhopError(e?.response?.data?.detail ?? 'Could not push to Whop.');
    } finally { setPushingWhop(false); }
  };

  const handleGrant = async () => {
    if (!grantTarget || !grantShopId.trim()) return;
    setGranting(true);
    try {
      await adminApi.grantBundlePurchase(grantTarget.id, parseInt(grantShopId, 10));
      setGrantTarget(null); setGrantShopId('');
      load();
    } catch { /* noop */ } finally { setGranting(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Digital Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">Design packs ExiusCart sells to sellers through Prodora, such as coloring books and POD design sets. Each one is also listed in All Products with a DG ID.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2.5 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Digital Product
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
      ) : bundles.length === 0 ? (
        <div className="text-center py-20 text-gray-500 text-sm">No bundles yet — create your first one.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bundles.map((b) => (
            <div key={b.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="relative aspect-video bg-gray-50">
                {b.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.cover_image_url} alt={b.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Download className="w-8 h-8 text-gray-300" /></div>
                )}
                {!b.is_active && <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">Inactive</span>}
              </div>
              <div className="p-4 space-y-2">
                <p className="font-medium text-gray-900 truncate">{b.name}</p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>${b.price.toFixed(2)} → resell ${b.suggested_resale_price?.toFixed(2) ?? '—'}</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {b.purchase_count}</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => openEdit(b)} className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-100">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => setGrantTarget(b)} className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-100">
                    Grant access
                  </button>
                  <button onClick={() => handleDelete(b.id)} className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-red-600 hover:bg-red-500/10">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-gray-50 border border-gray-200 rounded-2xl w-full max-w-[1400px] max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 sticky top-0 bg-gray-50 z-10">
              <p className="font-semibold text-gray-900">{editingId ? 'Edit Bundle' : 'New Digital Bundle'}</p>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-900"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10 lg:gap-y-4 xl:p-8">
              {error && <div className="lg:col-span-2 bg-red-500/10 border border-red-500/30 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Name *</label>
                <input value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:border-[#6B3FD9] focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Description</label>
                <textarea value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} rows={3}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:border-[#6B3FD9] focus:outline-none resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Price to seller ($) *</label>
                  <input type="number" step="0.01" value={form.price} onChange={(e) => setForm((f: any) => ({ ...f, price: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:border-[#6B3FD9] focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Suggested resale price ($)</label>
                  <input type="number" step="0.01" value={form.suggested_resale_price} onChange={(e) => setForm((f: any) => ({ ...f, suggested_resale_price: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:border-[#6B3FD9] focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Where to sell / resale notes</label>
                <textarea value={form.resale_notes} onChange={(e) => setForm((f: any) => ({ ...f, resale_notes: e.target.value }))} rows={2}
                  placeholder="e.g. Great on Etsy and TikTok Shop, target parents 25-40…"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:border-[#6B3FD9] focus:outline-none resize-none" />
              </div>

              {/* Files */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Files</p>
                <div>
                  <label className="text-xs text-gray-500 mb-1 flex items-center justify-between">
                    <span>Editable source file</span>
                    {form.editable_file_url && <span className="text-green-600">Uploaded ✓</span>}
                  </label>
                  <label className="flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-600 hover:border-[#6B3FD9] cursor-pointer">
                    {uploadingEditable ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploadingEditable ? 'Uploading…' : 'Upload editable file (PSD, AI, ZIP…)'}
                    <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'editable')} />
                  </label>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 flex items-center justify-between">
                    <span>Finished PDF / ebook</span>
                    {form.pdf_file_url && <span className="text-green-600">Uploaded ✓</span>}
                  </label>
                  <label className="flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-600 hover:border-[#6B3FD9] cursor-pointer">
                    {uploadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploadingPdf ? 'Uploading…' : 'Upload finished PDF'}
                    <input type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'pdf')} />
                  </label>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Cover image URL</label>
                  <input value={form.cover_image_url} onChange={(e) => setForm((f: any) => ({ ...f, cover_image_url: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:border-[#6B3FD9] focus:outline-none" />
                </div>
              </div>

              {/* Ad proof */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Social Proof Links</p>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500">Facebook Ad URL</label>
                    <button type="button" onClick={() => { setShowMetaSearch('facebook'); setMetaQuery(form.name); }} className="text-xs text-[#6B3FD9] hover:underline">Search Meta Ads</button>
                  </div>
                  <input value={form.ad_facebook_url} onChange={(e) => setForm((f: any) => ({ ...f, ad_facebook_url: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:border-[#6B3FD9] focus:outline-none" />
                  {showMetaSearch === 'facebook' && (
                    <MetaAdSearchPanel query={metaQuery} setQuery={setMetaQuery}
                      onPick={(url) => { setForm((f: any) => ({ ...f, ad_facebook_url: url })); setShowMetaSearch(null); }}
                      onClose={() => setShowMetaSearch(null)} />
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500">Instagram Ad URL</label>
                    <button type="button" onClick={() => { setShowMetaSearch('instagram'); setMetaQuery(form.name); }} className="text-xs text-[#6B3FD9] hover:underline">Search Meta Ads</button>
                  </div>
                  <input value={form.ad_instagram_url} onChange={(e) => setForm((f: any) => ({ ...f, ad_instagram_url: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:border-[#6B3FD9] focus:outline-none" />
                  {showMetaSearch === 'instagram' && (
                    <MetaAdSearchPanel query={metaQuery} setQuery={setMetaQuery}
                      onPick={(url) => { setForm((f: any) => ({ ...f, ad_instagram_url: url })); setShowMetaSearch(null); }}
                      onClose={() => setShowMetaSearch(null)} />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">TikTok Ad URL</label>
                    <input value={form.ad_tiktok_url} onChange={(e) => setForm((f: any) => ({ ...f, ad_tiktok_url: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:border-[#6B3FD9] focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Pinterest Ad URL</label>
                    <input value={form.ad_pinterest_url} onChange={(e) => setForm((f: any) => ({ ...f, ad_pinterest_url: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:border-[#6B3FD9] focus:outline-none" />
                  </div>
                </div>
              </div>

              {/* Whop */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Whop Checkout</p>
                  {editingId && (
                    <button type="button" onClick={handlePushToWhop} disabled={pushingWhop}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white rounded-lg text-xs font-medium disabled:opacity-60">
                      {pushingWhop && <Loader2 className="w-3 h-3 animate-spin" />}
                      {pushingWhop ? 'Pushing…' : 'Push to Whop'}
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 -mt-2">
                  {editingId
                    ? 'Push to Whop creates or updates this product on ExiusCart’s own Whop account and fills in the fields below automatically. Or paste them in yourself if you’d rather create the product in Whop’s dashboard by hand.'
                    : 'Save this bundle first, then use "Push to Whop" here to create it on ExiusCart’s own Whop account — or create it manually in Whop’s dashboard and paste the checkout link and product ID below.'}
                </p>
                {pushWhopError && (
                  <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {pushWhopError}
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Whop checkout URL</label>
                  <input value={form.whop_checkout_url} onChange={(e) => setForm((f: any) => ({ ...f, whop_checkout_url: e.target.value }))}
                    placeholder="https://whop.com/checkout/..."
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:border-[#6B3FD9] focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Whop product/plan ID <span className="opacity-60">— used to auto-match webhook payments</span></label>
                  <input value={form.whop_product_id} onChange={(e) => setForm((f: any) => ({ ...f, whop_product_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:border-[#6B3FD9] focus:outline-none" />
                </div>
              </div>

              <div className="lg:col-span-2 space-y-3 rounded-xl border border-gray-200 bg-white p-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Visibility & Flags</p>
                  <p className="mt-1 text-xs text-gray-500">Choose where this product appears in Prodora.</p>
                </div>
                <FlagRow label="Show in Current Trends" on={!!form.is_trending} color="bg-orange-500" onChange={() => setForm((f: any) => ({ ...f, is_trending: !f.is_trending }))} />
                <FlagRow label="Show in Global Bestsellers" on={!!form.is_bestseller} color="bg-yellow-500" onChange={() => setForm((f: any) => ({ ...f, is_bestseller: !f.is_bestseller }))} />
                <FlagRow label="Active (visible to sellers)" on={!!form.is_active} color="bg-green-500" onChange={() => setForm((f: any) => ({ ...f, is_active: !f.is_active }))} />
              </div>

              <button onClick={handleSave} disabled={saving}
                className="lg:col-span-2 w-full py-2.5 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white rounded-lg text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Bundle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual grant */}
      {grantTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-50 border border-gray-200 rounded-2xl w-full max-w-sm p-5">
            <p className="font-semibold text-gray-900 mb-1">Grant &ldquo;{grantTarget.name}&rdquo;</p>
            <p className="text-xs text-gray-500 mb-4">Use this if a real Whop payment came in but wasn&apos;t auto-matched — check the backend logs for the shop_id it couldn&apos;t match.</p>
            <input type="number" value={grantShopId} onChange={(e) => setGrantShopId(e.target.value)} placeholder="Shop ID"
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm mb-3 focus:border-[#6B3FD9] focus:outline-none" />
            <div className="flex gap-2">
              <button onClick={() => setGrantTarget(null)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700">Cancel</button>
              <button onClick={handleGrant} disabled={granting} className="flex-1 py-2 bg-[#6B3FD9] rounded-lg text-sm text-white disabled:opacity-60">
                {granting ? 'Granting…' : 'Grant Access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
