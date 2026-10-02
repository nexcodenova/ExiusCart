'use client';

// Design -> Gelato product, from a template the seller made once in Gelato
// (Gelato only creates products from templates). Backend: pod_push.py.

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { podApi, StudioAsset } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { aiErrorText } from './AiCopyStudio';

type Template = { id: string; title: string; variants: { id: string; title: string; placeholders: string[] }[]; preview?: string | null };

export function GelatoPanel({ shopId, asset, onClose }: { shopId: string; asset: StudioAsset | null; onClose: () => void }) {
  const [templateId, setTemplateId] = useState('');
  const [template, setTemplate] = useState<Template | null>(null);
  const [title, setTitle] = useState(asset?.title ?? '');
  const [description, setDescription] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState<'' | 'load' | 'create'>('');
  const [error, setError] = useState('');
  const [notConnected, setNotConnected] = useState(false);
  const [done, setDone] = useState<{ gelato_product_id: string } | null>(null);

  const load = async () => {
    setBusy('load'); setError(''); setTemplate(null);
    try {
      const r = await podApi.gelatoTemplate(shopId, templateId.trim());
      setTemplate(r.data);
    } catch (e: any) {
      if (e?.response?.data?.detail?.error === 'gelato_not_connected') setNotConnected(true);
      else setError(aiErrorText(e, 'Could not find that template.'));
    } finally { setBusy(''); }
  };

  const create = async () => {
    if (!asset || !template) return;
    setBusy('create'); setError('');
    try {
      const r = await podApi.sendToGelato(shopId, asset.id, { template_id: template.id, title: title.trim(), description: description.trim() || undefined, visible });
      setDone(r.data);
    } catch (e: any) { setError(aiErrorText(e, 'Gelato could not create the product.')); } finally { setBusy(''); }
  };

  if (notConnected) {
    return (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>Connect your Gelato account first.</p>
        <Button asChild><Link href="/dashboard/dropshipping">Connect Gelato</Link></Button>
      </div>
    );
  }
  if (done) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
          <p className="text-sm"><span className="font-medium text-foreground">Created in Gelato.</span> <span className="text-muted-foreground">Find it in your Gelato store&apos;s products. Gelato makes its mockups for you there.</span></p>
        </div>
        <Button onClick={onClose}>Done</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        Gelato creates products from a <strong>template</strong>. Make one once in Gelato (pick the product, colours and sizes, add any image as a placeholder), copy its <strong>Template ID</strong>, and paste it here. Your design is put into every image area of the template.
      </div>
      <div className="flex gap-2">
        <Input value={templateId} onChange={(e) => setTemplateId(e.target.value)} placeholder="Gelato template ID" />
        <Button variant="outline" onClick={load} disabled={!templateId.trim() || busy === 'load'}>{busy === 'load' && <Loader2 className="h-4 w-4 animate-spin" />} Load</Button>
      </div>
      {template && (
        <>
          <div className="flex items-center gap-3 rounded-lg border border-border p-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {template.preview && <img src={template.preview} alt="" className="h-12 w-12 rounded object-cover" />}
            <div className="text-sm"><p className="font-medium text-foreground">{template.title}</p><p className="text-muted-foreground">{template.variants.length} variants</p></div>
          </div>
          <div><Label className="mb-1.5 block">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></div>
          <div><Label className="mb-1.5 block">Description (optional)</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={visible} onCheckedChange={(v) => setVisible(!!v)} /> Show it in my Gelato-connected store right away</label>
        </>
      )}
      {error && <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</div>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button onClick={create} disabled={!template || !title.trim() || busy === 'create'}>{busy === 'create' && <Loader2 className="h-4 w-4 animate-spin" />} Create in Gelato</Button>
      </div>
    </div>
  );
}
