'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Plus, LayoutGrid, Edit, Trash2, X, Loader2, ArrowUp, ArrowDown,
  ImageIcon, Upload, Link2, CornerDownRight, AlertCircle, Search, ChevronDown, ChevronRight,
  FolderTree, Layers3, Package, Globe, Copy, Check, Eye, Boxes, AlertTriangle, Star, Lock,
} from 'lucide-react';
import { channelsApi, type StorefrontCategoryPayload } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import ChannelLogo from '@/components/channel-listings/ChannelLogo';

type Visibility = 'nav_and_grid' | 'nav_only' | 'hidden';

interface StorefrontCategory {
  id: number;
  channel_type: string;
  name: string;
  slug: string;
  icon_url: string | null;
  sort_order: number;
  parent_id: number | null;
  product_count?: number;
  is_published?: boolean;
  visibility?: Visibility;
  is_featured?: boolean;
  seo_title?: string | null;
  seo_description?: string | null;
  updated_at?: string | null;
}

interface ReadOnlyCategory { id: string; name: string; parent_id: string | null }
interface Conn { id: number; channel_type: string; channel_api_url?: string | null }

// "Your own store" channels — editable here. Marketplace channels keep
// their own category systems on their side; shown read-only.
const EDITABLE_CHANNELS = [
  { value: 'custom', label: 'Custom Website' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'wix', label: 'Wix' },
  { value: 'woocommerce', label: 'WooCommerce' },
  { value: 'bigcommerce', label: 'BigCommerce' },
] as const;
const READONLY_CHANNELS = [
  { value: 'thedersi', label: 'TheDersi' },
  { value: 'daraz', label: 'Daraz' },
  { value: 'noon', label: 'Noon' },
  { value: 'ebay', label: 'eBay' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'walmart', label: 'Walmart' },
  { value: 'tiktok', label: 'TikTok Shop' },
  { value: 'trendyol', label: 'Trendyol' },
  { value: 'jumia', label: 'Jumia' },
] as const;
const ALL_CHANNELS = [...EDITABLE_CHANNELS, ...READONLY_CHANNELS];
const isReadOnly = (ct: string) => READONLY_CHANNELS.some(c => c.value === ct);

const VISIBILITY_LABEL: Record<Visibility, string> = {
  nav_and_grid: 'Visible in navigation and category grid',
  nav_only: 'Visible only in navigation',
  hidden: 'Hidden from storefront',
};

type Level = 'main' | 'sub' | 'subsub';
const EMPTY_FORM = { name: '', icon_url: '', level: 'main' as Level, mainId: '', subId: '', published: true };

function siblingsOf(list: StorefrontCategory[], parentId: number | null) {
  return list.filter(c => c.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order);
}
function siteHost(url?: string | null): string {
  if (!url) return '';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url.replace(/^https?:\/\//, '').replace(/\/$/, ''); }
}
function levelOf(cat: StorefrontCategory, list: StorefrontCategory[]): { level: Level; mainId: string; subId: string } {
  if (cat.parent_id === null) return { level: 'main', mainId: '', subId: '' };
  const parent = list.find(c => c.id === cat.parent_id);
  if (!parent || parent.parent_id === null) return { level: 'sub', mainId: String(cat.parent_id), subId: '' };
  return { level: 'subsub', mainId: String(parent.parent_id), subId: String(cat.parent_id) };
}

function MetricCard({ icon: Icon, title, value, danger }: { icon: typeof FolderTree; title: string; value: number | string; danger?: boolean }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3.5 p-4">
        <div className={`grid h-11 w-11 place-items-center rounded-xl shrink-0 ${danger ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-primary/10 text-primary'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface Summary { main_count: number; sub_count: number; products_categorized: number; products_uncategorized: number }

export default function StorefrontCategoriesPage() {
  const [channelType, setChannelType] = useState<string>('custom');
  const [connected, setConnected] = useState<boolean | null>(null);
  const [siteUrl, setSiteUrl] = useState<string>('');
  const [categories, setCategories] = useState<StorefrontCategory[]>([]);
  const [readOnlyCats, setReadOnlyCats] = useState<ReadOnlyCategory[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StorefrontCategory | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  // Inline details-panel draft (the new real fields)
  const [draft, setDraft] = useState<{ is_published: boolean; visibility: Visibility; is_featured: boolean; seo_title: string; seo_description: string } | null>(null);
  const [savingPanel, setSavingPanel] = useState(false);
  const [panelSaved, setPanelSaved] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
  const readOnly = isReadOnly(channelType);

  const fetchAll = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const connRes = await channelsApi.getConnections(shopId);
      const conns: Conn[] = connRes.data ?? [];
      const conn = conns.find((c) => c.channel_type === channelType);
      setConnected(!!conn);
      setSiteUrl(conn?.channel_api_url ?? '');

      if (isReadOnly(channelType)) {
        setCategories([]); setSummary(null);
        if (conn) {
          const r = await channelsApi.getCategories(shopId, conn.id).catch(() => ({ data: [] }));
          setReadOnlyCats((r.data ?? []).map((c: any) => ({ id: String(c.id), name: c.name, parent_id: c.parent_id != null ? String(c.parent_id) : null })));
        } else {
          setReadOnlyCats([]);
        }
      } else {
        setReadOnlyCats([]);
        const [catRes, sumRes] = await Promise.all([
          channelsApi.listStorefrontCategories(shopId, channelType).catch(() => ({ data: [] })),
          channelsApi.storefrontCategoriesSummary(shopId, channelType).catch(() => ({ data: null })),
        ]);
        setCategories(catRes.data ?? []);
        setSummary(sumRes.data ?? null);
      }
    } catch {
      setConnected(false); setCategories([]); setReadOnlyCats([]); setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [shopId, channelType]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const mainCategories = siblingsOf(categories, null);
  const subCategoriesOf = (mainId: string) => mainId ? siblingsOf(categories, Number(mainId)) : [];
  const selected = useMemo(() => categories.find(c => c.id === selectedId) ?? null, [categories, selectedId]);

  useEffect(() => {
    if (selected) {
      setDraft({
        is_published: selected.is_published ?? true,
        visibility: selected.visibility ?? 'nav_and_grid',
        is_featured: selected.is_featured ?? false,
        seo_title: selected.seo_title ?? '',
        seo_description: selected.seo_description ?? '',
      });
      setPanelSaved(false);
    } else {
      setDraft(null);
    }
  }, [selected]);

  const mainCount = summary?.main_count ?? mainCategories.length;
  const subCount = summary?.sub_count ?? categories.filter(c => c.parent_id !== null).length;
  const productsCategorized = summary?.products_categorized ?? categories.reduce((s, c) => s + (c.product_count ?? 0), 0);
  const productsUncategorized = summary?.products_uncategorized ?? 0;

  const filteredMains = useMemo(() => {
    if (!search.trim()) return mainCategories;
    const kw = search.toLowerCase();
    const matchesTree = (c: StorefrontCategory): boolean =>
      c.name.toLowerCase().includes(kw) || siblingsOf(categories, c.id).some(matchesTree);
    return mainCategories.filter(matchesTree);
  }, [mainCategories, categories, search]);

  const openAdd = (presetParentId?: number | null) => {
    setEditing(null); setUploadError('');
    if (presetParentId === undefined) setForm(EMPTY_FORM);
    else if (presetParentId === null) setForm({ ...EMPTY_FORM, level: 'main' });
    else {
      const parent = categories.find(c => c.id === presetParentId);
      if (parent && parent.parent_id === null) setForm({ ...EMPTY_FORM, level: 'sub', mainId: String(parent.id) });
      else if (parent) setForm({ ...EMPTY_FORM, level: 'subsub', mainId: String(parent.parent_id), subId: String(parent.id) });
    }
    setShowModal(true);
  };

  const openEdit = (c: StorefrontCategory) => {
    setEditing(c); setUploadError('');
    const { level, mainId, subId } = levelOf(c, categories);
    setForm({ name: c.name, icon_url: c.icon_url || '', level, mainId, subId, published: c.is_published ?? true });
    setShowModal(true);
  };

  const resolveParentId = (): number | null => {
    if (form.level === 'main') return null;
    if (form.level === 'sub') return form.mainId ? Number(form.mainId) : null;
    return form.subId ? Number(form.subId) : null;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setUploadError('Image is too large — keep it under 5MB.'); return; }
    setUploadError(''); setUploading(true);
    try {
      const url = await channelsApi.uploadStorefrontCategoryIcon(shopId, file);
      setForm(p => ({ ...p, icon_url: url }));
    } catch { setUploadError('Upload failed. Try again.'); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (form.level === 'sub' && !form.mainId) return;
    if (form.level === 'subsub' && (!form.mainId || !form.subId)) return;
    setSaving(true);
    try {
      const parentId = resolveParentId();
      const siblingCount = siblingsOf(categories, parentId).length;
      const payload: StorefrontCategoryPayload = {
        channel_type: channelType,
        name: form.name,
        icon_url: form.icon_url || undefined,
        sort_order: editing ? editing.sort_order : siblingCount,
        parent_id: parentId,
        is_published: form.published,
        // preserve the rest on edit
        visibility: editing?.visibility ?? 'nav_and_grid',
        is_featured: editing?.is_featured ?? false,
        seo_title: editing?.seo_title ?? null,
        seo_description: editing?.seo_description ?? null,
      };
      if (editing) await channelsApi.updateStorefrontCategory(shopId, editing.id, payload);
      else await channelsApi.createStorefrontCategory(shopId, payload);
      setShowModal(false);
      fetchAll();
    } catch {/* no-op */} finally { setSaving(false); }
  };

  const savePanel = async () => {
    if (!selected || !draft) return;
    setSavingPanel(true); setPanelSaved(false);
    try {
      await channelsApi.updateStorefrontCategory(shopId, selected.id, {
        channel_type: channelType,
        name: selected.name,
        icon_url: selected.icon_url || undefined,
        sort_order: selected.sort_order,
        parent_id: selected.parent_id,
        is_published: draft.is_published,
        visibility: draft.visibility,
        is_featured: draft.is_featured,
        seo_title: draft.seo_title || null,
        seo_description: draft.seo_description || null,
      });
      setPanelSaved(true);
      setTimeout(() => setPanelSaved(false), 2000);
      fetchAll();
    } catch {/* no-op */} finally { setSavingPanel(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      await channelsApi.deleteStorefrontCategory(shopId, id);
      if (selectedId === id) setSelectedId(null);
      fetchAll();
    } catch {/* no-op */}
    setDeleteId(null);
  };

  const move = async (list: StorefrontCategory[], index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    setReordering(true);
    const a = list[index]; const b = list[target];
    try {
      await Promise.all([
        channelsApi.updateStorefrontCategory(shopId, a.id, { channel_type: channelType, name: a.name, icon_url: a.icon_url || undefined, sort_order: b.sort_order, parent_id: a.parent_id, is_published: a.is_published, visibility: a.visibility, is_featured: a.is_featured, seo_title: a.seo_title, seo_description: a.seo_description }),
        channelsApi.updateStorefrontCategory(shopId, b.id, { channel_type: channelType, name: b.name, icon_url: b.icon_url || undefined, sort_order: a.sort_order, parent_id: b.parent_id, is_published: b.is_published, visibility: b.visibility, is_featured: b.is_featured, seo_title: b.seo_title, seo_description: b.seo_description }),
      ]);
      await fetchAll();
    } catch {/* no-op */} finally { setReordering(false); }
  };

  const runImport = async () => {
    const names = importText.split('\n').map(s => s.trim()).filter(Boolean);
    if (!names.length) return;
    setImporting(true);
    try {
      await channelsApi.bulkCreateStorefrontCategories(shopId, { channel_type: channelType, names });
      setImportOpen(false); setImportText('');
      fetchAll();
    } catch {/* no-op */} finally { setImporting(false); }
  };

  const toggleCollapse = (id: number) =>
    setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const copyUrl = async () => {
    if (!selected) return;
    const host = siteHost(siteUrl);
    const url = host ? `https://${host}/category/${selected.slug}` : selected.slug;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {/* no-op */}
  };

  const LEVEL_LABEL: Record<Level, string> = { main: 'Main Category', sub: 'Sub Category', subsub: 'Sub-Sub Category' };
  const channelLabel = ALL_CHANNELS.find(o => o.value === channelType)?.label;
  const host = siteHost(siteUrl);

  const health = draft && selected ? [
    { ok: !!selected.icon_url, label: 'Category image is set' },
    { ok: !!draft.seo_description.trim(), label: 'Meta description is set' },
    { ok: (selected.product_count ?? 0) > 0, label: `${selected.product_count ?? 0} products assigned` },
    { ok: draft.is_published && draft.visibility !== 'hidden', label: 'Visible on storefront' },
  ] : [];
  const healthGood = health.every(h => h.ok);

  // ── Editable tree row ──────────────────────────────────────────────────
  const renderRow = (c: StorefrontCategory, depth: number) => {
    const kids = siblingsOf(categories, c.id);
    const siblings = siblingsOf(categories, c.parent_id);
    const idx = siblings.findIndex(s => s.id === c.id);
    const isCollapsed = collapsed.has(c.id);
    const isSelected = selectedId === c.id;
    return (
      <div key={c.id}>
        <div onClick={() => setSelectedId(c.id)}
          className={`group flex items-center gap-3 px-3 py-2.5 border-b border-border cursor-pointer transition hover:bg-muted/50 ${isSelected ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : ''}`}
          style={{ paddingLeft: `${12 + depth * 26}px` }}>
          {kids.length > 0 ? (
            <button type="button" onClick={(e) => { e.stopPropagation(); toggleCollapse(c.id); }} className="p-0.5 rounded hover:bg-muted text-muted-foreground shrink-0">
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          ) : (
            <span className="w-5 shrink-0">{depth > 0 && <CornerDownRight className="w-3.5 h-3.5 text-muted-foreground/40" />}</span>
          )}
          <div className={`rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden ${depth === 0 ? 'w-9 h-9' : 'w-7 h-7'}`}>
            {c.icon_url ? <img src={c.icon_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className={depth === 0 ? 'w-4 h-4 text-primary' : 'w-3.5 h-3.5 text-primary'} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className={`text-foreground truncate ${depth === 0 ? 'font-semibold text-sm' : 'text-sm'}`}>{c.name}</p>
              {c.is_featured && <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
            </div>
            <p className="text-[11px] text-muted-foreground/70 font-mono truncate">/{c.slug}</p>
          </div>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
            c.visibility === 'hidden' || c.is_published === false
              ? 'bg-muted text-muted-foreground'
              : 'bg-green-500/10 text-green-600 dark:text-green-400'
          }`}>
            {c.is_published === false ? 'Draft' : c.visibility === 'hidden' ? 'Hidden' : 'Published'}
          </span>
          <span className="text-xs font-medium text-muted-foreground shrink-0 tabular-nums w-14 text-right">{(c.product_count ?? 0)}</span>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
            {depth < 2 && (
              <button type="button" onClick={(e) => { e.stopPropagation(); openAdd(c.id); }} title={`Add ${depth === 0 ? 'sub' : 'sub-sub'} category`}
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition"><Plus className="w-4 h-4" /></button>
            )}
            <button type="button" onClick={(e) => { e.stopPropagation(); move(siblings, idx, -1); }} disabled={idx === 0 || reordering}
              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition disabled:opacity-30 disabled:cursor-not-allowed"><ArrowUp className="w-4 h-4" /></button>
            <button type="button" onClick={(e) => { e.stopPropagation(); move(siblings, idx, 1); }} disabled={idx === siblings.length - 1 || reordering}
              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition disabled:opacity-30 disabled:cursor-not-allowed"><ArrowDown className="w-4 h-4" /></button>
            <button type="button" onClick={(e) => { e.stopPropagation(); openEdit(c); }}
              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition"><Edit className="w-4 h-4" /></button>
            <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteId(c.id); }}
              className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
        {!isCollapsed && kids.map(k => renderRow(k, depth + 1))}
      </div>
    );
  };

  const renderReadOnlyRow = (c: ReadOnlyCategory, depth: number) => {
    const kids = readOnlyCats.filter(k => k.parent_id === c.id);
    return (
      <div key={c.id}>
        <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border" style={{ paddingLeft: `${12 + depth * 26}px` }}>
          {depth > 0 && <CornerDownRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />}
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><FolderTree className="w-4 h-4 text-muted-foreground" /></div>
          <p className={`text-foreground truncate ${depth === 0 ? 'font-semibold text-sm' : 'text-sm'}`}>{c.name}</p>
        </div>
        {kids.map(k => renderReadOnlyRow(k, depth + 1))}
      </div>
    );
  };

  return (
    <div className="max-w-[1500px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold text-primary">
            Sales Channels <span className="mx-1 text-muted-foreground/50">/</span> {channelLabel}
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">Storefront Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The category list shoppers see — powers your storefront's category grid and navigation live{host ? ` on ${host}` : ''}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly && (
            <button type="button" onClick={() => setImportOpen(true)} disabled={!connected}
              className="inline-flex items-center gap-2 border border-border px-3.5 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition disabled:opacity-40">
              <Upload className="w-4 h-4" /> Import categories
            </button>
          )}
          {host && (
            <a href={`https://${host}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-border px-3.5 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition">
              <Eye className="w-4 h-4" /> Preview storefront
            </a>
          )}
          {!readOnly && (
            <button type="button" onClick={() => openAdd()} disabled={!connected}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-40 disabled:cursor-not-allowed">
              <Plus className="w-4 h-4" /> Add category
            </button>
          )}
        </div>
      </div>

      {/* Channel + metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Channel</label>
            <div className="relative">
              <button type="button" onClick={() => setPickerOpen(o => !o)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm">
                <ChannelLogo channelType={channelType} size={18} />
                <span className="flex-1 text-left truncate">{channelLabel}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
              {pickerOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
                  <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-border bg-card shadow-lg p-1">
                    <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Your own store — editable</p>
                    {EDITABLE_CHANNELS.map(o => (
                      <button key={o.value} type="button"
                        onClick={() => { setChannelType(o.value); setSelectedId(null); setSearch(''); setPickerOpen(false); }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition ${channelType === o.value ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}>
                        <ChannelLogo channelType={o.value} size={18} /> {o.label}
                      </button>
                    ))}
                    <p className="px-2 py-1 mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Marketplaces — view only</p>
                    {READONLY_CHANNELS.map(o => (
                      <button key={o.value} type="button"
                        onClick={() => { setChannelType(o.value); setSelectedId(null); setSearch(''); setPickerOpen(false); }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition ${channelType === o.value ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}>
                        <ChannelLogo channelType={o.value} size={18} /> {o.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
        {readOnly ? (
          <>
            <MetricCard icon={FolderTree} title={`${channelLabel} categories synced`} value={loading ? '—' : readOnlyCats.length} />
            <div className="hidden sm:block xl:col-span-3" />
          </>
        ) : (
          <>
            <MetricCard icon={FolderTree} title="Main categories" value={loading ? '—' : mainCount} />
            <MetricCard icon={Layers3} title="Sub-categories" value={loading ? '—' : subCount} />
            <MetricCard icon={Package} title="Products categorized" value={loading ? '—' : productsCategorized.toLocaleString()} />
            <MetricCard icon={AlertTriangle} title="Products need a category" value={loading ? '—' : productsUncategorized} danger={productsUncategorized > 0} />
          </>
        )}
      </div>

      {/* Connected strip */}
      {connected && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                {readOnly ? <Lock className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-foreground text-sm">{channelLabel}{host ? ` — ${host}` : ''}</p>
                  {readOnly ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">View only</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Live
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {readOnly
                    ? `${channelLabel} manages its own category tree. It's synced here for reference — edit it on ${channelLabel}.`
                    : 'These categories power the storefront menu and category grid on your website.'}
                </p>
              </div>
            </div>
            {!readOnly && !host && (
              <a href="/dashboard/custom-website-integration" className="text-xs font-semibold text-primary hover:opacity-80 shrink-0">Add your website address →</a>
            )}
          </CardContent>
        </Card>
      )}

      {/* Body */}
      {!loading && connected === false ? (
        <Card>
          <CardContent className="p-16 text-center">
            <Link2 className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold text-foreground mb-1">{channelLabel} isn't connected yet</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
              Connect {channelLabel} under Channels first — categories only matter once there's a storefront to show them on.
            </p>
            <a href="/dashboard/channels" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
              Go to Channels
            </a>
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-24">
            <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-border">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </span>
            <p className="text-sm text-muted-foreground">Loading {channelLabel} categories…</p>
          </CardContent>
        </Card>
      ) : readOnly ? (
        <Card className="overflow-hidden">
          <div className="border-b border-border p-4 flex items-center justify-between">
            <h2 className="font-bold text-foreground text-sm">{channelLabel} categories</h2>
            <span className="text-xs text-muted-foreground">{readOnlyCats.length} synced</span>
          </div>
          {readOnlyCats.length === 0 ? (
            <div className="p-16 text-center">
              <FolderTree className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No {channelLabel} categories synced yet. They sync automatically when you list a product on {channelLabel}.</p>
            </div>
          ) : (
            <div>{readOnlyCats.filter(c => c.parent_id === null).map(c => renderReadOnlyRow(c, 0))}</div>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_400px] items-start">
          {/* Left — tree */}
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-bold text-foreground text-sm">Category structure</h2>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search categories…"
                    className="h-9 w-48 pl-9 pr-3 bg-muted border border-border rounded-lg text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none" />
                </div>
                <button type="button" onClick={() => setCollapsed(new Set())} className="h-9 px-3 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted transition">Expand all</button>
                <button type="button" onClick={() => setCollapsed(new Set(categories.filter(c => siblingsOf(categories, c.id).length > 0).map(c => c.id)))}
                  className="h-9 px-3 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted transition">Collapse all</button>
              </div>
            </div>

            {mainCategories.length === 0 ? (
              <div className="p-16 text-center">
                <LayoutGrid className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
                <h3 className="font-semibold text-foreground mb-1">No categories yet</h3>
                <p className="text-sm text-muted-foreground mb-5">Add categories for {channelLabel} — they'll show up on your storefront immediately.</p>
                <button type="button" onClick={() => openAdd()} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
                  <Plus className="w-4 h-4" /> Add Category
                </button>
              </div>
            ) : filteredMains.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">No categories match “{search}”.</div>
            ) : (
              <div>
                <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  <span className="pl-8 flex-1">Category</span>
                  <span>Status</span>
                  <span className="w-14 text-right pr-24">Products</span>
                </div>
                {filteredMains.map(c => renderRow(c, 0))}
              </div>
            )}
          </Card>

          {/* Right — details */}
          <Card>
            <CardContent className="p-4">
              <h2 className="font-bold text-foreground text-sm">Category details</h2>
              {!selected || !draft ? (
                <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center">
                  <Boxes className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Select a category on the left to see and edit its details.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
                    <div className="h-20 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
                    <div className="-mt-8 flex items-end justify-between px-4">
                      <div className="grid h-16 w-16 place-items-center rounded-xl border-4 border-card bg-muted overflow-hidden shrink-0">
                        {selected.icon_url ? <img src={selected.icon_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-muted-foreground" />}
                      </div>
                      <button type="button" onClick={() => openEdit(selected)} className="mb-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted transition">Change image</button>
                    </div>
                    <div className="p-4 pt-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-bold text-foreground truncate">{selected.name}</h3>
                        <label className="flex items-center gap-2 shrink-0 cursor-pointer">
                          <input type="checkbox" checked={draft.is_published} onChange={(e) => setDraft(d => d && { ...d, is_published: e.target.checked })}
                            className="h-4 w-4 accent-primary" />
                          <span className="text-xs font-semibold text-foreground">{draft.is_published ? 'Published' : 'Draft'}</span>
                        </label>
                      </div>
                      <div className="mt-3 grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-card">
                        <div className="p-2.5"><p className="text-[10px] text-muted-foreground">Level</p>
                          <p className="mt-0.5 text-xs font-bold text-foreground">{levelOf(selected, categories).level === 'main' ? 'Main' : levelOf(selected, categories).level === 'sub' ? 'Sub' : 'Sub-sub'}</p></div>
                        <div className="p-2.5"><p className="text-[10px] text-muted-foreground">Products</p><p className="mt-0.5 text-base font-bold text-foreground">{selected.product_count ?? 0}</p></div>
                        <div className="p-2.5"><p className="text-[10px] text-muted-foreground">Sub-categories</p><p className="mt-0.5 text-base font-bold text-foreground">{siblingsOf(categories, selected.id).length}</p></div>
                      </div>
                    </div>
                  </div>

                  {/* Category URL */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-foreground">Category URL</p>
                    <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs font-mono text-muted-foreground">
                      <span className="truncate flex-1">{host ? `${host}/category/${selected.slug}` : `/${selected.slug}`}</span>
                      <button type="button" onClick={copyUrl} className="shrink-0 text-primary hover:opacity-80">{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}</button>
                    </div>
                  </div>

                  {/* Visibility */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Category visibility</label>
                    <select value={draft.visibility} onChange={(e) => setDraft(d => d && { ...d, visibility: e.target.value as Visibility })}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none">
                      {(Object.keys(VISIBILITY_LABEL) as Visibility[]).map(v => <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>)}
                    </select>
                  </div>

                  {/* Featured */}
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Featured category</p>
                      <p className="text-xs text-muted-foreground">Surface it on the storefront homepage.</p>
                    </div>
                    <input type="checkbox" checked={draft.is_featured} onChange={(e) => setDraft(d => d && { ...d, is_featured: e.target.checked })} className="h-4 w-4 accent-primary" />
                  </label>

                  {/* Parent (read-only note — change via Edit) */}
                  <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
                    <span className="text-foreground font-medium">Parent: </span>
                    {selected.parent_id === null ? 'Top level (Main)' : (categories.find(c => c.id === selected.parent_id)?.name ?? '—')}
                    <span className="mx-1.5">·</span>
                    <span className="text-foreground font-medium">Position </span>#{selected.sort_order + 1}
                    <span className="block mt-0.5">Use Edit to move it, ↑ ↓ on the row to reorder.</span>
                  </div>

                  {/* SEO */}
                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-foreground">SEO title</label>
                      <span className="text-[10px] text-muted-foreground">{draft.seo_title.length}/80</span>
                    </div>
                    <input type="text" maxLength={80} value={draft.seo_title} onChange={(e) => setDraft(d => d && { ...d, seo_title: e.target.value })}
                      placeholder={`${selected.name}${host ? ` | ${host}` : ''}`}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-foreground">Meta description</label>
                      <span className="text-[10px] text-muted-foreground">{draft.seo_description.length}/160</span>
                    </div>
                    <textarea maxLength={200} value={draft.seo_description} onChange={(e) => setDraft(d => d && { ...d, seo_description: e.target.value })}
                      placeholder={`Shop ${selected.name.toLowerCase()} at ${host || 'our store'}.`} rows={3}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm resize-none focus:ring-2 focus:ring-primary focus:outline-none" />
                  </div>

                  {/* Health */}
                  <div className={`rounded-xl border p-3 ${healthGood ? 'border-green-500/20 bg-green-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
                    <p className={`flex items-center gap-2 text-sm font-bold ${healthGood ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                      <Check className="w-4 h-4" /> {healthGood ? 'Category health looks good' : 'Category could be improved'}
                    </p>
                    <ul className="mt-2 space-y-1 text-xs">
                      {health.map(h => (
                        <li key={h.label} className={`flex items-center gap-1.5 ${h.ok ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-400'}`}>
                          {h.ok ? <Check className="w-3 h-3 text-green-500" /> : <AlertCircle className="w-3 h-3" />} {h.label}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {selected.updated_at && (
                    <p className="text-[11px] text-muted-foreground">Last updated {new Date(selected.updated_at).toLocaleString()}</p>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button type="button" onClick={savePanel} disabled={savingPanel}
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60">
                      {savingPanel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : panelSaved ? <Check className="w-3.5 h-3.5" /> : null}
                      {savingPanel ? 'Saving…' : panelSaved ? 'Saved' : 'Save changes'}
                    </button>
                    <button type="button" onClick={() => setDeleteId(selected.id)}
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 border border-destructive/40 text-destructive rounded-lg text-sm font-medium hover:bg-destructive/10 transition">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Import dialog */}
      {importOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-md">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Import categories</h2>
              <button type="button" onClick={() => setImportOpen(false)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">One category name per line. They're added as <strong className="text-foreground">Main categories</strong>, Published. Names that already exist are skipped.</p>
              <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={8}
                placeholder={'Electronics\nFashion\nHome & Kitchen\nBeauty'}
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm resize-none focus:ring-2 focus:ring-primary focus:outline-none font-mono" />
            </div>
            <div className="p-4 border-t border-border flex gap-3">
              <button type="button" onClick={() => setImportOpen(false)} className="flex-1 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={runImport} disabled={importing || !importText.trim()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {importing && <Loader2 className="w-4 h-4 animate-spin" />} Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{editing ? 'Edit Category' : 'Add Category'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Level *</label>
                <select value={form.level} onChange={(e) => setForm(p => ({ ...p, level: e.target.value as Level, mainId: '', subId: '' }))}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none">
                  <option value="main">Main Category</option>
                  <option value="sub">Sub Category</option>
                  <option value="subsub">Sub-Sub Category</option>
                </select>
              </div>

              {(form.level === 'sub' || form.level === 'subsub') && (
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Under which Main Category? *</label>
                  <select value={form.mainId} onChange={(e) => setForm(p => ({ ...p, mainId: e.target.value, subId: '' }))}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none">
                    <option value="">Select a main category…</option>
                    {mainCategories.filter(m => !editing || m.id !== editing.id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              )}

              {form.level === 'subsub' && form.mainId && (
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Under which Sub Category? *</label>
                  <select value={form.subId} onChange={(e) => setForm(p => ({ ...p, subId: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none">
                    <option value="">Select a sub category…</option>
                    {subCategoriesOf(form.mainId).filter(s => !editing || s.id !== editing.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {subCategoriesOf(form.mainId).length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">This main category has no sub categories yet — add one first.</p>
                  )}
                </div>
              )}

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{LEVEL_LABEL[form.level]} Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., Fragrances" autoFocus
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none" />
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Image</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0 overflow-hidden">
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      : form.icon_url ? <img src={form.icon_url} alt="" className="w-full h-full object-cover" />
                      : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1">
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="cat-icon-upload" />
                    <label htmlFor="cat-icon-upload" className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition cursor-pointer">
                      <Upload className="w-3.5 h-3.5" /> {form.icon_url ? 'Replace image' : 'Upload image'}
                    </label>
                    {form.icon_url && (
                      <button type="button" onClick={() => setForm(p => ({ ...p, icon_url: '' }))} className="ml-2 text-xs text-muted-foreground hover:text-destructive transition">Remove</button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">One image per category. Square works best — around 200×200px, under 5MB.</p>
                {uploadError && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {uploadError}</p>}
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Visibility</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setForm(p => ({ ...p, published: true }))}
                    className={`rounded-lg border p-3 text-left transition ${form.published ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/40'}`}>
                    <p className="text-sm font-bold text-foreground">Published</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Visible on your storefront</p>
                  </button>
                  <button type="button" onClick={() => setForm(p => ({ ...p, published: false }))}
                    className={`rounded-lg border p-3 text-left transition ${!form.published ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/40'}`}>
                    <p className="text-sm font-bold text-foreground">Draft</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Save without publishing</p>
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-border flex gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={handleSave}
                disabled={saving || uploading || !form.name.trim() || (form.level === 'sub' && !form.mainId) || (form.level === 'subsub' && !form.subId)}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing ? 'Save Changes' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-foreground mb-2">Remove Category?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              It'll disappear from your storefront immediately, along with any sub categories under it. Products already assigned stay as they are.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteId(null)} className="flex-1 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={() => handleDelete(deleteId)} className="flex-1 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
