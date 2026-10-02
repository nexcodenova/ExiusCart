'use client';

// AI Product Creator: a few words + a photo in, a complete product out.
// The AI writes the listing (title, description, Google result, highlights,
// FAQ, keywords); the seller ticks what to keep; it's created the normal way
// (plan product limits apply) as a hidden draft, with the photo attached.
// Then they can make studio/model images for it right here.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wand2, Upload, CheckCircle2, ExternalLink, X } from 'lucide-react';
import { aiStudioApi, productsApi, imagesApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AiCopyStudio, { AiCopy } from '@/components/ai-studio/AiCopyStudio';
import AiImageStudio from '@/components/ai-studio/AiImageStudio';

export default function Page() {
  const [shopId, setShopId] = useState('');
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [created, setCreated] = useState<{ id: number; name: string; photos: string[]; photoError?: string } | null>(null);

  useEffect(() => { setShopId(localStorage.getItem('shop_id') || ''); }, []);
  useEffect(() => {
    if (!photo) { setPreview(''); return; }
    const u = URL.createObjectURL(photo);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);

  const priceNum = parseFloat(price);
  const ready = name.trim().length > 1 && priceNum > 0;

  const create = async (c: AiCopy) => {
    const res = await productsApi.create(shopId, {
      name: (c.title || name).trim(),
      description: c.description_html || details || null,
      price: priceNum,
      quantity: 0,
      seo_title: c.seo_title || null,
      meta_description: c.meta_description || null,
      seo_keywords: c.keywords?.length ? c.keywords : null,
      highlights: c.benefits?.length ? c.benefits.map((label) => ({ icon: 'check-circle', label })) : null,
      faq: c.faq?.length ? c.faq : null,
      is_active: false, // a hidden draft until the seller checks it and adds stock
    });
    const id = res.data.id;
    let photos: string[] = [];
    let photoError: string | undefined;
    if (photo) {
      try {
        await imagesApi.upload(shopId, String(id), photo);
        const imgs = await imagesApi.getAll(shopId, String(id));
        photos = (imgs.data ?? []).map((i: { url: string }) => i.url);
      } catch {
        photoError = 'The product was created, but the photo could not be uploaded. Add it from the product page.';
      }
    }
    setCreated({ id, name: (c.title || name).trim(), photos, photoError });
  };

  const reset = () => { setCreated(null); setName(''); setDetails(''); setCategory(''); setPrice(''); setPhoto(null); };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Wand2 className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Product Creator</h1>
          <p className="text-sm text-muted-foreground">Describe a product in a few words. AI writes the whole listing, ready for Google and for buyers.</p>
        </div>
      </div>

      {created ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold text-foreground">&ldquo;{created.name}&rdquo; is created as a hidden draft.</p>
                  <p className="text-sm text-muted-foreground">Open it to add stock and variants, then switch it on to publish.</p>
                  {created.photoError && <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">{created.photoError}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild><Link href={`/dashboard/products?edit=${created.id}`}><ExternalLink className="h-4 w-4" /> Open product</Link></Button>
                <Button variant="outline" onClick={reset}>Create another</Button>
              </div>
            </CardContent>
          </Card>
          {created.photos.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Make better photos for it (optional)</CardTitle></CardHeader>
              <CardContent>
                <AiImageStudio shopId={shopId} productId={created.id} photos={created.photos}
                  onImageAdded={() => imagesApi.getAll(shopId, String(created.id)).then((r) => setCreated((c) => c && { ...c, photos: (r.data ?? []).map((i: { url: string }) => i.url) })).catch(() => {})} />
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card>
              <CardHeader><CardTitle className="text-base">1. Tell us about the product</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label className="mb-1.5 block">What is it? *</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Oversized cotton t-shirt with sunset print" maxLength={200} />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Selling price *</Label>
                    <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Category</Label>
                    <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Men's clothing" maxLength={100} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="mb-1.5 block">Anything you know about it</Label>
                    <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} maxLength={3000}
                      placeholder="Material, sizes, colours, who it's for, what makes it different… The AI only uses what you write here." />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="mb-1.5 block">Product photo</Label>
                    {preview ? (
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preview} alt="" className="h-20 w-20 rounded-lg border border-border object-cover" />
                        <Button type="button" variant="ghost" size="sm" onClick={() => setPhoto(null)}><X className="h-4 w-4" /> Remove</Button>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground hover:bg-muted/50">
                        <Upload className="h-4 w-4" /> Upload a photo (JPG or PNG)
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
                      </label>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">2. Let AI write it</CardTitle></CardHeader>
              <CardContent>
                {!ready && <p className="mb-3 text-sm text-muted-foreground">Fill in what it is and the price first.</p>}
                <AiCopyStudio
                  disabled={!ready || !shopId}
                  load={async () => (await aiStudioApi.write(shopId, {
                    name: name.trim(), details: details.trim() || undefined, category: category.trim() || undefined, price: priceNum || undefined,
                  })).data}
                  onApply={create}
                  startLabel="Write the listing"
                  applyLabel="Create product with"
                />
              </CardContent>
            </Card>
          </div>
          <Card className="h-fit">
            <CardHeader><CardTitle className="text-base">How it works</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal pl-4">
                <li>Describe the product and add a photo.</li>
                <li>AI finds the keywords buyers search for and writes the title, description, Google result, highlights and FAQ.</li>
                <li>Tick what you like and create it. It is saved as a hidden draft.</li>
                <li>Make studio or model photos for it, add stock, then publish.</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
