'use client';

import { useState, useEffect, useCallback, useRef, ChangeEvent } from 'react';
import {
  Plus, Search, Edit, Trash2, Package, X, ChevronDown,
  Star, Upload, ImageIcon, ToggleLeft, ToggleRight, Loader2,
  FileSpreadsheet, Download, CheckCircle, AlertCircle,
} from 'lucide-react';
import { productsApi, fieldsApi, attributesApi, imagesApi } from '@/lib/api';
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
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="p-16 text-center">
            <Package className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold text-foreground mb-1">
              {searchQuery || selectedCategory !== 'All' ? 'No products found' : 'No products yet'}
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              {searchQuery || selectedCategory !== 'All'
                ? 'Try adjusting your search or filters'
                : 'Add your first product to start selling'}
            </p>
            {!searchQuery && selectedCategory === 'All' && (
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
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-muted/30 transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                            {product.image
                              ? <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                              : <Package className="w-6 h-6 text-muted-foreground" />}
                          </div>
                          <span className="font-medium text-foreground">{product.name}</span>
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
              {products.map((product) => (
                <div key={product.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {product.image ? <img src={product.image} alt={product.name} className="w-full h-full object-cover" /> : <Package className="w-8 h-8 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate">{product.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{product.sku}</p>
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
  product, shopId, categories, onClose, onSaved,
}: {
  product: Product | null;
  shopId: string;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { sym } = useCurrency();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    barcode: product?.barcode ?? '',
    category: product?.category ?? categories[0] ?? '',
    costPrice: product?.costPrice ?? 0,
    sellingPrice: product?.sellingPrice ?? 0,
    stock: product?.stock ?? 0,
    lowStockAlert: product?.lowStockAlert ?? 5,
    vatPercent: product?.vatPercent ?? 5,
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

  const totalImages = savedImages.length + pendingImages.length;
  const MAX_IMAGES = 6;

  // Load custom fields and existing data on mount
  useEffect(() => {
    if (!shopId) return;

    // Load custom fields
    fieldsApi.getAll(shopId)
      .then((res) => setCustomFields(res.data ?? []))
      .catch(() => {});

    // If editing, load existing attributes + images
    if (product?.id) {
      attributesApi.get(shopId, product.id)
        .then((res) => setAttrValues(res.data ?? {}))
        .catch(() => {});

      imagesApi.getAll(shopId, product.id)
        .then((res) => setSavedImages(res.data ?? []))
        .catch(() => {});
    }
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

      if (product?.id) {
        await productsApi.update(shopId, product.id, formData);
        productId = product.id;
      } else {
        const res = await productsApi.create(shopId, formData);
        productId = res.data.id ?? res.data._id ?? String(res.data.id);
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

      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Failed to save product. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold text-foreground">{product ? 'Edit Product' : 'Add Product'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-4 space-y-5">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* ── Product Images ─────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">
                Product Images
                <span className="ml-1.5 text-xs text-muted-foreground font-normal">({totalImages}/{MAX_IMAGES})</span>
              </label>
              {totalImages < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition"
                >
                  <Upload className="w-3.5 h-3.5" /> Upload
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {/* Saved images */}
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
                      <button
                        type="button"
                        onClick={() => setPrimaryImage(img.id)}
                        title="Set as primary"
                        className="p-1 bg-yellow-400 rounded-full hover:bg-yellow-300 transition"
                      >
                        <Star className="w-3 h-3 text-yellow-900" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteSavedImage(img.id)}
                      disabled={deletingImageId === img.id}
                      title="Delete image"
                      className="p-1 bg-destructive rounded-full hover:bg-destructive/80 transition"
                    >
                      {deletingImageId === img.id
                        ? <Loader2 className="w-3 h-3 text-white animate-spin" />
                        : <X className="w-3 h-3 text-white" />}
                    </button>
                  </div>
                </div>
              ))}

              {/* Pending images (not yet uploaded) */}
              {pendingImages.map((img, idx) => (
                <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-primary/40 bg-muted">
                  <img src={img.preview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute top-1 right-1 bg-primary/80 rounded-full px-1 py-0.5">
                    <span className="text-[10px] text-white font-medium">New</span>
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => removePendingImage(idx)}
                      title="Remove"
                      className="p-1 bg-destructive rounded-full hover:bg-destructive/80 transition"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Add slot */}
              {totalImages < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition"
                >
                  <ImageIcon className="w-5 h-5 mb-1" />
                  <span className="text-xs">Add</span>
                </button>
              )}
            </div>
            {totalImages === 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">Upload up to 6 images. First image will be set as primary.</p>
            )}
          </section>

          {/* ── Basic Info ─────────────────────────────────────────────── */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-foreground border-b border-border pb-2">Basic Information</h3>

            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Product Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g. iPhone 15 Pro Max"
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">SKU</label>
                <input type="text" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} placeholder="IPH15PM-256" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Barcode</label>
                <input type="text" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} placeholder="Scan or type" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Category *</label>
              <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} required className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground">
                {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
          </section>

          {/* ── Pricing ────────────────────────────────────────────────── */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-foreground border-b border-border pb-2">Pricing & Stock</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Cost Price ({sym}) *</label>
                <input type="number" value={formData.costPrice} onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })} required min="0" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Selling Price ({sym}) *</label>
                <input type="number" value={formData.sellingPrice} onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })} required min="0" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />
              </div>
            </div>

            {formData.costPrice > 0 && formData.sellingPrice > 0 && (
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Profit Margin</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {formData.sellingPrice - formData.costPrice} {sym} ({Math.round(((formData.sellingPrice - formData.costPrice) / formData.costPrice) * 100)}%)
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Stock Quantity</label>
                <input type="number" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })} min="0" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Low Stock Alert</label>
                <input type="number" value={formData.lowStockAlert} onChange={(e) => setFormData({ ...formData, lowStockAlert: Number(e.target.value) })} min="0" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />
              </div>
            </div>
          </section>

          {/* ── Custom Fields ──────────────────────────────────────────── */}
          {customFields.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-sm font-medium text-foreground border-b border-border pb-2">
                Additional Details
                <span className="ml-2 text-xs text-muted-foreground font-normal">Custom fields for your shop</span>
              </h3>

              {customFields.map((field) => (
                <div key={field.field_key}>
                  <label className="text-sm text-muted-foreground mb-1.5 flex items-center gap-1">
                    {field.label}
                    {field.is_required && <span className="text-destructive">*</span>}
                  </label>

                  {field.field_type === 'text' && (
                    <input
                      type="text"
                      value={attrValues[field.field_key] ?? ''}
                      onChange={(e) => setAttr(field.field_key, e.target.value)}
                      required={field.is_required}
                      placeholder={field.label}
                      className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground"
                    />
                  )}

                  {field.field_type === 'number' && (
                    <input
                      type="number"
                      value={attrValues[field.field_key] ?? ''}
                      onChange={(e) => setAttr(field.field_key, e.target.value)}
                      required={field.is_required}
                      placeholder="0"
                      className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground"
                    />
                  )}

                  {field.field_type === 'date' && (
                    <input
                      type="date"
                      value={attrValues[field.field_key] ?? ''}
                      onChange={(e) => setAttr(field.field_key, e.target.value)}
                      required={field.is_required}
                      className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground"
                    />
                  )}

                  {field.field_type === 'dropdown' && (
                    <select
                      value={attrValues[field.field_key] ?? ''}
                      onChange={(e) => setAttr(field.field_key, e.target.value)}
                      required={field.is_required}
                      className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground"
                    >
                      <option value="">Select {field.label}...</option>
                      {(field.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {field.field_type === 'multiselect' && (
                    <div className="flex flex-wrap gap-2">
                      {(field.options ?? []).map((opt) => {
                        const selected = (attrValues[field.field_key] ?? '').split(',').filter(Boolean).includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => toggleMultiselect(field.field_key, opt)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                              selected
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-muted text-foreground border-border hover:border-primary/50'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {field.field_type === 'toggle' && (
                    <button
                      type="button"
                      onClick={() => setAttr(field.field_key, attrValues[field.field_key] === 'true' ? 'false' : 'true')}
                      className="flex items-center gap-2 text-sm text-foreground"
                    >
                      {attrValues[field.field_key] === 'true'
                        ? <ToggleRight className="w-8 h-8 text-primary" />
                        : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
                      <span>{attrValues[field.field_key] === 'true' ? 'Yes' : 'No'}</span>
                    </button>
                  )}
                </div>
              ))}
            </section>
          )}

          {customFields.length === 0 && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              No custom fields yet. Go to <strong>Settings → Product Fields</strong> to add fields specific to your business (e.g. Brand, Size, IMEI, Color).
            </p>
          )}

          {/* ── Actions ────────────────────────────────────────────────── */}
          <div className="flex gap-3 pt-2 pb-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : product ? 'Update Product' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
