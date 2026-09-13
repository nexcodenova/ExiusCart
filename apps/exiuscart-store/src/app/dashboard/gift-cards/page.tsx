'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Gift, Plus, X, Upload, Loader2, Edit, Trash2, Check, PackageOpen } from 'lucide-react';
import { productsApi, imagesApi, channelsApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface GiftProduct {
  id: number;
  name: string;
  price: number;
  quantity?: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

type Tab = 'cards' | 'items';

export default function GiftCardsPage() {
  const [shopId, setShopId] = useState('');
  const [tab, setTab] = useState<Tab>('cards');

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Gift Cards</h1>
        <p className="text-sm text-muted-foreground">Prepaid cards customers buy, and real products you give away free with an order.</p>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        <button type="button" onClick={() => setTab('cards')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${tab === 'cards' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          Gift Cards
        </button>
        <button type="button" onClick={() => setTab('items')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${tab === 'items' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          Free Gift Items
        </button>
      </div>

      {tab === 'cards' ? <GiftCardsTab shopId={shopId} /> : <FreeGiftItemsTab shopId={shopId} />}
    </div>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function GiftGrid({ items, loading, emptyIcon: EmptyIcon, emptyTitle, emptyBody, onAdd, onEdit, onToggle, onDelete, fmt }: {
  items: GiftProduct[];
  loading: boolean;
  emptyIcon: React.ElementType;
  emptyTitle: string;
  emptyBody: string;
  onAdd: () => void;
  onEdit: (p: GiftProduct) => void;
  onToggle: (p: GiftProduct) => void;
  onDelete: (p: GiftProduct) => void;
  fmt: (n: number, d?: number) => string;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="border border-border rounded-2xl bg-card p-16 text-center">
        <EmptyIcon className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
        <h3 className="font-semibold text-foreground mb-1">{emptyTitle}</h3>
        <p className="text-sm text-muted-foreground mb-5">{emptyBody}</p>
        <button type="button" onClick={onAdd}
          className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition">
          <Plus className="w-4 h-4" /> Add one
        </button>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((c) => (
        <div key={c.id} className="bg-card border border-border rounded-xl overflow-hidden flex flex-col group">
          <div className="relative aspect-square bg-muted">
            {c.image_url ? (
              <Image src={c.image_url} alt={c.name} fill className="object-cover" unoptimized />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center"><EmptyIcon className="w-10 h-10 text-muted-foreground/30" /></div>
            )}
            {!c.is_active && (
              <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/60 text-white">Inactive</span>
            )}
          </div>
          <div className="p-3 flex flex-col gap-2 flex-1">
            <p className="text-sm text-foreground font-medium line-clamp-2 leading-snug">{c.name}</p>
            <p className="text-base font-bold text-foreground mt-auto">{fmt(c.price, 0)}</p>
            <div className="flex items-center gap-1.5 pt-1 border-t border-border -mx-3 px-3 mt-1">
              <button type="button" onClick={() => onEdit(c)}
                className="flex-1 inline-flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted transition">
                <Edit className="w-3 h-3" /> Edit
              </button>
              <button type="button" onClick={() => onToggle(c)} title={c.is_active ? 'Deactivate' : 'Activate'}
                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition">
                {c.is_active ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button type="button" onClick={() => onDelete(c)}
                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DeleteConfirm({ name, onCancel, onConfirm }: { name: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border p-6 max-w-sm w-full">
        <h3 className="text-lg font-semibold text-foreground mb-2">Delete &ldquo;{name}&rdquo;?</h3>
        <p className="text-sm text-muted-foreground mb-6">This removes it from your store. Any past orders for it are unaffected.</p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
          <button type="button" onClick={onConfirm} className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Tab 1: Gift Cards (prepaid) ──────────────────────────────────────────────

function GiftCardsTab({ shopId }: { shopId: string }) {
  const [cards, setCards] = useState<GiftProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<GiftProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GiftProduct | null>(null);
  const { fmt, baseSym } = useCurrency();

  const fetchCards = useCallback(() => {
    if (!shopId) return;
    setLoading(true);
    productsApi.getAll(shopId, { is_gift_card: true })
      .then((r) => setCards(r.data ?? []))
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, [shopId]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const handleToggleActive = async (c: GiftProduct) => {
    try { await productsApi.update(shopId, String(c.id), { is_active: !c.is_active }); fetchCards(); } catch {}
  };
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await productsApi.delete(shopId, String(deleteTarget.id)); setDeleteTarget(null); fetchCards(); } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground max-w-lg">Redemption (issuing a code, tracking balance, applying it at checkout) is coming in a later update — for now this creates a real purchasable product.</p>
        <button type="button" onClick={() => { setEditing(null); setShowModal(true); }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 shrink-0">
          <Plus className="h-4 w-4" /> Add gift card
        </button>
      </div>

      <GiftGrid items={cards} loading={loading} emptyIcon={Gift} fmt={fmt}
        emptyTitle="No gift cards yet" emptyBody="Add one with a photo, a name, and a value."
        onAdd={() => { setEditing(null); setShowModal(true); }}
        onEdit={(c) => { setEditing(c); setShowModal(true); }}
        onToggle={handleToggleActive}
        onDelete={(c) => setDeleteTarget(c)} />

      {showModal && (
        <GiftCardModal shopId={shopId} card={editing} baseSym={baseSym}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={() => { setShowModal(false); setEditing(null); fetchCards(); }} />
      )}
      {deleteTarget && (
        <DeleteConfirm name={deleteTarget.name} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} />
      )}
    </div>
  );
}

function GiftCardModal({ shopId, card, baseSym, onClose, onSaved }: {
  shopId: string; card: GiftProduct | null; baseSym: string; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(card?.name ?? '');
  const [price, setPrice] = useState(card ? String(card.price) : '');
  const [imagePreview, setImagePreview] = useState<string | null>(card?.image_url ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFile = (file: File) => { setImageFile(file); setImagePreview(URL.createObjectURL(file)); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Give the gift card a name.'); return; }
    const priceNum = parseFloat(price);
    if (!priceNum || priceNum <= 0) { setError('Enter the card’s value.'); return; }
    setSaving(true); setError('');
    try {
      let productId: string;
      if (card) {
        await productsApi.update(shopId, String(card.id), { name: name.trim(), price: priceNum });
        productId = String(card.id);
      } else {
        const res = await productsApi.create(shopId, {
          name: name.trim(), price: priceNum, product_type: 'digital', is_gift_card: true, quantity: 999999,
        });
        productId = String(res.data.id);
      }
      if (imageFile) await imagesApi.upload(shopId, productId, imageFile).catch(() => {});
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Could not save this gift card. Check the fields and try again.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{card ? 'Edit Gift Card' : 'Add Gift Card'}</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <ImagePicker preview={imagePreview} onPick={handleFile} onClear={() => { setImagePreview(null); setImageFile(null); }} />
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
              placeholder="e.g. Rs 5,000 Gift Card"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Value ({baseSym})</label>
            <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
          </div>
          {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg hover:opacity-90 transition font-medium disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {card ? 'Save changes' : 'Add gift card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tab 2: Free Gift Items (real physical product, free at TheDersi checkout) ─

function FreeGiftItemsTab({ shopId }: { shopId: string }) {
  const [items, setItems] = useState<GiftProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [dersiConnectionId, setDersiConnectionId] = useState<number | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<GiftProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GiftProduct | null>(null);
  const { fmt, baseSym } = useCurrency();

  const fetchItems = useCallback(() => {
    if (!shopId) return;
    setLoading(true);
    productsApi.getAll(shopId, { is_gift: true })
      .then((r) => setItems(r.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [shopId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    if (!shopId) return;
    setCheckingConnection(true);
    channelsApi.getConnections(shopId)
      .then((r) => {
        const dersi = (r.data ?? []).find((c: any) => c.channel_type === 'thedersi');
        setDersiConnectionId(dersi ? dersi.id : null);
      })
      .catch(() => setDersiConnectionId(null))
      .finally(() => setCheckingConnection(false));
  }, [shopId]);

  const handleToggleActive = async (c: GiftProduct) => {
    try { await productsApi.update(shopId, String(c.id), { is_active: !c.is_active }); fetchItems(); } catch {}
  };
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await productsApi.delete(shopId, String(deleteTarget.id)); setDeleteTarget(null); fetchItems(); } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground max-w-lg">
          A real physical product you give away free with a qualifying order — listed on TheDersi with is_gift set, so it shows at $0 there while you still pack and ship it.
        </p>
        {!checkingConnection && dersiConnectionId && (
          <button type="button" onClick={() => { setEditing(null); setShowModal(true); }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 shrink-0">
            <Plus className="h-4 w-4" /> Add gift item
          </button>
        )}
      </div>

      {checkingConnection ? (
        <div className="h-48 bg-muted rounded-xl animate-pulse" />
      ) : !dersiConnectionId ? (
        <div className="border border-border rounded-2xl bg-card p-16 text-center">
          <PackageOpen className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="font-semibold text-foreground mb-1">Connect TheDersi first</h3>
          <p className="text-sm text-muted-foreground">Free gift items only apply to TheDersi&apos;s marketplace checkout — connect TheDersi under Sales Channels to use this.</p>
        </div>
      ) : (
        <GiftGrid items={items} loading={loading} emptyIcon={PackageOpen} fmt={fmt}
          emptyTitle="No free gift items yet" emptyBody="Add a real product with a photo and a name to give away free with an order."
          onAdd={() => { setEditing(null); setShowModal(true); }}
          onEdit={(c) => { setEditing(c); setShowModal(true); }}
          onToggle={handleToggleActive}
          onDelete={(c) => setDeleteTarget(c)} />
      )}

      {showModal && dersiConnectionId && (
        <FreeGiftItemModal shopId={shopId} item={editing} baseSym={baseSym} dersiConnectionId={dersiConnectionId}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={() => { setShowModal(false); setEditing(null); fetchItems(); }} />
      )}
      {deleteTarget && (
        <DeleteConfirm name={deleteTarget.name} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} />
      )}
    </div>
  );
}

function FreeGiftItemModal({ shopId, item, baseSym, dersiConnectionId, onClose, onSaved }: {
  shopId: string; item: GiftProduct | null; baseSym: string; dersiConnectionId: number; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [price, setPrice] = useState(item ? String(item.price) : '');
  const [quantity, setQuantity] = useState(item?.quantity != null ? String(item.quantity) : '10');
  const [imagePreview, setImagePreview] = useState<string | null>(item?.image_url ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFile = (file: File) => { setImageFile(file); setImagePreview(URL.createObjectURL(file)); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Give the item a name.'); return; }
    const priceNum = parseFloat(price);
    if (!priceNum || priceNum <= 0) { setError('Enter the item’s real value (shown to TheDersi as $0 since it’s free).'); return; }
    setSaving(true); setError('');
    try {
      let productId: string;
      if (item) {
        await productsApi.update(shopId, String(item.id), { name: name.trim(), price: priceNum, quantity: parseInt(quantity, 10) || 0 });
        productId = String(item.id);
      } else {
        const res = await productsApi.create(shopId, {
          name: name.trim(), price: priceNum, quantity: parseInt(quantity, 10) || 0,
          product_type: 'physical', is_gift: true, list_on_marketplace: true,
        });
        productId = String(res.data.id);
      }
      if (imageFile) await imagesApi.upload(shopId, productId, imageFile).catch(() => {});
      // Real source of truth for TheDersi's own catalog sync — see
      // ProductChannelCategory.is_gift in channels.py. Product.is_gift
      // above is set too for consistency, but this is what actually
      // pushes it to TheDersi as a free-gift listing.
      await channelsApi.setProductCategory(shopId, productId, {
        channel_connection_id: dersiConnectionId, is_listed: true, is_gift: true,
      }).catch(() => {});
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Could not save this gift item. Check the fields and try again.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{item ? 'Edit Gift Item' : 'Add Free Gift Item'}</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <ImagePicker preview={imagePreview} onPick={handleFile} onClear={() => { setImagePreview(null); setImageFile(null); }} />
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
              placeholder="e.g. Tote Bag"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Real value ({baseSym})</label>
              <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Stock on hand</label>
              <input type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">Shown to customers as free — the value above is just for your own records.</p>
          {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg hover:opacity-90 transition font-medium disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {item ? 'Save changes' : 'Add gift item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Shared image picker ───────────────────────────────────────────────────────

function ImagePicker({ preview, onPick, onClear }: { preview: string | null; onPick: (file: File) => void; onClear: () => void }) {
  return (
    <div>
      <label className="text-sm text-muted-foreground mb-1.5 block">Image</label>
      {preview ? (
        <div className="relative aspect-square w-full max-w-[160px] mx-auto rounded-xl overflow-hidden bg-muted">
          <Image src={preview} alt="" fill className="object-cover" unoptimized />
          <button type="button" onClick={onClear}
            className="absolute top-1.5 right-1.5 p-1 bg-black/60 text-white rounded-full hover:bg-black/80 transition">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-8 cursor-pointer hover:border-primary/40 transition">
          <Upload className="w-5 h-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Click to upload a photo</span>
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
        </label>
      )}
    </div>
  );
}
