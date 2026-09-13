'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Gift, Plus, X, Upload, Loader2, Edit, Trash2, Check } from 'lucide-react';
import { productsApi, imagesApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface GiftCardProduct {
  id: number;
  name: string;
  price: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export default function GiftCardsPage() {
  const [shopId, setShopId] = useState('');
  const [cards, setCards] = useState<GiftCardProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<GiftCardProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GiftCardProduct | null>(null);
  const { fmt, baseSym } = useCurrency();

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const fetchCards = useCallback(() => {
    if (!shopId) return;
    setLoading(true);
    productsApi.getAll(shopId, { is_gift_card: true })
      .then((r) => setCards(r.data ?? []))
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, [shopId]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const handleToggleActive = async (c: GiftCardProduct) => {
    try {
      await productsApi.update(shopId, String(c.id), { is_active: !c.is_active });
      fetchCards();
    } catch {}
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await productsApi.delete(shopId, String(deleteTarget.id));
      setDeleteTarget(null);
      fetchCards();
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Gift Cards</h1>
          <p className="text-sm text-muted-foreground">Prepaid gift cards your customers can buy — just an image, name and value, nothing else.</p>
        </div>
        <button type="button" onClick={() => { setEditing(null); setShowModal(true); }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90">
          <Plus className="h-4 w-4" /> Add gift card
        </button>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
        Phase 1: this creates a real product customers can buy. Redemption (issuing a code, tracking balance, applying it at checkout) is coming in a later update.
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : cards.length === 0 ? (
        <div className="border border-border rounded-2xl bg-card p-16 text-center">
          <Gift className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="font-semibold text-foreground mb-1">No gift cards yet</h3>
          <p className="text-sm text-muted-foreground mb-5">Add one with a photo, a name, and a value.</p>
          <button type="button" onClick={() => { setEditing(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition">
            <Plus className="w-4 h-4" /> Add your first gift card
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-xl overflow-hidden flex flex-col group">
              <div className="relative aspect-square bg-muted">
                {c.image_url ? (
                  <Image src={c.image_url} alt={c.name} fill className="object-cover" unoptimized />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center"><Gift className="w-10 h-10 text-muted-foreground/30" /></div>
                )}
                {!c.is_active && (
                  <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/60 text-white">Inactive</span>
                )}
              </div>
              <div className="p-3 flex flex-col gap-2 flex-1">
                <p className="text-sm text-foreground font-medium line-clamp-2 leading-snug">{c.name}</p>
                <p className="text-base font-bold text-foreground mt-auto">{fmt(c.price, 0)}</p>
                <div className="flex items-center gap-1.5 pt-1 border-t border-border -mx-3 px-3 mt-1">
                  <button type="button" onClick={() => { setEditing(c); setShowModal(true); }}
                    className="flex-1 inline-flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted transition">
                    <Edit className="w-3 h-3" /> Edit
                  </button>
                  <button type="button" onClick={() => handleToggleActive(c)} title={c.is_active ? 'Deactivate' : 'Activate'}
                    className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition">
                    {c.is_active ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(c)}
                    className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <GiftCardModal
          shopId={shopId}
          card={editing}
          baseSym={baseSym}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={() => { setShowModal(false); setEditing(null); fetchCards(); }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete &ldquo;{deleteTarget.name}&rdquo;?</h3>
            <p className="text-sm text-muted-foreground mb-6">This removes it from your store. Any past orders for it are unaffected.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={handleDelete} className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GiftCardModal({ shopId, card, baseSym, onClose, onSaved }: {
  shopId: string;
  card: GiftCardProduct | null;
  baseSym: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(card?.name ?? '');
  const [price, setPrice] = useState(card ? String(card.price) : '');
  const [imagePreview, setImagePreview] = useState<string | null>(card?.image_url ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Give the gift card a name.'); return; }
    const priceNum = parseFloat(price);
    if (!priceNum || priceNum <= 0) { setError('Enter the card’s value.'); return; }
    setSaving(true);
    setError('');
    try {
      let productId: string;
      if (card) {
        await productsApi.update(shopId, String(card.id), { name: name.trim(), price: priceNum });
        productId = String(card.id);
      } else {
        const res = await productsApi.create(shopId, {
          name: name.trim(),
          price: priceNum,
          product_type: 'digital',
          is_gift_card: true,
          quantity: 999999,
        });
        productId = String(res.data.id);
      }
      if (imageFile) {
        await imagesApi.upload(shopId, productId, imageFile).catch(() => {});
      }
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Could not save this gift card. Check the fields and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{card ? 'Edit Gift Card' : 'Add Gift Card'}</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Image</label>
            {imagePreview ? (
              <div className="relative aspect-square w-full max-w-[160px] mx-auto rounded-xl overflow-hidden bg-muted">
                <Image src={imagePreview} alt="" fill className="object-cover" unoptimized />
                <button type="button" onClick={() => { setImagePreview(null); setImageFile(null); }}
                  className="absolute top-1.5 right-1.5 p-1 bg-black/60 text-white rounded-full hover:bg-black/80 transition">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-8 cursor-pointer hover:border-primary/40 transition">
                <Upload className="w-5 h-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Click to upload a photo</span>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
              </label>
            )}
          </div>

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
