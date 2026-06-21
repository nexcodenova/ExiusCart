'use client';

import { useState, useEffect, useCallback, useRef, ChangeEvent } from 'react';
import {
  Plus, Search, Edit, Trash2, Package, X, ChevronDown,
  Star, Upload, ImageIcon, ToggleLeft, ToggleRight, Loader2,
  FileSpreadsheet, Download, CheckCircle, AlertCircle, Barcode,
} from 'lucide-react';
import { productsApi, fieldsApi, attributesApi, imagesApi, channelsApi, variantsApi } from '@/lib/api';
import { BarcodeDisplay, generateBarcode } from '@/components/ui/barcode';
import { useCurrency } from '@/components/providers/currency-provider';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  lowStockAlert: number;
  vatPercent: number;
  image?: string | null;
}

interface ShopField {
  id: number;
  label: string;
  field_key: string;
  field_type: string;
  options?: string[] | null;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
}

interface ProductImage {
  id: number;
  url: string;
  alt_text?: string | null;
  sort_order: number;
  is_primary: boolean;
}

const DEFAULT_CATEGORIES = ['General', 'Other'];

export default function ProductsPage() {
  const { sym } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [csvError, setCsvError] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  // Channel status map: { product_id: { thedersi: { status, rejection_reason } } }
  const [channelStatuses, setChannelStatuses] = useState<Record<string, Record<string, { status: string; rejection_reason?: string }>>>({});

  useEffect(() => {
    if (!shopId) return;
    channelsApi.getAllChannelStatuses(shopId)
      .then((r) => setChannelStatuses(r.data ?? {}))
      .catch(() => {});
  }, [shopId]);

  const fetchProducts = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const res = await productsApi.getAll(shopId, {
        search: searchQuery || undefined,
        category: selectedCategory !== 'All' ? selectedCategory : undefined,
      });
      setProducts(res.data);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [shopId, searchQuery, selectedCategory]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    if (!shopId) return;
    productsApi.getCategories(shopId)
      .then((res) => setCategories(res.data?.length ? res.data : DEFAULT_CATEGORIES))
      .catch(() => {});
  }, [shopId]);

  const handleDelete = async (productId: string) => {
    try {
      await productsApi.delete(shopId, productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    } catch {/* no-op */}
    setShowDeleteConfirm(null);
  };

  const downloadTemplate = () => {
    const headers = 'name,sku,price,cost_price,quantity,low_stock_threshold,description,category';
    const example = 'iPhone 15 Case,IPH15-CASE-BLK,49.99,25.00,100,10,Black silicone case for iPhone 15,Phone Accessories';
    const blob = new Blob([headers + '\n' + example], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvFile = (e: ChangeEvent<HTMLInputElement>) => {
    setCsvError('');
    setCsvResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) { setCsvError('CSV must have at least one data row'); return; }
        const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
        const rows = lines.slice(1).map((line, idx) => {
          const vals = line.split(',');
          const obj: any = {};
          rawHeaders.forEach((h, i) => { obj[h] = vals[i]?.trim() || ''; });
          if (!obj.name) return null;
          return {
            row: idx + 2,
            name: obj.name,
            sku: obj.sku || undefined,
            price: parseFloat(obj.price) || 0,
            cost_price: parseFloat(obj.cost_price) || undefined,
            quantity: parseInt(obj.quantity) || 0,
            low_stock_threshold: parseInt(obj.low_stock_threshold) || 5,
            description: obj.description || undefined,
            category: obj.category || undefined,
          };
        }).filter(Boolean);
        if (!rows.length) { setCsvError('No valid rows found'); return; }
        setCsvRows(rows);
      } catch {
        setCsvError('Failed to parse CSV. Check the format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCsvImport = async () => {
    if (!csvRows.length || !shopId) return;
    setCsvImporting(true);
    try {
      const res = await productsApi.bulkImport(shopId, csvRows);
      setCsvResult(res.data);
      if (res.data.created > 0) fetchProducts();
    } catch (err: any) {
      setCsvError(err.response?.data?.detail || 'Import failed');
    } finally {
      setCsvImporting(false);
    }
  };

  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= p.lowStockAlert).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [alertDismissed, setAlertDismissed] = useState(false);

  const displayedProducts = stockFilter === 'low'
    ? products.filter(p => p.stock > 0 && p.stock <= p.lowStockAlert)
    : stockFilter === 'out'
    ? products.filter(p => p.stock === 0)
    : products;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground text-sm">Manage your product catalog</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setCsvRows([]); setCsvError(''); setCsvResult(null); setShowCsvModal(true); }}
            className="inline-flex items-center justify-center gap-2 border border-border text-foreground px-4 py-2.5 rounded-lg font-medium hover:bg-muted transition"
          >
            <FileSpreadsheet className="w-5 h-5" /> Import CSV
          </button>
          <button
            type="button"
            onClick={() => { setEditingProduct(null); setShowAddModal(true); }}
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition"
          >
            <Plus className="w-5 h-5" /> Add Product
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-muted-foreground text-xs mb-1">Total Products</p>
          <p className="text-2xl font-bold text-foreground">{loading ? '—' : products.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-muted-foreground text-xs mb-1">Categories</p>
          <p className="text-2xl font-bold text-foreground">{categories.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-muted-foreground text-xs mb-1">Low Stock</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{loading ? '—' : lowStockCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-muted-foreground text-xs mb-1">Out of Stock</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{loading ? '—' : outOfStockCount}</p>
        </div>
      </div>

      {/* Low stock alert banner */}
      {!loading && !alertDismissed && (outOfStockCount > 0 || lowStockCount > 0) && (
        <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${outOfStockCount > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-orange-500/10 border-orange-500/30'}`}>
          <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${outOfStockCount > 0 ? 'text-red-500' : 'text-orange-500'}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${outOfStockCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
              Stock Alert
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {outOfStockCount > 0 && <span className="text-red-500 font-medium">{outOfStockCount} out of stock</span>}
              {outOfStockCount > 0 && lowStockCount > 0 && <span className="mx-1">·</span>}
              {lowStockCount > 0 && <span className="text-orange-500 font-medium">{lowStockCount} running low</span>}
              <span className="ml-2">— restock before you run out.</span>
            </p>
            <div className="flex gap-2 mt-2">
              {outOfStockCount > 0 && (
                <button onClick={() => setStockFilter('out')} className="text-xs px-2.5 py-1 bg-red-500/15 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-500/25 transition font-medium">
                  Show out of stock ({outOfStockCount})
                </button>
              )}
              {lowStockCount > 0 && (
                <button onClick={() => setStockFilter('low')} className="text-xs px-2.5 py-1 bg-orange-500/15 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-500/25 transition font-medium">
                  Show low stock ({lowStockCount})
                </button>
              )}
            </div>
          </div>
          <button onClick={() => setAlertDismissed(true)} className="p-1 hover:bg-muted rounded transition shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, SKU, or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Filter by category"
              className="appearance-none w-full sm:w-48 px-4 py-2.5 pr-10 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground"
            >
              <option value="All">All Categories</option>
              {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          </div>
          {/* Stock quick-filters */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setStockFilter('all')}
              className={`text-xs px-3 py-1.5 rounded-lg border transition font-medium ${stockFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border hover:border-primary hover:text-primary'}`}
            >All</button>
            {outOfStockCount > 0 && (
              <button
                onClick={() => setStockFilter('out')}
                className={`text-xs px-3 py-1.5 rounded-lg border transition font-medium ${stockFilter === 'out' ? 'bg-red-500 text-white border-red-500' : 'bg-muted text-red-500 border-red-500/30 hover:border-red-500'}`}
              >Out of stock ({outOfStockCount})</button>
            )}
            {lowStockCount > 0 && (
              <button
                onClick={() => setStockFilter('low')}
                className={`text-xs px-3 py-1.5 rounded-lg border transition font-medium ${stockFilter === 'low' ? 'bg-orange-500 text-white border-orange-500' : 'bg-muted text-orange-500 border-orange-500/30 hover:border-orange-500'}`}
              >Low stock ({lowStockCount})</button>
            )}
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="p-16 text-center">
            <Package className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold text-foreground mb-1">
              {searchQuery || selectedCategory !== 'All' || stockFilter !== 'all' ? 'No products found' : 'No products yet'}
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              {stockFilter !== 'all'
                ? 'No products match this stock filter'
                : searchQuery || selectedCategory !== 'All'
                ? 'Try adjusting your search or filters'
                : 'Add your first product to start selling'}
            </p>
            {stockFilter !== 'all' ? (
              <button type="button" onClick={() => setStockFilter('all')} className="inline-flex items-center gap-2 border border-border text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition">
                Clear filter
              </button>
            ) : !searchQuery && selectedCategory === 'All' && (
              <button
                type="button"
                onClick={() => { setEditingProduct(null); setShowAddModal(true); }}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition"
              >
                <Plus className="w-4 h-4" /> Add First Product
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Product</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">SKU</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Category</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">Cost</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">Price</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Stock</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayedProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-muted/30 transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                            {((product as any).image_url || product.image)
                              ? <img src={(product as any).image_url || product.image!} alt={product.name} className="w-full h-full object-cover" />
                              : <Package className="w-6 h-6 text-muted-foreground" />}
                          </div>
                          <div>
                            <span className="font-medium text-foreground">{product.name}</span>
                            {channelStatuses[product.id]?.thedersi && (() => {
                              const s = channelStatuses[product.id].thedersi;
                              const badge = s.status === 'approved'
                                ? { label: '✅ Live on TheDersi', cls: 'text-green-600 dark:text-green-400' }
                                : s.status === 'rejected'
                                ? { label: '❌ Rejected', cls: 'text-red-500' }
                                : { label: '🟡 Pending Review', cls: 'text-yellow-600 dark:text-yellow-400' };
                              return (
                                <>
                                  <p className={`text-xs mt-0.5 ${badge.cls}`}>{badge.label}</p>
                                  {s.status === 'rejected' && s.rejection_reason && (
                                    <p className="text-xs mt-0.5 text-red-500 bg-red-500/10 rounded px-1.5 py-0.5 max-w-[220px] leading-snug">{s.rejection_reason}</p>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </td>
                      <td className="p-4"><span className="text-sm text-muted-foreground font-mono">{product.sku}</span></td>
                      <td className="p-4"><span className="text-sm text-foreground">{product.category}</span></td>
                      <td className="p-4 text-right"><span className="text-sm text-muted-foreground">{product.costPrice} {sym}</span></td>
                      <td className="p-4 text-right"><span className="text-sm font-medium text-foreground">{product.sellingPrice} {sym}</span></td>
                      <td className="p-4 text-center">
                        <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                          product.stock === 0 ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                          : product.stock <= product.lowStockAlert ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                          : 'bg-green-500/10 text-green-600 dark:text-green-400'}`}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(product as any).barcode && (
                            <button
                              type="button"
                              title="Print barcode label"
                              onClick={() => {
                                const data = encodeURIComponent(JSON.stringify([{
                                  name: product.name,
                                  sku: product.sku,
                                  barcode: (product as any).barcode,
                                  price: `${product.sellingPrice} ${sym}`,
                                }]));
                                window.open(`/dashboard/products/barcode?data=${data}`, '_blank');
                              }}
                              className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition"
                            >
                              <Barcode className="w-4 h-4" />
                            </button>
                          )}
                          <button type="button" onClick={() => { setEditingProduct(product); setShowAddModal(true); }} aria-label={`Edit ${product.name}`} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => setShowDeleteConfirm(product.id)} aria-label={`Delete ${product.name}`} className="p-2 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border">
              {displayedProducts.map((product) => (
                <div key={product.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {((product as any).image_url || product.image)
                        ? <img src={(product as any).image_url || product.image!} alt={product.name} className="w-full h-full object-cover" />
                        : <Package className="w-8 h-8 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate">{product.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{product.sku}</p>
                      {channelStatuses[product.id]?.thedersi && (() => {
                        const s = channelStatuses[product.id].thedersi;
                        const badge = s.status === 'approved'
                          ? { label: '✅ Live on TheDersi', cls: 'text-green-600 dark:text-green-400' }
                          : s.status === 'rejected'
                          ? { label: '❌ Rejected', cls: 'text-red-500' }
                          : { label: '🟡 Pending Review', cls: 'text-yellow-600 dark:text-yellow-400' };
                        return (
                          <>
                            <p className={`text-xs mt-0.5 ${badge.cls}`}>{badge.label}</p>
                            {s.status === 'rejected' && s.rejection_reason && (
                              <p className="text-xs mt-0.5 text-red-500 bg-red-500/10 rounded px-1.5 py-0.5 leading-snug">{s.rejection_reason}</p>
                            )}
                          </>
                        );
                      })()}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm font-semibold text-foreground">{product.sellingPrice} {sym}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${product.stock === 0 ? 'bg-red-500/10 text-red-600 dark:text-red-400' : product.stock <= product.lowStockAlert ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400' : 'bg-green-500/10 text-green-600 dark:text-green-400'}`}>
                          {product.stock} in stock
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => { setEditingProduct(product); setShowAddModal(true); }} aria-label={`Edit ${product.name}`} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition"><Edit className="w-4 h-4" /></button>
                      <button type="button" onClick={() => setShowDeleteConfirm(product.id)} aria-label={`Delete ${product.name}`} className="p-2 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <ProductModal
          product={editingProduct}
          shopId={shopId}
          categories={categories}
          channelStatus={editingProduct ? channelStatuses[editingProduct.id]?.thedersi : undefined}
          onClose={() => { setShowAddModal(false); setEditingProduct(null); }}
          onSaved={() => { setShowAddModal(false); setEditingProduct(null); fetchProducts(); }}
        />
      )}

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete Product?</h3>
            <p className="text-sm text-muted-foreground mb-6">This action cannot be undone. The product will be permanently removed.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={() => handleDelete(showDeleteConfirm)} className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Import Products from CSV</h2>
              <button type="button" onClick={() => setShowCsvModal(false)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* Template download */}
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-foreground font-medium mb-1">CSV Format</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Columns: <code className="bg-muted px-1 rounded">name, sku, price, cost_price, quantity, low_stock_threshold, description, category</code>
                </p>
                <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                  <Download className="w-4 h-4" /> Download Template
                </button>
              </div>

              {/* Upload area */}
              {!csvResult && (
                <div
                  onClick={() => csvInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition"
                >
                  <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-foreground font-medium">Click to upload CSV file</p>
                  <p className="text-muted-foreground text-sm mt-1">.csv files only</p>
                  <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />
                </div>
              )}

              {csvError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-400 text-sm">{csvError}</p>
                </div>
              )}

              {/* Preview table */}
              {csvRows.length > 0 && !csvResult && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">{csvRows.length} rows ready to import</p>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          {['Name', 'SKU', 'Price', 'Qty', 'Category'].map(h => (
                            <th key={h} className="text-left px-3 py-2 text-muted-foreground font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {csvRows.slice(0, 10).map((row, i) => (
                          <tr key={i} className="hover:bg-muted/30">
                            <td className="px-3 py-2 text-foreground">{row.name}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.sku || '—'}</td>
                            <td className="px-3 py-2 text-foreground">{row.price} {sym}</td>
                            <td className="px-3 py-2 text-foreground">{row.quantity}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.category || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvRows.length > 10 && (
                      <p className="text-xs text-muted-foreground p-3 border-t border-border">...and {csvRows.length - 10} more rows</p>
                    )}
                  </div>
                </div>
              )}

              {/* Result */}
              {csvResult && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <p className="font-medium">{csvResult.created} products imported successfully</p>
                  </div>
                  {csvResult.skipped > 0 && (
                    <p className="text-sm text-muted-foreground">{csvResult.skipped} rows skipped</p>
                  )}
                  {csvResult.errors.length > 0 && (
                    <div className="bg-red-500/10 rounded-lg p-3 space-y-1">
                      {csvResult.errors.map((e, i) => (
                        <p key={i} className="text-red-400 text-xs">{e}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex gap-3">
              <button type="button" onClick={() => setShowCsvModal(false)} className="flex-1 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition">
                {csvResult ? 'Close' : 'Cancel'}
              </button>
              {csvRows.length > 0 && !csvResult && (
                <button
                  type="button"
                  onClick={handleCsvImport}
                  disabled={csvImporting}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {csvImporting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Import {csvRows.length} Products
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Product Modal ────────────────────────────────────────────────────────────

interface PendingImage {
  file: File;
  preview: string;
}

function ProductModal({
  product, shopId, categories, channelStatus, onClose, onSaved,
}: {
  product: Product | null;
  shopId: string;
  categories: string[];
  channelStatus?: { status: string; rejection_reason?: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const { sym } = useCurrency();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const p = product as any;
  const [formData, setFormData] = useState({
    name: p?.name ?? '',
    sku: p?.sku ?? '',
    barcode: p?.barcode ?? '',
    description: p?.description ?? '',
    category: p?.category?.name ?? (typeof p?.category === 'string' ? p?.category : '') ?? categories[0] ?? '',
    costPrice: p?.cost_price ?? p?.costPrice ?? 0,
    sellingPrice: p?.price ?? p?.sellingPrice ?? 0,
    compareAtPrice: p?.compare_at_price ?? p?.compareAtPrice ?? 0,
    stock: p?.quantity ?? p?.stock ?? 0,
    lowStockAlert: p?.low_stock_threshold ?? p?.lowStockAlert ?? 5,
    vatPercent: p?.vat_percent ?? p?.vatPercent ?? 5,
  });

  // Custom fields state
  const [customFields, setCustomFields] = useState<ShopField[]>([]);
  const [attrValues, setAttrValues] = useState<Record<string, string>>({});

  // Images state
  const [savedImages, setSavedImages] = useState<ProductImage[]>([]);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Variants state
  interface Variant { id?: number; size: string; color: string; sku: string; quantity: number; price: string; }
  const emptyVariant = (): Variant => ({ size: '', color: '', sku: '', quantity: 0, price: '' });
  const [variants, setVariants] = useState<Variant[]>([]);

  // TheDersi channel category state
  const [theDersiConnection, setTheDersiConnection] = useState<{ id: number } | null>(null);
  const [theDersiCategories, setTheDersiCategories] = useState<{ id: string; name: string; parent_id?: string | null }[]>([]);
  const [theDersiCategoryId, setTheDersiCategoryId] = useState('');
  const [theDersiCategoryName, setTheDersiCategoryName] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(false);

  const totalImages = savedImages.length + pendingImages.length;
  const MAX_IMAGES = 6;

  // Load custom fields, existing product data, and TheDersi categories on mount
  useEffect(() => {
    if (!shopId) return;

    fieldsApi.getAll(shopId)
      .then((res) => setCustomFields(res.data ?? []))
      .catch(() => {});

    if (product?.id) {
      attributesApi.get(shopId, product.id)
        .then((res) => setAttrValues(res.data ?? {}))
        .catch(() => {});

      imagesApi.getAll(shopId, product.id)
        .then((res) => setSavedImages(res.data ?? []))
        .catch(() => {});

      variantsApi.getAll(shopId, product.id)
        .then((res) => setVariants((res.data ?? []).map((v: any) => ({
          id: v.id, size: v.size ?? '', color: v.color ?? '',
          sku: v.sku ?? '', quantity: v.quantity ?? 0,
          price: v.price != null ? String(v.price) : '',
        }))))
        .catch(() => {});
    }

    // Auto-refresh TheDersi categories every time form opens
    channelsApi.getConnections(shopId)
      .then((res) => {
        const dersi = (res.data ?? []).find((c: any) => c.channel_type === 'thedersi');
        if (!dersi) return;
        setTheDersiConnection({ id: dersi.id });
        setLoadingCategories(true);
        // Sync from TheDersi (fire-and-forget), then fetch cached list
        channelsApi.syncCategories(shopId, dersi.id)
          .catch(() => {})
          .finally(() => {
            channelsApi.getCategories(shopId, dersi.id)
              .then((r) => setTheDersiCategories(r.data ?? []))
              .catch(() => {})
              .finally(() => setLoadingCategories(false));
          });

        // If editing, load already-saved TheDersi category for this product
        if (product?.id) {
          channelsApi.getProductChannelCategories(shopId, product.id)
            .then((r) => {
              const entry = (r.data ?? []).find((s: any) => s.channel_connection_id === dersi.id);
              if (entry) {
                setTheDersiCategoryId(entry.channel_category_id);
                setTheDersiCategoryName(entry.channel_category_name);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [shopId, product?.id]);

  // Clean up preview URLs on unmount
  useEffect(() => {
    return () => {
      pendingImages.forEach((img) => URL.revokeObjectURL(img.preview));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = MAX_IMAGES - totalImages;
    const toAdd = files.slice(0, remaining);

    const newPending: PendingImage[] = toAdd.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPendingImages((prev) => [...prev, ...newPending]);
    e.target.value = '';
  };

  const removePendingImage = (index: number) => {
    setPendingImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const deleteSavedImage = async (imageId: number) => {
    if (!product?.id) return;
    setDeletingImageId(imageId);
    try {
      await imagesApi.delete(shopId, product.id, String(imageId));
      setSavedImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch {/* no-op */}
    setDeletingImageId(null);
  };

  const setPrimaryImage = async (imageId: number) => {
    if (!product?.id) return;
    try {
      await imagesApi.setPrimary(shopId, product.id, String(imageId));
      setSavedImages((prev) =>
        prev.map((img) => ({ ...img, is_primary: img.id === imageId }))
      );
    } catch {/* no-op */}
  };

  const setAttr = (key: string, value: string) => {
    setAttrValues((prev) => ({ ...prev, [key]: value }));
  };

  const toggleMultiselect = (key: string, option: string) => {
    const current = attrValues[key] ? attrValues[key].split(',').filter(Boolean) : [];
    const updated = current.includes(option)
      ? current.filter((v) => v !== option)
      : [...current, option];
    setAttrValues((prev) => ({ ...prev, [key]: updated.join(',') }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;
    setSaving(true);
    setError('');

    try {
      let productId: string;

      // Map camelCase form state to snake_case API fields
      const apiData = {
        name: formData.name,
        description: formData.description || null,
        sku: formData.sku || null,
        barcode: formData.barcode || null,
        price: formData.sellingPrice,
        compare_at_price: formData.compareAtPrice > 0 ? formData.compareAtPrice : null,
        cost_price: formData.costPrice > 0 ? formData.costPrice : null,
        quantity: formData.stock,
        low_stock_threshold: formData.lowStockAlert,
      };

      if (product?.id) {
        await productsApi.update(shopId, product.id, apiData);
        productId = product.id;
      } else {
        const res = await productsApi.create(shopId, apiData);
        productId = res.data.id ?? String(res.data.id);
      }

      // Upload pending images
      for (const pending of pendingImages) {
        try {
          await imagesApi.upload(shopId, productId, pending.file);
        } catch {/* skip failed uploads */}
      }

      // Save custom attributes
      const attrsPayload = Object.entries(attrValues)
        .filter(([, v]) => v !== '' && v !== undefined)
        .map(([field_key, value]) => ({ field_key, value }));

      if (attrsPayload.length > 0 || customFields.length > 0) {
        try {
          await attributesApi.save(shopId, productId, attrsPayload);
        } catch {/* no-op */}
      }

      // Save variants if any are defined
      if (variants.length > 0) {
        try {
          await variantsApi.save(shopId, productId, variants.map((v) => ({
            size: v.size || undefined,
            color: v.color || undefined,
            sku: v.sku || undefined,
            quantity: v.quantity,
            price: v.price !== '' ? Number(v.price) : undefined,
          })));
        } catch {/* no-op */}
      }

      // Save TheDersi category if selected
      if (theDersiConnection && theDersiCategoryId) {
        try {
          await channelsApi.setProductCategory(shopId, productId, {
            channel_connection_id: theDersiConnection.id,
            channel_category_id: theDersiCategoryId,
            channel_category_name: theDersiCategoryName,
          });
        } catch {/* no-op — product still saved */}
      }

      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Failed to save product. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-5xl max-h-[94vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold text-foreground">{product ? 'Edit Product' : 'Add Product'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="grid lg:grid-cols-[1fr_300px] min-h-0">

            {/* ── LEFT: Content ──────────────────────────────────────── */}
            <div className="p-6 space-y-6 border-r border-border">

              {/* Alerts */}
              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}
              {channelStatus?.status === 'rejected' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">Rejected on TheDersi</p>
                    {channelStatus.rejection_reason && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">{channelStatus.rejection_reason}</p>
                    )}
                    <p className="text-xs text-red-500/80 mt-1">Fix the issue and save — it will be re-submitted for review.</p>
                  </div>
                </div>
              )}

              {/* Product Name */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Product Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g. iPhone 15 Pro Max"
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground text-base"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Describe the product — material, style, occasion..."
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground resize-none"
                />
              </div>

              {/* Images */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-muted-foreground">
                    Product Images
                    <span className="ml-1.5 text-xs font-normal">({totalImages}/{MAX_IMAGES})</span>
                  </label>
                  {totalImages < MAX_IMAGES && (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition">
                      <Upload className="w-3.5 h-3.5" /> Upload
                    </button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={handleFileSelect} />
                <div className="grid grid-cols-6 gap-2">
                  {savedImages.map((img) => (
                    <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                      <img src={img.url} alt={img.alt_text ?? ''} className="w-full h-full object-cover" />
                      {img.is_primary && (
                        <div className="absolute top-1 left-1 bg-yellow-400 rounded-full p-0.5">
                          <Star className="w-2.5 h-2.5 text-yellow-900 fill-yellow-900" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                        {!img.is_primary && (
                          <button type="button" onClick={() => setPrimaryImage(img.id)} title="Set as primary" className="p-1 bg-yellow-400 rounded-full hover:bg-yellow-300 transition">
                            <Star className="w-3 h-3 text-yellow-900" />
                          </button>
                        )}
                        <button type="button" onClick={() => deleteSavedImage(img.id)} disabled={deletingImageId === img.id} title="Delete" className="p-1 bg-destructive rounded-full hover:bg-destructive/80 transition">
                          {deletingImageId === img.id ? <Loader2 className="w-3 h-3 text-white animate-spin" /> : <X className="w-3 h-3 text-white" />}
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingImages.map((img, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-primary/40 bg-muted">
                      <img src={img.preview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute top-1 right-1 bg-primary/80 rounded-full px-1 py-0.5">
                        <span className="text-[10px] text-white font-medium">New</span>
                      </div>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <button type="button" onClick={() => removePendingImage(idx)} className="p-1 bg-destructive rounded-full hover:bg-destructive/80 transition">
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {totalImages < MAX_IMAGES && (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition">
                      <ImageIcon className="w-5 h-5 mb-1" />
                      <span className="text-xs">Add</span>
                    </button>
                  )}
                </div>
                {totalImages === 0 && <p className="text-xs text-muted-foreground mt-1.5">Upload up to 6 images. First image is set as primary.</p>}
              </div>

              {/* SKU + Barcode */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">SKU</label>
                  <input type="text" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} placeholder="IPH15PM-256" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Barcode</label>
                  <div className="flex gap-2">
                    <input type="text" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} placeholder="Scan or type" className="flex-1 px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />
                    <button type="button" onClick={() => setFormData({ ...formData, barcode: generateBarcode() })} className="px-3 py-2 text-xs font-medium bg-muted border border-border rounded-lg hover:bg-primary/10 hover:border-primary text-muted-foreground hover:text-primary transition whitespace-nowrap">
                      Generate
                    </button>
                  </div>
                  {formData.barcode && (
                    <div className="mt-2 bg-white rounded-lg p-2 border border-border">
                      <BarcodeDisplay value={formData.barcode} height={45} fontSize={11} />
                    </div>
                  )}
                </div>
              </div>

              {/* Variants */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Sizes & Colors</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Variants with individual stock counts</p>
                  </div>
                  <button type="button" onClick={() => setVariants((v) => [...v, emptyVariant()])} className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition font-medium">
                    <Plus className="w-3.5 h-3.5" /> Add Variant
                  </button>
                </div>
                {variants.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3 bg-muted/30 rounded-lg">No variants — click "Add Variant" to add sizes and colors.</p>
                ) : (
                  <>
                    {variants.map((v, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-3">
                          {i === 0 && <label className="text-xs text-muted-foreground mb-1 block">Size</label>}
                          <input type="text" value={v.size} onChange={(e) => setVariants((arr) => arr.map((r, j) => j === i ? { ...r, size: e.target.value } : r))} placeholder="S / M / XL" className="w-full px-2.5 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none" />
                        </div>
                        <div className="col-span-3">
                          {i === 0 && <label className="text-xs text-muted-foreground mb-1 block">Color</label>}
                          <input type="text" value={v.color} onChange={(e) => setVariants((arr) => arr.map((r, j) => j === i ? { ...r, color: e.target.value } : r))} placeholder="Red / Blue" className="w-full px-2.5 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none" />
                        </div>
                        <div className="col-span-2">
                          {i === 0 && <label className="text-xs text-muted-foreground mb-1 block">Stock</label>}
                          <input type="number" value={v.quantity} min={0} onChange={(e) => setVariants((arr) => arr.map((r, j) => j === i ? { ...r, quantity: Number(e.target.value) } : r))} className="w-full px-2.5 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none" />
                        </div>
                        <div className="col-span-3">
                          {i === 0 && <label className="text-xs text-muted-foreground mb-1 block">Price (blank = default)</label>}
                          <input type="number" value={v.price} min={0} onChange={(e) => setVariants((arr) => arr.map((r, j) => j === i ? { ...r, price: e.target.value } : r))} placeholder={String(formData.sellingPrice)} className="w-full px-2.5 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary outline-none" />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          {i === 0 && <div className="mb-1 h-4" />}
                          <button type="button" onClick={() => setVariants((arr) => arr.filter((_, j) => j !== i))} className="p-2 text-muted-foreground hover:text-destructive transition rounded-lg hover:bg-destructive/10">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">Total stock: <strong>{variants.reduce((s, v) => s + v.quantity, 0)}</strong></p>
                  </>
                )}
              </section>

              {/* Custom Fields */}
              {customFields.length > 0 ? (
                <section className="space-y-4">
                  <p className="text-sm font-medium text-foreground">Additional Details</p>
                  {customFields.map((field) => (
                    <div key={field.field_key}>
                      <label className="text-sm text-muted-foreground mb-1.5 flex items-center gap-1">
                        {field.label}{field.is_required && <span className="text-destructive">*</span>}
                      </label>
                      {field.field_type === 'text' && <input type="text" value={attrValues[field.field_key] ?? ''} onChange={(e) => setAttr(field.field_key, e.target.value)} required={field.is_required} placeholder={field.label} className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />}
                      {field.field_type === 'number' && <input type="number" value={attrValues[field.field_key] ?? ''} onChange={(e) => setAttr(field.field_key, e.target.value)} required={field.is_required} placeholder="0" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />}
                      {field.field_type === 'date' && <input type="date" value={attrValues[field.field_key] ?? ''} onChange={(e) => setAttr(field.field_key, e.target.value)} required={field.is_required} className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />}
                      {field.field_type === 'dropdown' && (
                        <select value={attrValues[field.field_key] ?? ''} onChange={(e) => setAttr(field.field_key, e.target.value)} required={field.is_required} className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground">
                          <option value="">Select {field.label}...</option>
                          {(field.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      )}
                      {field.field_type === 'multiselect' && (
                        <div className="flex flex-wrap gap-2">
                          {(field.options ?? []).map((opt) => {
                            const selected = (attrValues[field.field_key] ?? '').split(',').filter(Boolean).includes(opt);
                            return (
                              <button key={opt} type="button" onClick={() => toggleMultiselect(field.field_key, opt)} className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-foreground border-border hover:border-primary/50'}`}>
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {field.field_type === 'toggle' && (
                        <button type="button" onClick={() => setAttr(field.field_key, attrValues[field.field_key] === 'true' ? 'false' : 'true')} className="flex items-center gap-2 text-sm text-foreground">
                          {attrValues[field.field_key] === 'true' ? <ToggleRight className="w-8 h-8 text-primary" /> : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
                          <span>{attrValues[field.field_key] === 'true' ? 'Yes' : 'No'}</span>
                        </button>
                      )}
                    </div>
                  ))}
                </section>
              ) : (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                  No custom fields yet. Go to <strong>Settings → Product Fields</strong> to add fields like Brand, IMEI, Color.
                </p>
              )}
            </div>

            {/* ── RIGHT: Sidebar ─────────────────────────────────────── */}
            <div className="p-6 space-y-6 bg-muted/20">

              {/* Category — hidden for TheDersi sellers who use TheDersi categories instead */}
              {!theDersiConnection && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                    className="w-full px-3 py-2.5 bg-card border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground"
                  >
                    {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              )}

              {/* TheDersi Category */}
              {theDersiConnection && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                    TheDersi Category
                    {loadingCategories && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                  </label>
                  <select
                    value={theDersiCategoryId}
                    onChange={(e) => {
                      const opt = theDersiCategories.find((c) => c.id === e.target.value);
                      setTheDersiCategoryId(e.target.value);
                      setTheDersiCategoryName(opt?.name ?? '');
                    }}
                    className="w-full px-3 py-2.5 bg-card border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground"
                    disabled={loadingCategories}
                  >
                    <option value="">Select TheDersi category</option>
                    {(() => {
                      const parents = theDersiCategories.filter(c => !c.parent_id);
                      const children = (parentId: string) => theDersiCategories.filter(c => c.parent_id === parentId);
                      return parents.map(cat => {
                        const subs = children(cat.id);
                        if (subs.length > 0) {
                          return (
                            <optgroup key={cat.id} label={cat.name}>
                              <option value={cat.id}>{cat.name} — All</option>
                              {subs.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                            </optgroup>
                          );
                        }
                        return <option key={cat.id} value={cat.id}>{cat.name}</option>;
                      });
                    })()}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1.5">Listed under this category on TheDersi.</p>
                </div>
              )}

              <div className="border-t border-border" />

              {/* Pricing */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Pricing</p>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Cost Price ({sym}) *</label>
                  <input type="number" value={formData.costPrice} onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })} required min="0" className="w-full px-3 py-2.5 bg-card border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Selling Price ({sym}) *</label>
                  <input type="number" value={formData.sellingPrice} onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })} required min="0" className="w-full px-3 py-2.5 bg-card border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Original Price ({sym})
                    <span className="ml-1 font-normal opacity-60">— if on offer</span>
                  </label>
                  <input type="number" value={formData.compareAtPrice || ''} onChange={(e) => setFormData({ ...formData, compareAtPrice: Number(e.target.value) })} min="0" placeholder={formData.sellingPrice > 0 ? String(Math.round(formData.sellingPrice * 1.3)) : ''} className="w-full px-3 py-2.5 bg-card border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />
                </div>

                {/* Profit preview */}
                {formData.costPrice > 0 && formData.sellingPrice > 0 && (
                  <div className="bg-muted rounded-lg p-3 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Profit</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {formData.sellingPrice - formData.costPrice} {sym} ({Math.round(((formData.sellingPrice - formData.costPrice) / formData.costPrice) * 100)}%)
                      </span>
                    </div>
                    {formData.compareAtPrice > formData.sellingPrice && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Discount</span>
                        <span className="font-semibold text-red-500">
                          {Math.round((1 - formData.sellingPrice / formData.compareAtPrice) * 100)}% OFF
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-border" />

              {/* Stock */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Inventory</p>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Stock Quantity</label>
                  <input type="number" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })} min="0" className="w-full px-3 py-2.5 bg-card border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Low Stock Alert</label>
                  <input type="number" value={formData.lowStockAlert} onChange={(e) => setFormData({ ...formData, lowStockAlert: Number(e.target.value) })} min="0" className="w-full px-3 py-2.5 bg-card border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Save */}
              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Saving...' : product ? 'Update Product' : 'Add Product'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition disabled:opacity-50 text-sm"
                >
                  Cancel
                </button>
              </div>

            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
