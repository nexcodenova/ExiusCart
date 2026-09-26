'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Store, FileText, MapPin, Phone, Mail, Globe, MessageCircle, Camera, Save, Building2, Receipt, AlertCircle,
  CheckCircle2, Circle, Loader2, Calendar, Coins, Hash, User as UserIcon, Crown,
} from 'lucide-react';
import { shopApi, subscriptionApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

type StoreData = {
  id: number | null; name: string; tradeLicense: string; vatNumber: string; address: string; city: string; country: string;
  phone: string; email: string; website: string; whatsapp: string; description: string; logo: string | null;
  currency: string; createdAt: string | null;
};
const EMPTY: StoreData = {
  id: null, name: '', tradeLicense: '', vatNumber: '', address: '', city: '', country: '', phone: '', email: '',
  website: '', whatsapp: '', description: '', logo: null, currency: '', createdAt: null,
};
type Plan = { status: string; name: string; daysLeft: number | null; is_trial: boolean; is_dollar_trial?: boolean; is_expired: boolean } | null;

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const LOGO_MAX = 5 * 1024 * 1024;

function errText(e: any, fallback: string): string {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d[0]?.msg) return String(d[0].msg).replace(/^Value error, /, '');
  return d?.message ?? fallback;
}

function planLabel(p: Plan): string | null {
  if (!p) return null;
  if (p.is_expired) return 'Plan ended';
  if (p.is_trial || p.is_dollar_trial) return `${p.name} trial · ${p.daysLeft ?? 0} day${p.daysLeft === 1 ? '' : 's'} left`;
  return p.name;
}

function Field({ id, label, icon: Icon, value, onChange, editing, type = 'text', placeholder, multiline, rows = 3, hint }: {
  id: string; label: string; icon?: React.ElementType; value: string; onChange: (v: string) => void; editing: boolean;
  type?: string; placeholder?: string; multiline?: boolean; rows?: number; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-muted-foreground">{label}</Label>
      {editing ? (
        multiline
          ? <Textarea id={id} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
          : <Input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <div className="flex min-h-9 items-start gap-2 text-sm text-foreground">
          {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
          <span className={value ? 'break-words' : 'text-muted-foreground'}>{value || 'Not added yet'}</span>
        </div>
      )}
      {editing && hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-foreground"><Icon className="h-5 w-5 text-primary" /> {title}</h3>
        {children}
      </CardContent>
    </Card>
  );
}

export default function StoreProfilePage() {
  const [data, setData] = useState<StoreData>(EMPTY);
  const [draft, setDraft] = useState<StoreData>(EMPTY);
  const [plan, setPlan] = useState<Plan>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [owner, setOwner] = useState({ name: '', email: '' });
  const fileRef = useRef<HTMLInputElement>(null);
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  useEffect(() => {
    try { const u = JSON.parse(localStorage.getItem('user') || '{}'); setOwner({ name: u.full_name || '', email: u.email || '' }); } catch { /* none */ }
  }, []);

  const load = useCallback(() => {
    shopApi.getMyShop().then((res) => {
      const d = res.data;
      const next: StoreData = {
        id: d.id ?? null, name: d.name ?? '', tradeLicense: d.trade_license ?? '', vatNumber: d.tax_number ?? '',
        address: d.address ?? '', city: d.city ?? '', country: d.country ?? '', phone: d.phone ?? '', email: d.email ?? '',
        website: d.website ?? '', whatsapp: d.whatsapp ?? '', description: d.description ?? '', logo: d.logo_url ?? null,
        currency: d.currency ?? '', createdAt: d.created_at ?? null,
      };
      setData(next); setDraft(next);
    }).catch(() => setError('Could not load your store profile.')).finally(() => setLoading(false));
    if (shopId) subscriptionApi.getCurrent(shopId).then((r) => setPlan(r.data?.plan ?? null)).catch(() => {});
  }, [shopId]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true); setError(''); setOk('');
    try {
      await shopApi.updateShop({
        name: draft.name, trade_license: draft.tradeLicense, tax_number: draft.vatNumber, address: draft.address, city: draft.city,
        country: draft.country, phone: draft.phone, email: draft.email || null, website: draft.website, whatsapp: draft.whatsapp,
        description: draft.description,
      });
      setEditing(false); setOk('Store profile saved.'); setTimeout(() => setOk(''), 3000);
      window.dispatchEvent(new Event('store-updated'));
      load();
    } catch (e) { setError(errText(e, 'Could not save your changes. Please try again.')); } finally { setSaving(false); }
  };

  const pickLogo = async (file: File | undefined) => {
    if (!file || !shopId) return;
    setError('');
    if (!LOGO_TYPES.includes(file.type)) { setError('Use a PNG, JPG or WebP image.'); return; }
    if (file.size > LOGO_MAX) { setError('The logo must be under 5 MB.'); return; }
    setUploading(true);
    try {
      const r = await shopApi.uploadLogo(shopId, file);
      setData((d) => ({ ...d, logo: r.data?.logo_url ?? d.logo }));
      setDraft((d) => ({ ...d, logo: r.data?.logo_url ?? d.logo }));
      setOk('Logo updated.'); setTimeout(() => setOk(''), 3000);
      window.dispatchEvent(new Event('store-updated'));
    } catch (e) { setError(errText(e, 'The logo could not be uploaded. Please try again.')); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  // Real completeness: what is actually filled in on the saved profile.
  const checklist = useMemo(() => [
    { label: 'Store logo', done: !!data.logo }, { label: 'Store description', done: !!data.description.trim() },
    { label: 'Phone number', done: !!data.phone.trim() }, { label: 'Email address', done: !!data.email.trim() },
    { label: 'Address', done: !!data.address.trim() }, { label: 'City', done: !!data.city.trim() }, { label: 'Country', done: !!data.country.trim() },
  ], [data]);
  const doneCount = checklist.filter((c) => c.done).length;
  const pct = Math.round((doneCount / checklist.length) * 100);
  const set = (k: keyof StoreData) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const view = editing ? draft : data;
  const label = planLabel(plan);

  if (loading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-56" /><Skeleton className="h-44 w-full" /><Skeleton className="h-56 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Store Profile</h1>
          <p className="text-sm text-muted-foreground">Your store&apos;s details, logo and contact information</p>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={() => { setDraft(data); setEditing(false); setError(''); }}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes</Button>
            </>
          ) : <Button onClick={() => setEditing(true)}>Edit profile</Button>}
        </div>
      </div>

      {error && <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
      {ok && <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-400">{ok}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
            <div className="relative shrink-0">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-primary/10">
                {data.logo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={data.logo} alt="Store logo" className="h-full w-full object-cover" />
                  : <Store className="h-10 w-10 text-primary" />}
                {uploading && <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/70"><Loader2 className="h-5 w-5 animate-spin" /></div>}
              </div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pickLogo(e.target.files?.[0])} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} title={data.logo ? 'Change logo' : 'Upload logo'} aria-label="Upload store logo"
                className="absolute -bottom-2 -right-2 rounded-full bg-primary p-2 text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-60">
                <Camera className="h-4 w-4" />
              </button>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              {editing
                ? <div className="space-y-1.5"><Label htmlFor="store-name" className="text-muted-foreground">Store name</Label><Input id="store-name" value={draft.name} onChange={(e) => set('name')(e.target.value)} className="text-lg font-semibold" /></div>
                : <h2 className="truncate text-2xl font-bold text-foreground">{data.name || 'Your store'}</h2>}
              <div className="flex flex-wrap items-center gap-2">
                {plan && !plan.is_expired && <Badge variant="success">Active</Badge>}
                {label && <Badge variant="default"><Crown className="mr-1 h-3 w-3" />{label}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">PNG, JPG or WebP, up to 5 MB. Your logo appears on invoices and in your account menu.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-6">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold text-foreground">Profile completeness</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">{pct}%</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              {checklist.map((c) => (
                <li key={c.label} className={`flex items-center gap-1.5 ${c.done ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {c.done ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Circle className="h-3.5 w-3.5" />} {c.label}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section icon={Building2} title="Business information">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="vat" label="VAT registration number" icon={Receipt} value={view.vatNumber} onChange={set('vatNumber')} editing={editing} placeholder="e.g. 100234567800003" />
            <Field id="license" label="Trade license number" icon={FileText} value={view.tradeLicense} onChange={set('tradeLicense')} editing={editing} placeholder="e.g. TL-123456" />
          </div>
        </Section>

        <Section icon={Phone} title="Contact information">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="phone" label="Phone number" icon={Phone} value={view.phone} onChange={set('phone')} editing={editing} type="tel" />
            <Field id="email" label="Email address" icon={Mail} value={view.email} onChange={set('email')} editing={editing} type="email" hint="Customers' replies to your invoices and emails go here." />
            <Field id="wa" label="WhatsApp number" icon={MessageCircle} value={view.whatsapp} onChange={set('whatsapp')} editing={editing} type="tel" />
            <Field id="site" label="Website" icon={Globe} value={view.website} onChange={set('website')} editing={editing} placeholder="https://mystore.com" />
          </div>
        </Section>

        <Section icon={MapPin} title="Location">
          <Field id="address" label="Full address" icon={MapPin} value={view.address} onChange={set('address')} editing={editing} multiline rows={2} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="city" label="City" icon={Building2} value={view.city} onChange={set('city')} editing={editing} />
            <Field id="country" label="Country" icon={Globe} value={view.country} onChange={set('country')} editing={editing} />
          </div>
          <p className="text-xs text-muted-foreground">Used on invoices and as the item location on marketplace listings such as eBay.</p>
        </Section>

        <Section icon={FileText} title="Store description">
          <Field id="about" label="About your store" value={view.description} onChange={set('description')} editing={editing} multiline rows={5} />
        </Section>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground"><Hash className="h-5 w-5 text-primary" /> Store details</h3>
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: UserIcon, k: 'Account owner', v: owner.name || owner.email || '-', s: owner.name ? owner.email : '' },
              { icon: Hash, k: 'Store ID', v: data.id != null ? `#${data.id}` : '-', s: '' },
              { icon: Coins, k: 'Store currency', v: data.currency || '-', s: '' },
              { icon: Calendar, k: 'Member since', v: data.createdAt ? new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(data.createdAt) ? data.createdAt : data.createdAt + 'Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '-', s: '' },
            ].map((x) => (
              <div key={x.k} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><x.icon className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{x.k}</dt>
                  <dd className="truncate text-sm font-medium text-foreground">{x.v}</dd>
                  {x.s && <dd className="truncate text-xs text-muted-foreground">{x.s}</dd>}
                </div>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
