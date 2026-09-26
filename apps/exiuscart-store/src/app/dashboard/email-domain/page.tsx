'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, Circle, Copy, Crown, Loader2, Mail, MailCheck, RefreshCw, ShieldAlert, Trash2,
} from 'lucide-react';
import { emailDomainApi, type EmailDomainInfo, type EmailHealth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/ui/confirm-dialog';

type Info = Awaited<ReturnType<typeof emailDomainApi.get>>['data'];
type Problem = { id: number; recipient: string; subject: string; status: string; detail: string | null; bounce_type: string | null; created_at: string | null };

const utc = (iso: string) => new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(iso) ? iso : iso + 'Z');
const STATUS = {
  pending: { label: 'Waiting for DNS', variant: 'muted' as const },
  verified: { label: 'Verified', variant: 'success' as const },
  failed: { label: 'Check failed', variant: 'outline' as const },
  suspended: { label: 'Paused', variant: 'outline' as const },
};

function errText(e: any, fallback: string): string {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d[0]?.msg) return String(d[0].msg);
  return d?.message ?? fallback;
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" aria-label="Copy" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); } catch { /* blocked */ } }}
      className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground">
      {done ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

function Step({ n, title, state, children }: { n: number; title: string; state: 'done' | 'active' | 'todo'; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        state === 'done' ? 'bg-green-500/15 text-green-600 dark:text-green-400' : state === 'active' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
        {state === 'done' ? <Check className="h-3.5 w-3.5" /> : n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className={`text-sm font-semibold ${state === 'todo' ? 'text-muted-foreground' : 'text-foreground'}`}>{title}</p>
        {children}
      </div>
    </div>
  );
}

export default function EmailDomainPage() {
  const confirm = useConfirm();
  const [shopId, setShopId] = useState('');
  const [info, setInfo] = useState<Info | null>(null);
  const [health, setHealth] = useState<EmailHealth | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [domain, setDomain] = useState('');
  const [local, setLocal] = useState('invoices');
  const [editLocal, setEditLocal] = useState<string | null>(null);

  useEffect(() => { setShopId(localStorage.getItem('shop_id') || ''); }, []);

  const load = useCallback(() => {
    if (!shopId) return;
    emailDomainApi.get(shopId).then((r) => setInfo(r.data)).catch((e) => setError(errText(e, 'Could not load this page.'))).finally(() => setLoading(false));
    emailDomainApi.activity(shopId).then((r) => { setHealth(r.data.health); setProblems(r.data.problems); }).catch(() => {});
  }, [shopId]);
  useEffect(() => { load(); }, [load]);

  const dom: EmailDomainInfo | null = info?.domain ?? null;
  const act = async (name: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(name); setError(''); setNote('');
    try { await fn(); if (ok) setNote(ok); load(); } catch (e) { setError(errText(e, 'Something went wrong. Please try again.')); } finally { setBusy(''); }
  };

  const add = () => act('add', () => emailDomainApi.add(shopId, { domain, from_local: local }));
  const check = () => act('check', async () => {
    const r = await emailDomainApi.check(shopId);
    setNote(r.data.status === 'verified' ? 'Your domain is verified.' : 'Not verified yet. DNS changes can take a few hours to appear. Check again a little later.');
  });
  const remove = async () => {
    if (!(await confirm({ title: 'Remove this domain?', description: 'Your emails go back to being sent from noreply@exiuscart.com under your store name. You can add the domain again later.', confirmText: 'Remove', variant: 'destructive' }))) return;
    act('remove', () => emailDomainApi.remove(shopId));
  };
  const saveLocal = () => act('rename', async () => { await emailDomainApi.rename(shopId, { domain: dom!.domain, from_local: editLocal || 'invoices' }); setEditLocal(null); }, 'Sender name updated.');

  const shopName = info?.shop_name || 'Your store';
  const previewFrom = dom?.status === 'verified' ? dom.from_address : `noreply@exiuscart.com`;
  const step: 1 | 2 | 3 = !dom ? 1 : dom.status === 'verified' || dom.status === 'suspended' ? 3 : 2;

  if (loading) return <div className="space-y-6"><Skeleton className="h-8 w-56" /><Skeleton className="h-40 w-full" /><Skeleton className="h-60 w-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Email Domain</h1>
            <Badge variant="default"><Crown className="mr-1 h-3 w-3" />Scale</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Send invoices and customer emails from your own address, like invoices@yourstore.com</p>
        </div>
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
      {note && <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-400">{note}</div>}

      {/* What customers see */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="text-sm font-semibold text-foreground">What your customers see</p>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Mail className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{shopName} <span className="font-normal text-muted-foreground">&lt;{previewFrom}&gt;</span></p>
              <p className="truncate text-xs text-muted-foreground">Your invoice ORD-1001</p>
            </div>
            {dom?.status === 'verified' ? <Badge variant="success" className="ml-auto shrink-0">Your own address</Badge> : <Badge variant="muted" className="ml-auto shrink-0">Shared address today</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">Replies go to your store email{info?.shop_email ? <> (<strong className="text-foreground">{info.shop_email}</strong>)</> : ' (add one on your Store Profile so replies reach you)'}.</p>
        </CardContent>
      </Card>

      {info && !info.eligible && (
        <Card>
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10"><Crown className="h-6 w-6 text-primary" /></span>
            <div className="flex-1">
              <p className="text-base font-semibold text-foreground">Sending from your own domain is included in the Scale plan</p>
              <p className="mt-1 text-sm text-muted-foreground">Your emails already go out under your store name on every plan. Scale lets them come from your own address too, so customers only ever see your brand.</p>
            </div>
            <Button asChild><Link href="/dashboard/billing">See plans <ArrowRight className="h-4 w-4" /></Link></Button>
          </CardContent>
        </Card>
      )}

      {info?.eligible && !info.available && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Custom email domains are not switched on for the platform yet. Please contact support and we will enable it for you.</span>
        </div>
      )}

      {info?.eligible && info.available && (
        <Card>
          <CardContent className="space-y-6 p-6">
            <Step n={1} title="Choose your domain" state={step > 1 ? 'done' : 'active'}>
              {!dom ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                    <div className="space-y-1.5"><Label htmlFor="ed-domain">Your domain</Label><Input id="ed-domain" placeholder="yourstore.com" value={domain} onChange={(e) => setDomain(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label htmlFor="ed-local">Name before the @</Label><Input id="ed-local" value={local} onChange={(e) => setLocal(e.target.value)} /></div>
                  </div>
                  <p className="text-xs text-muted-foreground">Emails will come from <strong className="text-foreground">{(local || 'invoices').toLowerCase()}@{domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || 'yourstore.com'}</strong>. You must be able to edit the DNS settings of this domain.</p>
                  <Button onClick={add} disabled={busy === 'add' || !domain.trim()}>{busy === 'add' && <Loader2 className="h-4 w-4 animate-spin" />} Add domain</Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-foreground"><strong>{dom.domain}</strong></span>
                  <Badge variant={STATUS[dom.status].variant}>{STATUS[dom.status].label}</Badge>
                </div>
              )}
            </Step>

            <Step n={2} title="Add these records at your domain provider" state={step === 2 ? 'active' : step > 2 ? 'done' : 'todo'}>
              {dom && dom.status !== 'verified' && dom.status !== 'suspended' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Open the DNS settings where you bought your domain (GoDaddy, Namecheap, Cloudflare and so on) and add these 3 CNAME records. They prove the domain is yours.</p>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Value</th></tr></thead>
                      <tbody className="divide-y divide-border">
                        {dom.records.map((r) => (
                          <tr key={r.name}>
                            <td className="px-3 py-2 font-mono text-xs">{r.type}</td>
                            <td className="px-3 py-2"><div className="flex items-center gap-1"><span className="break-all font-mono text-xs">{r.name}</span><CopyBtn text={r.name} /></div></td>
                            <td className="px-3 py-2"><div className="flex items-center gap-1"><span className="break-all font-mono text-xs">{r.value}</span><CopyBtn text={r.value} /></div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">Some providers add your domain to the Name automatically. If yours does, paste only the part before <span className="font-mono">.{dom.domain}</span>. Changes can take from a few minutes to a few hours.</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={check} disabled={busy === 'check'}>{busy === 'check' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Check now</Button>
                    <Button variant="ghost" onClick={remove} disabled={busy === 'remove'}><Trash2 className="h-4 w-4" /> Remove domain</Button>
                    {dom.last_checked_at && <span className="text-xs text-muted-foreground">Last checked {utc(dom.last_checked_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}
                  </div>
                  {dom.status === 'failed' && <p className="text-xs text-destructive">Amazon could not confirm these records. Check that all three were added exactly and that there are no extra spaces.</p>}
                </div>
              )}
            </Step>

            <Step n={3} title="Emails send from your domain" state={step === 3 && dom?.status === 'verified' ? 'done' : 'todo'}>
              {dom?.status === 'verified' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"><CheckCircle2 className="h-4 w-4" /> Verified. Your customers now receive email from <strong>{dom.from_address}</strong>.</div>
                  <div className="flex flex-wrap items-end gap-2">
                    {editLocal === null ? (
                      <Button variant="outline" size="sm" onClick={() => setEditLocal(dom.from_local)}>Change name before the @</Button>
                    ) : (
                      <>
                        <div className="space-y-1.5"><Label htmlFor="ed-local2">Name before the @</Label><Input id="ed-local2" className="w-48" value={editLocal} onChange={(e) => setEditLocal(e.target.value)} /></div>
                        <Button size="sm" onClick={saveLocal} disabled={busy === 'rename'}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditLocal(null)}>Cancel</Button>
                      </>
                    )}
                    <Button variant="ghost" size="sm" onClick={remove} disabled={busy === 'remove'}><Trash2 className="h-4 w-4" /> Remove domain</Button>
                  </div>
                </div>
              )}
              {dom?.status === 'suspended' && (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">Your domain is paused</p>
                    <p className="mt-0.5">{dom.suspended_reason || 'It was paused to protect email delivery.'} Your emails are being sent from the shared ExiusCart address until it is switched back on. Please contact support.</p>
                  </div>
                </div>
              )}
            </Step>
          </CardContent>
        </Card>
      )}

      {info?.marketing_paused && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div><p className="font-semibold">Marketing emails are paused for your store</p><p className="mt-0.5">{info.marketing_paused_reason || 'Too many emails bounced or were reported as spam.'} Invoices and order emails still go out. Contact support to review this.</p></div>
        </div>
      )}

      {health && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><MailCheck className="h-4 w-4 text-primary" /> Your email delivery, last 7 days</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { k: 'Sent', v: health.sent.toString(), s: 'emails to your customers' },
                { k: 'Delivered', v: health.delivered.toString(), s: 'confirmed by the receiving server' },
                { k: 'Bounced', v: health.bounced.toString(), s: health.sent ? `${(health.bounce_rate * 100).toFixed(1)}% permanent bounces` : 'none yet', warn: health.bounce_rate >= 0.03 },
                { k: 'Marked as spam', v: health.complained.toString(), s: health.sent ? `${(health.complaint_rate * 100).toFixed(2)}% of emails` : 'none yet', warn: health.complained > 0 },
              ].map((x) => (
                <div key={x.k} className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{x.k}</p>
                  <p className={`text-2xl font-bold tabular-nums ${x.warn ? 'text-red-500' : 'text-foreground'}`}>{x.v}</p>
                  <p className="text-[11px] text-muted-foreground">{x.s}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">If more than 5% of your emails bounce, or customers report them as spam, marketing emails for your store are paused automatically to protect delivery for everyone.</p>

            {problems.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2 text-left">When</th><th className="px-3 py-2 text-left">Address</th><th className="px-3 py-2 text-left">Problem</th><th className="px-3 py-2 text-left">Email</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {problems.map((p) => (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{p.created_at ? utc(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</td>
                        <td className="px-3 py-2 text-xs">{p.recipient}</td>
                        <td className="px-3 py-2"><Badge variant="outline">{p.status === 'bounced' ? (p.bounce_type === 'Permanent' ? 'Address does not exist' : 'Bounced') : p.status === 'complained' ? 'Marked as spam' : p.status === 'suppressed' ? 'Not mailed (bounced before)' : p.status}</Badge></td>
                        <td className="max-w-[240px] truncate px-3 py-2 text-xs text-muted-foreground" title={p.subject}>{p.subject}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
