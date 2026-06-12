'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag, Plus, Search, Pencil, Trash2, Loader2,
  Flame, Star, Eye, EyeOff, X, Check, Package,
  ExternalLink,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShopOption {
  id: number;
  name: string;
  currency: string;
}

interface CategoryOption {
  id: number;
  name: string;
  shop_id: number;
}

interface ShoppingProduct {
  id: number;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  image_url: string | null;
  video_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  is_trending: boolean;
  stock: number;
  sku: string | null;
  category_id: number | null;
  category_name: string | null;
  shop_id: number;
  shop_name: string | null;
  created_at: string;
}

const emptyForm = {
  name: '',
  description: '',
  price: '',
  sku: '',
  image_url: '',
  video_url: '',
  stock: '0',
  category_id: '',
  shop_id: '',
  is_featured: false,
  is_trending: false,
  is_active: true,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${color}`}>
      {label}
    </span>
  );
}

function ToggleBtn({
  active,
  onClick,
  icon,
  title,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded-lg transition ${
        active
          ? 'bg-[#6B3FD9]/20 text-[#6B3FD9]'
          : 'text-gray-600 hover:text-gray-400 hover:bg-gray-800'
      }`}
    >
      {icon}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ShoppingAdminPage() {
  const [products, setProducts] = useState<ShoppingProduct[]>([]);
  const [shops, setShops] = useState<ShopOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [shopFilter, setShopFilter] = useState('');

  // modal state
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<ShoppingProduct | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

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
      if (shopFilter) params.shop_id = Number(shopFilter);
      const res = await adminApi.getShoppingProducts(params);
      setProducts(res.data);
    } catch {
      // handled by empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, [search, shopFilter]);

  useEffect(() => {
    adminApi.getShopsForProduct().then((r) => setShops(r.data)).catch(() => {});
  }, []);

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditProduct(null);
    setForm({ ...emptyForm });
    setModalError('');
    setShowModal(true);
    setTimeout(() => firstInputRef.current?.focus(), 80);
  };

  const openEdit = (p: ShoppingProduct) => {
    setEditProduct(p);
    setForm({
      name: p.name,
      description: p.description || '',
      price: String(p.price),
      sku: p.sku || '',
      image_url: p.image_url || '',
      video_url: p.video_url || '',
      stock: String(p.stock),
      category_id: p.category_id ? String(p.category_id) : '',
      shop_id: String(p.shop_id),
      is_featured: p.is_featured,
      is_trending: p.is_trending,
      is_active: p.is_active,
    });
    setModalError('');
    setShowModal(true);
    // load categories for this shop
    adminApi.getCategoriesForShop(p.shop_id).then((r) => setCategories(r.data)).catch(() => {});
    setTimeout(() => firstInputRef.current?.focus(), 80);
  };

  const handleShopChange = (shopId: string) => {
    setForm((f) => ({ ...f, shop_id: shopId, category_id: '' }));
    if (shopId) {
      adminApi.getCategoriesForShop(Number(shopId)).then((r) => setCategories(r.data)).catch(() => {});
    } else {
      setCategories([]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price || !form.shop_id) {
      setModalError('Name, price and store are required.');
      return;
    }
    setSaving(true);
    setModalError('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: parseFloat(form.price),
        sku: form.sku.trim() || null,
        image_url: form.image_url.trim() || null,
        video_url: form.video_url.trim() || null,
        stock: parseInt(form.stock) || 0,
        category_id: form.category_id ? parseInt(form.category_id) : null,
        shop_id: parseInt(form.shop_id),
        is_featured: form.is_featured,
        is_trending: form.is_trending,
        is_active: form.is_active,
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
  const outOfStock = products.filter((p) => p.stock === 0).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Shopping Products</h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage products shown on the ExiusCart shopping storefront
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-black font-semibold px-4 py-2.5 rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Products" value={String(products.length)} icon={<Package className="w-5 h-5" />} />
        <StatCard label="Trending" value={String(trending)} icon={<Flame className="w-5 h-5" />} accent="orange" />
        <StatCard label="Featured" value={String(featured)} icon={<Star className="w-5 h-5" />} accent="yellow" />
        <StatCard label="Out of Stock" value={String(outOfStock)} icon={<ShoppingBag className="w-5 h-5" />} accent={outOfStock > 0 ? 'red' : undefined} />
      </div>

      {/* Filters */}
      <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:border-[#6B3FD9] focus:outline-none text-sm"
          />
        </div>
        <select
          value={shopFilter}
          onChange={(e) => setShopFilter(e.target.value)}
          className="px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white focus:border-[#6B3FD9] focus:outline-none text-sm"
        >
          <option value="">All Stores</option>
          {shops.map((s) => (
            <option key={s.id} value={String(s.id)}>{s.name}</option>
          ))}
        </select>
        <a
          href="http://localhost:3003"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-[#6B3FD9]/50 transition text-sm"
        >
          <ExternalLink className="w-4 h-4" />
          Preview Store
        </a>
      </div>

      {/* Table */}
      <div className="bg-[#151F32] rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-[#6B3FD9]" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <ShoppingBag className="w-12 h-12 mb-2 opacity-30" />
            <p className="text-sm">No products yet</p>
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
                    <th className="px-4 py-3 font-medium">Store</th>
                    <th className="px-4 py-3 font-medium text-right">Price</th>
                    <th className="px-4 py-3 font-medium text-center">Stock</th>
                    <th className="px-4 py-3 font-medium text-center">Flags</th>
                    <th className="px-4 py-3 font-medium text-center">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {products.map((p) => (
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
                            <p className="font-medium text-white text-sm truncate max-w-[180px]">{p.name}</p>
                            {p.category_name && (
                              <p className="text-xs text-gray-500 truncate">{p.category_name}</p>
                            )}
                            {p.sku && <p className="text-xs text-gray-600">{p.sku}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Shop */}
                      <td className="px-4 py-4">
                        <p className="text-sm text-gray-300">{p.shop_name || '—'}</p>
                      </td>

                      {/* Price */}
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm font-semibold text-[#6B3FD9]">
                          {p.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {p.currency}
                        </span>
                      </td>

                      {/* Stock */}
                      <td className="px-4 py-4 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                          p.stock === 0
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : p.stock <= 5
                            ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                            : 'bg-green-500/10 text-green-400 border-green-500/20'
                        }`}>
                          {p.stock === 0 ? 'Out' : p.stock}
                        </span>
                      </td>

                      {/* Flags — quick toggle */}
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <ToggleBtn
                            active={p.is_trending}
                            onClick={() => toggle(p, 'is_trending')}
                            icon={<Flame className="w-4 h-4" />}
                            title={p.is_trending ? 'Remove Trending' : 'Mark Trending'}
                          />
                          <ToggleBtn
                            active={p.is_featured}
                            onClick={() => toggle(p, 'is_featured')}
                            icon={<Star className="w-4 h-4" />}
                            title={p.is_featured ? 'Remove Featured' : 'Mark Featured'}
                          />
                          {togglingId === p.id && (
                            <Loader2 className="w-3 h-3 animate-spin text-gray-500" />
                          )}
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
                  ))}
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
                    <p className="text-xs text-gray-500 mt-0.5">{p.shop_name}</p>
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
            <div className="sticky top-0 bg-[#151F32] flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">
                {editProduct ? 'Edit Product' : 'Add Product'}
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
                  placeholder="Short product description..."
                  rows={2}
                  className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:border-[#6B3FD9] focus:outline-none text-sm resize-none"
                />
              </div>

              {/* Price + Stock */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Price *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:border-[#6B3FD9] focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:border-[#6B3FD9] focus:outline-none text-sm"
                  />
                </div>
              </div>

              {/* Shop + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Store *</label>
                  <select
                    required
                    value={form.shop_id}
                    onChange={(e) => handleShopChange(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white focus:border-[#6B3FD9] focus:outline-none text-sm"
                  >
                    <option value="">Select store</option>
                    {shops.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.name} ({s.currency})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Category</label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                    disabled={!form.shop_id}
                    className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white focus:border-[#6B3FD9] focus:outline-none text-sm disabled:opacity-50"
                  >
                    <option value="">No category</option>
                    {categories
                      .filter((c) => !form.shop_id || c.shop_id === parseInt(form.shop_id))
                      .map((c) => (
                        <option key={c.id} value={String(c.id)}>{c.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* SKU */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">SKU</label>
                <input
                  type="text"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  placeholder="Product SKU (optional)"
                  className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:border-[#6B3FD9] focus:outline-none text-sm"
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Image URL</label>
                <input
                  type="url"
                  value={form.image_url}
                  onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:border-[#6B3FD9] focus:outline-none text-sm"
                />
                {form.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.image_url} alt="preview" className="mt-2 h-24 w-24 object-cover rounded-lg border border-gray-700" />
                )}
              </div>

              {/* Video URL */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">
                  Video URL
                  <span className="ml-2 text-xs text-gray-600">(TikTok-style short video)</span>
                </label>
                <input
                  type="url"
                  value={form.video_url}
                  onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
                  placeholder="https://... (mp4 or YouTube/TikTok link)"
                  className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:border-[#6B3FD9] focus:outline-none text-sm"
                />
              </div>

              {/* Flags */}
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, is_trending: !f.is_trending }))}
                    className={`w-9 h-5 rounded-full transition-colors flex items-center ${form.is_trending ? 'bg-orange-500' : 'bg-gray-700'}`}
                  >
                    <span className={`w-3.5 h-3.5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.is_trending ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-sm text-gray-300 flex items-center gap-1">
                    <Flame className="w-4 h-4 text-orange-400" /> Trending
                  </span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, is_featured: !f.is_featured }))}
                    className={`w-9 h-5 rounded-full transition-colors flex items-center ${form.is_featured ? 'bg-yellow-500' : 'bg-gray-700'}`}
                  >
                    <span className={`w-3.5 h-3.5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.is_featured ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-sm text-gray-300 flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400" /> Featured
                  </span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                    className={`w-9 h-5 rounded-full transition-colors flex items-center ${form.is_active ? 'bg-green-500' : 'bg-gray-700'}`}
                  >
                    <span className={`w-3.5 h-3.5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-sm text-gray-300 flex items-center gap-1">
                    <Eye className="w-4 h-4 text-green-400" /> Active (visible in store)
                  </span>
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
                  className="flex-1 py-3 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-black rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {saving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
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
              This product will be permanently removed from the shopping storefront.
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
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: 'orange' | 'yellow' | 'red';
}) {
  const colorMap = {
    orange: 'bg-orange-500/10 text-orange-400',
    yellow: 'bg-yellow-500/10 text-yellow-400',
    red: 'bg-red-500/10 text-red-400',
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

