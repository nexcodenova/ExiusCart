'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, X, Trash2, ToggleLeft, ToggleRight, Copy, Check, FileText, Eye,
  Link2, GripVertical, ArrowUp, ArrowDown, Loader2, Users, Code2, ExternalLink,
} from 'lucide-react';
import { channelsApi, signupFormsApi, SignupFormField } from '@/lib/api';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

interface SignupForm {
  id: number;
  channel_type: string;
  name: string;
  title: string;
  description: string | null;
  fields: SignupFormField[];
  success_message: string | null;
  discount_code: string | null;
  delay_seconds: number;
  is_active: boolean;
  impressions: number;
  submission_count: number;
  created_at: string;
}

// Same restriction as Storefront Categories — a form embedded on the
// seller's own storefront only makes sense for channels where they
// control the page HTML.
const CHANNEL_OPTIONS = [
  { value: 'custom', label: 'Custom Website' },
  { value: 'shopify', label: 'Shopify' },
] as const;

const FIELD_TYPES: { value: SignupFormField['type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'textarea', label: 'Long answer' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
];

function newField(): SignupFormField {
  return { id: (crypto as any).randomUUID ? crypto.randomUUID() : `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, label: '', type: 'text', required: false };
}

const EMPTY_FORM = {
  name: '', title: '', description: '', success_message: '', discount_code: '',
  delay_seconds: 3, is_active: true, fields: [newField()] as SignupFormField[],
};

function EmbedCodeBox({ shopId }: { shopId: string }) {
  const [copied, setCopied] = useState(false);
  const code = `<script src="https://api.exiuscart.com/api/v1/widget/signup-form.js" data-shop-id="${shopId}" async></script>`;

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-muted/40 border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <p className="text-sm font-medium text-foreground">Add this to your website</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Paste this one line into your Custom Website's HTML (before <code className="text-foreground">&lt;/body&gt;</code>) to activate your forms. If you use Shopify, add it in Theme → Edit code → theme.liquid.
      </p>
      <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2.5">
        <code className="text-xs text-foreground flex-1 overflow-x-auto whitespace-nowrap">{code}</code>
        <button onClick={copy} className="shrink-0 p-1.5 hover:bg-muted rounded-lg transition">
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
        </button>
      </div>
    </div>
  );
}

// Already have your own contact page / newsletter box, built independently
// of the form builder above? This tags that existing form so the same
// embed script mirrors its submissions here too — no new form to build,
// nothing about how that form already works changes.
function CaptureExistingFormBox({ onViewSubmissions, submissionCount }: { onViewSubmissions: () => void; submissionCount: number }) {
  const [copied, setCopied] = useState(false);
  const attr = 'data-exiuscart-capture="true"';

  const copy = () => {
    navigator.clipboard.writeText(attr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-muted/40 border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Code2 className="w-4 h-4 text-primary" />
        <p className="text-sm font-medium text-foreground">Already have your own contact form or newsletter box?</p>
      </div>
      <p className="text-xs text-muted-foreground">
        You don't have to rebuild it here. Add this attribute to your existing <code className="text-foreground">&lt;form&gt;</code> tag (Custom Website HTML, or Shopify's Contact/Newsletter section in Theme → Edit code) and its submissions will show up here too — your form keeps working exactly as it already does, we just get a copy.
      </p>
      <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2.5">
        <code className="text-xs text-foreground flex-1 overflow-x-auto whitespace-nowrap">{attr}</code>
        <button onClick={copy} className="shrink-0 p-1.5 hover:bg-muted rounded-lg transition">
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Doesn't work for forms that come from a third-party app inside an iframe — only forms that are part of your own page HTML.
      </p>
      <button onClick={onViewSubmissions} className="text-xs font-medium text-primary hover:text-primary/80 transition">
        View captured submissions ({submissionCount}) →
      </button>
    </div>
  );
}

function CapturedSubmissionsModal({ shopId, onClose }: { shopId: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<{ id: number; source_url: string | null; data: Record<string, string>; lead_id: number | null; created_at: string }[]>([]);

  useEffect(() => {
    signupFormsApi.capturedSubmissions(shopId)
      .then((r) => setRows(r.data?.submissions ?? []))
      .finally(() => setLoading(false));
  }, [shopId]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Captured from your existing forms</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{rows.length} submission{rows.length === 1 ? '' : 's'}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">Loading...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">No submissions captured yet.</p>
              <p className="text-muted-foreground/60 text-xs mt-1">Tag your existing form with the attribute above to start.</p>
            </div>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="border border-border rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    {r.source_url && <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="hover:text-primary flex items-center gap-1 truncate">{r.source_url} <ExternalLink className="w-3 h-3 shrink-0" /></a>}
                  </p>
                  <p className="text-xs text-muted-foreground/70 shrink-0">{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {Object.entries(r.data).map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <span className="text-muted-foreground text-xs">{k}: </span>
                      <span className="text-foreground truncate">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function FieldBuilder({ fields, onChange }: { fields: SignupFormField[]; onChange: (f: SignupFormField[]) => void }) {
  const update = (i: number, patch: Partial<SignupFormField>) => {
    onChange(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  };
  const remove = (i: number) => onChange(fields.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const target = i + dir;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[i], next[target]] = [next[target], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {fields.map((f, i) => (
        <div key={f.id} className="border border-border rounded-lg p-3 space-y-2 bg-muted/20">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
            <input type="text" value={f.label} onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Field label, e.g. Email address"
              className="flex-1 px-2.5 py-1.5 bg-background border border-border rounded-lg text-sm" />
            <select value={f.type} onChange={(e) => update(i, { type: e.target.value as SignupFormField['type'] })}
              className="px-2 py-1.5 bg-background border border-border rounded-lg text-xs shrink-0">
              {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {f.type === 'dropdown' && (
            <input type="text" value={(f.options ?? []).join(', ')}
              onChange={(e) => update(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              placeholder="Options, comma separated — e.g. Small, Medium, Large"
              className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs" />
          )}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={!!f.required} onChange={(e) => update(i, { required: e.target.checked })} />
              Required
            </label>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                className="p-1 hover:bg-muted rounded text-muted-foreground disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === fields.length - 1}
                className="p-1 hover:bg-muted rounded text-muted-foreground disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => remove(i)} disabled={fields.length === 1}
                className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...fields, newField()])}
        className="w-full py-2 text-xs font-medium border border-dashed border-border rounded-lg text-muted-foreground hover:text-primary hover:border-primary/40 transition flex items-center justify-center gap-1.5">
        <Plus className="w-3.5 h-3.5" /> Add field
      </button>
    </div>
  );
}

function ResponsesModal({ shopId, form, onClose }: { shopId: string; form: SignupForm; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<{ id: number; data: Record<string, string>; created_at: string }[]>([]);

  useEffect(() => {
    signupFormsApi.submissions(shopId, form.id)
      .then((r) => setRows(r.data?.submissions ?? []))
      .finally(() => setLoading(false));
  }, [shopId, form.id]);

  const columns = form.fields.map((f) => f.label).filter(Boolean);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Responses — {form.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{rows.length} submission{rows.length === 1 ? '' : 's'}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">Loading...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">No submissions yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  {columns.map((c) => <th key={c} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{c}</th>)}
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id}>
                    {columns.map((c) => <td key={c} className="px-4 py-2.5 text-foreground whitespace-nowrap">{r.data[c] ?? '—'}</td>)}
                    <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function FormBuilderModal({ shopId, channelType, existing, onClose, onSaved }: {
  shopId: string; channelType: string; existing: SignupForm | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState(existing ? {
    name: existing.name, title: existing.title, description: existing.description ?? '',
    success_message: existing.success_message ?? '', discount_code: existing.discount_code ?? '',
    delay_seconds: existing.delay_seconds, is_active: existing.is_active,
    fields: existing.fields.length ? existing.fields : [newField()],
  } : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSave = form.name.trim() && form.title.trim() && form.fields.every((f) => f.label.trim()) &&
    form.fields.every((f) => f.type !== 'dropdown' || (f.options ?? []).length > 0);

  const save = async () => {
    if (!canSave) return;
    setSaving(true); setError('');
    try {
      const payload = {
        channel_type: channelType,
        name: form.name.trim(),
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        success_message: form.success_message.trim() || undefined,
        discount_code: form.discount_code.trim() || undefined,
        delay_seconds: form.delay_seconds,
        is_active: form.is_active,
        fields: form.fields,
      };
      if (existing) await signupFormsApi.update(shopId, existing.id, payload);
      else await signupFormsApi.create(shopId, payload);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Could not save. Check the form and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-card">
          <h2 className="text-lg font-semibold text-foreground">{existing ? 'Edit Form' : 'New Signup Form'}</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          {error && <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">{error}</div>}

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Internal name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Newsletter Signup" autoFocus
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Title shown to visitors *</label>
            <input type="text" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Join our newsletter"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Description (optional)</label>
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2}
              placeholder="Get 10% off your first order when you sign up."
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm" />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Fields *</label>
            <FieldBuilder fields={form.fields} onChange={(fields) => setForm((p) => ({ ...p, fields }))} />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Success message (optional)</label>
            <input type="text" value={form.success_message} onChange={(e) => setForm((p) => ({ ...p, success_message: e.target.value }))}
              placeholder="Thanks! We'll be in touch soon."
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Discount code to show after submit (optional)</label>
            <input type="text" value={form.discount_code} onChange={(e) => setForm((p) => ({ ...p, discount_code: e.target.value }))}
              placeholder="e.g. WELCOME10"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm font-mono" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Show after (seconds)</label>
            <input type="number" min={0} value={form.delay_seconds}
              onChange={(e) => setForm((p) => ({ ...p, delay_seconds: Number(e.target.value) || 0 }))}
              className="w-32 px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm" />
          </div>
        </div>
        <div className="p-4 border-t border-border flex gap-3 sticky bottom-0 bg-card">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
          <button type="button" onClick={save} disabled={!canSave || saving}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {existing ? 'Save Changes' : 'Create Form'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SignupFormsPage() {
  const [shopId, setShopId] = useState('');
  const [channelType, setChannelType] = useState<string>('custom');
  const [connected, setConnected] = useState<boolean | null>(null);
  const [forms, setForms] = useState<SignupForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SignupForm | null>(null);
  const [viewingResponses, setViewingResponses] = useState<SignupForm | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [capturedCount, setCapturedCount] = useState(0);
  const [showCaptured, setShowCaptured] = useState(false);

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const fetchAll = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [connRes, formsRes, capturedRes] = await Promise.all([
        channelsApi.getConnections(shopId),
        signupFormsApi.list(shopId, channelType).catch(() => ({ data: { forms: [] } })),
        signupFormsApi.capturedSubmissions(shopId).catch(() => ({ data: { submissions: [] } })),
      ]);
      const conns = connRes.data ?? [];
      setConnected(conns.some((c: any) => c.channel_type === channelType));
      setForms(formsRes.data?.forms ?? []);
      setCapturedCount((capturedRes.data?.submissions ?? []).length);
    } catch {
      setConnected(false);
      setForms([]);
    } finally {
      setLoading(false);
    }
  }, [shopId, channelType]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggle = async (id: number) => {
    setActingId(id);
    try { await signupFormsApi.toggle(shopId, id); fetchAll(); } finally { setActingId(null); }
  };

  const remove = async (id: number) => {
    setActingId(id);
    try { await signupFormsApi.remove(shopId, id); fetchAll(); } catch {/* no-op */} finally { setActingId(null); setDeleteId(null); }
  };

  const channelLabel = CHANNEL_OPTIONS.find((o) => o.value === channelType)?.label;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Signup Forms</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build newsletter or inquiry forms that show up on your storefront — every submission lands in Lead Management.
          </p>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }} disabled={!connected}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
          <Plus className="w-4 h-4" /> New Form
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border p-4">
        <label className="text-sm text-muted-foreground mb-1.5 block">Channel</label>
        <select value={channelType} onChange={(e) => setChannelType(e.target.value)}
          className="w-full sm:w-64 px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none">
          {CHANNEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="text-xs text-muted-foreground mt-1.5">
          Forms embed directly on your own storefront's pages — only available for channels where you control the page HTML.
        </p>
      </div>

      {!loading && connected === false ? (
        <div className="bg-card rounded-xl border border-border p-16 text-center">
          <Link2 className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="font-semibold text-foreground mb-1">{channelLabel} isn't connected yet</h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
            Connect {channelLabel} under Channels first — a form only matters once there's a storefront to show it on.
          </p>
          <a href="/dashboard/channels"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
            Go to Channels
          </a>
        </div>
      ) : (
        <>
          {connected && shopId && <EmbedCodeBox shopId={shopId} />}
          {connected && shopId && (
            <CaptureExistingFormBox onViewSubmissions={() => setShowCaptured(true)} submissionCount={capturedCount} />
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : forms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl">
              <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">No forms yet for {channelLabel}.</p>
              <p className="text-muted-foreground/60 text-xs mt-1">Create one to start collecting signups from your storefront.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {forms.map((f) => (
                <div key={f.id} className="border border-border rounded-xl bg-card p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{f.name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{f.fields.length} field{f.fields.length === 1 ? '' : 's'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{f.title}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {f.impressions} views</span>
                      <button onClick={() => setViewingResponses(f)} className="flex items-center gap-1 hover:text-primary transition">
                        <Users className="w-3.5 h-3.5" /> {f.submission_count} response{f.submission_count === 1 ? '' : 's'}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggle(f.id)} disabled={actingId === f.id} className="text-primary transition">
                      {f.is_active ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
                    </button>
                    <button onClick={() => { setEditing(f); setShowModal(true); }}
                      className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition">
                      Edit
                    </button>
                    <button onClick={() => setDeleteId(f.id)} disabled={actingId === f.id}
                      className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showModal && (
        <FormBuilderModal shopId={shopId} channelType={channelType} existing={editing} onClose={() => setShowModal(false)} onSaved={fetchAll} />
      )}

      {viewingResponses && (
        <ResponsesModal shopId={shopId} form={viewingResponses} onClose={() => setViewingResponses(null)} />
      )}

      {showCaptured && (
        <CapturedSubmissionsModal shopId={shopId} onClose={() => setShowCaptured(false)} />
      )}

      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete this form?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              It'll stop showing on your storefront immediately. Responses already collected stay in Lead Management.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteId(null)} className="flex-1 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={() => remove(deleteId)} className="flex-1 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
