'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Copy, Check, Download, ExternalLink, Loader2, Pencil, Plus, Trash2, Info } from 'lucide-react';
import { kdpApi, type KdpBook, type KdpPack, type KdpStatus } from '@/lib/api';
import ChannelLogo from '@/components/channels/ChannelLogo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useConfirm } from '@/components/ui/confirm-dialog';

const STATUS: Record<KdpStatus, { label: string; variant: 'muted' | 'default' | 'success' | 'outline' }> = {
  not_started: { label: 'Not started', variant: 'outline' },
  files_ready: { label: 'Files ready', variant: 'muted' },
  submitted: { label: 'Submitted to KDP', variant: 'default' },
  live: { label: 'Live on Amazon', variant: 'success' },
};

const STEPS = [
  { title: 'Buy a book on Prodora', desc: 'It appears here automatically. You can also add a book of your own.' },
  { title: 'Prepare for KDP', desc: 'Download the print-ready interior and cover PDFs and copy the listing text.' },
  { title: 'Upload on kdp.amazon.com', desc: 'Create a paperback, upload the two files and set your price. This step is done in KDP.' },
  { title: 'Mark it Live here', desc: 'Paste the Amazon link and your price to keep track of it.' },
  { title: 'Amazon does the rest', desc: 'Amazon lists, prints and ships every order and pays you a royalty.' },
];

function errText(e: any, fallback: string): string {
  const d = e?.response?.data?.detail;
  return typeof d === 'string' ? d : d?.message ?? fallback;
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button variant="outline" size="sm" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ }
    }}>
      {done ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />} {done ? 'Copied' : label}
    </Button>
  );
}

// ── Prepare files ─────────────────────────────────────────────────────────────
function PrepareDialog({ book, onClose, onDownloaded }: { book: KdpBook; onClose: () => void; onDownloaded: () => void }) {
  const [trim, setTrim] = useState(book.trim);
  const [paper, setPaper] = useState(book.paper);
  const [pack, setPack] = useState<KdpPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'interior' | 'cover'>('');

  useEffect(() => {
    if (!book.bundle_id) return;
    let stale = false;
    setLoading(true); setError('');
    kdpApi.pack(book.bundle_id, trim, paper)
      .then((r) => { if (!stale) setPack(r.data); })
      .catch((e) => { if (!stale) setError(errText(e, 'Could not prepare this book.')); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [book.bundle_id, trim, paper]);

  const download = async (kind: 'interior' | 'cover') => {
    if (!book.bundle_id) return;
    setBusy(kind); setError('');
    try {
      const r = await kdpApi.file(book.bundle_id, kind, trim, paper);
      saveBlob(r.data, `${book.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-kdp-${kind}.pdf`);
      onDownloaded();
    } catch (e: any) {
      // A failed blob request carries its JSON error as a Blob.
      let msg = 'Download failed. Try again.';
      try { const t = JSON.parse(await (e?.response?.data as Blob).text()); if (typeof t.detail === 'string') msg = t.detail; } catch { /* keep default */ }
      setError(msg);
    } finally { setBusy(''); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Prepare &ldquo;{book.title}&rdquo; for KDP</DialogTitle>
          <DialogDescription>Print-ready files for a KDP paperback. You upload them on kdp.amazon.com yourself.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 p-5">
          {!book.bundle_id ? (
            <p className="text-sm text-muted-foreground">This is a book you added yourself, so there is no Prodora file to prepare. Use your own interior and cover PDFs.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Trim size (inches)</Label>
                  <Select value={trim} onValueChange={setTrim}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(pack?.choices.trims ?? [trim]).map((t) => <SelectItem key={t} value={t}>{t.replace('x', ' × ')}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Paper and ink</Label>
                  <Select value={paper} onValueChange={setPaper}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(pack?.choices.papers ?? { [paper]: paper }).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
              {loading && <Skeleton className="h-40 w-full" />}

              {pack && !loading && (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { k: 'Pages', v: `${pack.interior.final_pages}`, s: pack.interior.blank_pages_added ? `${pack.interior.source_pages} + ${pack.interior.blank_pages_added} blank (KDP needs 24+)` : 'from the book' },
                      { k: 'Spine', v: `${pack.cover.spine_in.toFixed(3)} in`, s: pack.cover.spine_text_allowed ? 'spine text allowed' : 'no spine text under 79 pages' },
                      { k: 'Cover file', v: `${pack.cover.width_in.toFixed(3)} × ${pack.cover.height_in.toFixed(3)} in`, s: 'back + spine + front, with bleed' },
                    ].map((x) => (
                      <div key={x.k} className="rounded-lg border border-border p-3">
                        <p className="text-xs text-muted-foreground">{x.k}</p>
                        <p className="text-base font-semibold text-foreground">{x.v}</p>
                        <p className="text-[11px] text-muted-foreground">{x.s}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => download('interior')} disabled={!!busy}>
                      {busy === 'interior' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Interior PDF
                    </Button>
                    <Button variant="outline" onClick={() => download('cover')} disabled={!!busy}>
                      {busy === 'cover' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Cover PDF
                    </Button>
                    <Button variant="ghost" asChild>
                      <a href="https://kdp.amazon.com" target="_blank" rel="noopener noreferrer">Open KDP <ExternalLink className="h-3.5 w-3.5" /></a>
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-foreground">Listing text</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between"><Label>Title</Label><CopyButton text={pack.listing.title} label="Copy" /></div>
                      <p className="rounded-lg bg-muted px-3 py-2 text-sm">{pack.listing.title}</p>
                    </div>
                    {pack.listing.description && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between"><Label>Description</Label><CopyButton text={pack.listing.description} label="Copy" /></div>
                        <p className="max-h-32 overflow-y-auto rounded-lg bg-muted px-3 py-2 text-sm">{pack.listing.description}</p>
                      </div>
                    )}
                    {pack.listing.keywords.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between"><Label>Keyword ideas (KDP allows 7)</Label><CopyButton text={pack.listing.keywords.join('\n')} label="Copy all" /></div>
                        <div className="flex flex-wrap gap-1.5">{pack.listing.keywords.map((k) => <Badge key={k} variant="muted">{k}</Badge>)}</div>
                        <p className="text-[11px] text-muted-foreground">Taken from the book&apos;s own title and description. Edit them before you use them.</p>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400"><Info className="h-4 w-4" /> Before you upload</p>
                    <ul className="list-disc space-y-1 pl-5 text-xs text-amber-700 dark:text-amber-400">
                      {pack.checklist.map((c) => <li key={c}>{c}</li>)}
                    </ul>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit ──────────────────────────────────────────────────────────────────────
function EditDialog({ shopId, book, onClose, onSaved }: { shopId: string; book: KdpBook; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    title: book.title, status: book.status, amazon_url: book.amazon_url ?? '',
    list_price: book.list_price?.toString() ?? '', print_cost: book.print_cost?.toString() ?? '', notes: book.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
  const royalty = num(f.list_price) !== undefined && num(f.print_cost) !== undefined
    ? Math.round((0.6 * (num(f.list_price) as number) - (num(f.print_cost) as number)) * 100) / 100 : null;

  const save = async () => {
    setSaving(true); setError('');
    try {
      await kdpApi.update(shopId, book.id, {
        title: f.title, status: f.status, amazon_url: f.amazon_url || undefined,
        list_price: num(f.list_price), print_cost: num(f.print_cost), notes: f.notes,
      });
      onSaved();
    } catch (e) { setError(errText(e, 'Could not save.')); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit book</DialogTitle>
          <DialogDescription>These details are yours to keep track of. KDP is not updated from here.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-5">
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="space-y-1.5"><Label htmlFor="kdp-title">Title</Label><Input id="kdp-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as KdpStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kdp-url">Amazon link</Label>
            <Input id="kdp-url" placeholder="https://www.amazon.com/dp/..." value={f.amazon_url} onChange={(e) => setF({ ...f, amazon_url: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="kdp-price">List price on KDP ($)</Label><Input id="kdp-price" type="number" step="0.01" min="0" value={f.list_price} onChange={(e) => setF({ ...f, list_price: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="kdp-cost">Print cost from KDP ($)</Label><Input id="kdp-cost" type="number" step="0.01" min="0" value={f.print_cost} onChange={(e) => setF({ ...f, print_cost: e.target.value })} /></div>
          </div>
          <p className="text-xs text-muted-foreground">
            {royalty !== null
              ? <>Estimated royalty per copy: <strong className="text-foreground">${royalty.toFixed(2)}</strong> (60% of the list price minus the print cost). Your real royalty is shown in KDP.</>
              : 'Enter both numbers to see an estimate (60% of the list price minus the print cost). KDP\'s own calculator gives the print cost.'}
          </p>
          <div className="space-y-1.5"><Label htmlFor="kdp-notes">Notes</Label><Input id="kdp-notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function KdpChannelPage() {
  const confirm = useConfirm();
  const [shopId, setShopId] = useState('');
  const [books, setBooks] = useState<KdpBook[]>([]);
  const [available, setAvailable] = useState<{ id: number; name: string; cover_image_url: string | null; has_pdf: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [prepare, setPrepare] = useState<KdpBook | null>(null);
  const [edit, setEdit] = useState<KdpBook | null>(null);
  const [adding, setAdding] = useState(false);
  const [ownTitle, setOwnTitle] = useState('');
  const [busy, setBusy] = useState<number | 'own' | null>(null);

  useEffect(() => { setShopId(localStorage.getItem('shop_id') || ''); }, []);

  const load = useCallback(() => {
    if (!shopId) return;
    kdpApi.list(shopId)
      .then((r) => { setBooks(r.data.books); setAvailable(r.data.available); })
      .catch((e) => setError(errText(e, 'Could not load your KDP books.')))
      .finally(() => setLoading(false));
  }, [shopId]);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    total: books.length, ready: books.filter((b) => b.status === 'files_ready').length, live: books.filter((b) => b.status === 'live').length,
  }), [books]);

  const addBundle = async (bundleId: number) => {
    setBusy(bundleId); setError('');
    try { await kdpApi.add(shopId, { bundle_id: bundleId }); load(); } catch (e) { setError(errText(e, 'Could not add the book.')); } finally { setBusy(null); }
  };
  const addOwn = async () => {
    if (!ownTitle.trim()) return;
    setBusy('own'); setError('');
    try { await kdpApi.add(shopId, { title: ownTitle.trim() }); setOwnTitle(''); setAdding(false); load(); } catch (e) { setError(errText(e, 'Could not add the book.')); } finally { setBusy(null); }
  };
  const remove = async (b: KdpBook) => {
    if (!(await confirm({ title: 'Remove this book?', description: `"${b.title}" is removed from this list. Nothing changes on Amazon.`, confirmText: 'Remove', variant: 'destructive' }))) return;
    try { await kdpApi.remove(shopId, b.id); load(); } catch (e) { setError(errText(e, 'Could not remove the book.')); }
  };

  return (
    <div className="space-y-6">
      <Link href="/dashboard/channels" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Sales Channels
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/10"><ChannelLogo channelType="kdp" size={22} /></div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Amazon KDP</h1>
              <Badge variant="outline">Manual channel</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Publish printed books on Amazon. Amazon prints and ships every order.</p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <a href="https://kdp.amazon.com" target="_blank" rel="noopener noreferrer">Open KDP <ExternalLink className="h-3.5 w-3.5" /></a>
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>KDP has no connection to ExiusCart. We prepare your files and keep your list; <strong className="text-foreground">you upload on kdp.amazon.com</strong>. Sales and royalties appear in KDP only, and KDP orders do not appear in ExiusCart Orders.</span>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                <div><p className="text-sm font-semibold text-foreground">{s.title}</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.desc}</p></div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {[{ l: 'Books', v: stats.total }, { l: 'Files ready', v: stats.ready }, { l: 'Live on Amazon', v: stats.live }].map((s) => (
          <Card key={s.l}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.l}</p><p className="mt-1 text-2xl font-bold text-foreground">{loading ? '-' : s.v}</p></CardContent></Card>
        ))}
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      {available.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-semibold text-foreground">Your Prodora books, not on this list yet</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {available.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                    {a.cover_image_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={a.cover_image_url} alt="" className="h-full w-full object-cover" />
                      : <BookOpen className="m-2.5 h-5 w-5 text-muted-foreground" />}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium" title={a.name}>{a.name}</span>
                  <Button size="sm" onClick={() => addBundle(a.id)} disabled={busy === a.id}>
                    {busy === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border p-4">
            <p className="text-sm font-semibold text-foreground">My KDP books</p>
            {adding ? (
              <div className="flex items-center gap-2">
                <Input className="h-9 w-56" placeholder="Book title" value={ownTitle} onChange={(e) => setOwnTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addOwn()} />
                <Button size="sm" onClick={addOwn} disabled={busy === 'own' || !ownTitle.trim()}>{busy === 'own' && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add</Button>
                <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setOwnTitle(''); }}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Add my own book</Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="bg-muted/50 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2.5 pl-4 pr-2.5 text-left">#</th>
                  <th className="px-2.5 py-2.5 text-left">Book</th>
                  <th className="px-2.5 py-2.5 text-left">Status</th>
                  <th className="px-2.5 py-2.5 text-left">Size</th>
                  <th className="px-2.5 py-2.5 text-right">Price</th>
                  <th className="px-2.5 py-2.5 text-right">Print cost</th>
                  <th className="px-2.5 py-2.5 text-right">Est. royalty</th>
                  <th className="px-2.5 py-2.5 text-left">Amazon</th>
                  <th className="py-2.5 pl-2.5 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? [0, 1, 2].map((i) => <tr key={i}><td colSpan={9} className="p-3"><Skeleton className="h-8 w-full" /></td></tr>)
                : books.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-14 text-center">
                    <BookOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-foreground">No KDP books yet</p>
                    <p className="mx-auto mt-1 max-w-sm whitespace-normal text-xs text-muted-foreground">Buy a drawing book on Prodora and it appears above, or add a book of your own.</p>
                  </td></tr>
                ) : books.map((b, i) => (
                  <tr key={b.id} className="h-[52px] transition hover:bg-muted/30">
                    <td className="py-1.5 pl-4 pr-2.5 text-xs tabular-nums text-muted-foreground">#{i + 1}</td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-muted">
                          {b.cover_image_url
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={b.cover_image_url} alt="" className="h-full w-full object-cover" />
                            : <BookOpen className="m-2 h-5 w-5 text-muted-foreground" />}
                        </div>
                        <span className="max-w-[260px] truncate font-medium text-foreground" title={b.title}>{b.title}</span>
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5"><Badge variant={STATUS[b.status].variant}>{STATUS[b.status].label}</Badge></td>
                    <td className="px-2.5 py-1.5 text-xs text-muted-foreground">{b.trim.replace('x', ' × ')} in</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{b.list_price != null ? `$${b.list_price.toFixed(2)}` : <span className="text-muted-foreground">-</span>}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">{b.print_cost != null ? `$${b.print_cost.toFixed(2)}` : '-'}</td>
                    <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums">{b.est_royalty != null ? <span className={b.est_royalty < 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}>${b.est_royalty.toFixed(2)}</span> : <span className="font-normal text-muted-foreground">-</span>}</td>
                    <td className="px-2.5 py-1.5 text-xs">
                      {b.amazon_url ? <a href={b.amazon_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">View <ExternalLink className="h-3 w-3" /></a> : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="py-1.5 pl-2.5 pr-4">
                      <div className="flex items-center justify-end gap-1">
                        {b.bundle_id && <Button size="sm" variant="outline" onClick={() => setPrepare(b)}>Prepare files</Button>}
                        <Button size="icon" variant="ghost" title="Edit" onClick={() => setEdit(b)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" title="Remove" onClick={() => remove(b)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {prepare && <PrepareDialog book={prepare} onClose={() => setPrepare(null)} onDownloaded={load} />}
      {edit && <EditDialog shopId={shopId} book={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}
