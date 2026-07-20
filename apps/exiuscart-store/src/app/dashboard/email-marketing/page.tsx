'use client';
import { useState, useEffect } from 'react';
import { Plus, Mail, Send, Trash2, Edit2, Eye, X, Loader2, CheckCircle, AlertCircle, Upload, Bookmark, ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { marketingApi, usageApi } from '@/lib/api';
import { EMPTY_EMAIL_FIELDS, EMAIL_FONTS, BUTTON_SHAPES, buildEmailHtml } from '@/lib/email-builder';
import { RichTextEditor } from '@/components/rich-text-editor';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-green-500/10 text-green-600 dark:text-green-400',
  scheduled: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  cancelled: 'bg-red-500/10 text-red-500',
};

const EMPTY = { name: '', subject: '', ...EMPTY_EMAIL_FIELDS };

export default function EmailMarketingPage() {
  const [shopId, setShopId] = useState('');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<number | null>(null);
  const [sendResult, setSendResult] = useState<{ sent: number; total_customers: number } | null>(null);
  const [sendError, setSendError] = useState('');

  // Seller's own saved, reusable templates + hero image upload
  const [templates, setTemplates] = useState<any[]>([]);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  // Usage / plan info
  const [usageMarketing, setUsageMarketing] = useState<{ used: number; limit: number | null } | null>(null);

  useEffect(() => {
    const id = localStorage.getItem('shop_id') || '';
    setShopId(id);
  }, []);

  const load = async () => {
    if (!shopId) return;
    try {
      const [camRes, usageRes, tplRes] = await Promise.all([
        marketingApi.getEmailCampaigns(shopId),
        usageApi.get(shopId),
        marketingApi.getEmailTemplates(shopId),
      ]);
      setCampaigns(camRes.data ?? []);
      setUsageMarketing(usageRes.data?.emails?.marketing ?? null);
      setTemplates(tplRes.data ?? []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [shopId]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setShowTemplates(false); setShowModal(true); };
  const openEdit = (c: any) => {
    setEditing(c);
    setForm({ name: c.name, subject: c.subject, ...EMPTY_EMAIL_FIELDS, ...(c.builder_fields || {}) });
    setShowTemplates(false);
    setShowModal(true);
  };

  // Load a saved template's look into the builder — button link stays
  // whatever the seller already typed, since that's specific to this
  // campaign, not something worth locking into a reusable template.
  const applyTemplate = (t: any) => {
    setForm((f) => ({
      ...f,
      heading: t.heading || '',
      subtitle: t.subtitle || '',
      heroImageUrl: t.hero_image_url || '',
      buttonText: t.button_text || f.buttonText,
      buttonColor: t.button_color || f.buttonColor,
      buttonShape: t.button_shape || f.buttonShape,
      fontKey: t.font_key || f.fontKey,
    }));
    setShowTemplates(false);
  };

  const saveAsTemplate = async () => {
    if (!newTemplateName.trim()) return;
    setSavingTemplate(true);
    try {
      await marketingApi.saveEmailTemplate(shopId, {
        name: newTemplateName.trim(),
        heading: form.heading,
        subtitle: form.subtitle,
        hero_image_url: form.heroImageUrl,
        button_text: form.buttonText,
        button_color: form.buttonColor,
        button_shape: form.buttonShape,
        font_key: form.fontKey,
      });
      setNewTemplateName('');
      setShowSaveTemplate(false);
      load();
    } catch {}
    finally { setSavingTemplate(false); }
  };

  const deleteTemplate = async (id: number) => {
    if (!confirm('Delete this template?')) return;
    try { await marketingApi.deleteEmailTemplate(shopId, id); load(); } catch {}
  };

  const uploadHero = async (file: File) => {
    setUploadingHero(true);
    try {
      const res = await marketingApi.uploadEmailImage(shopId, file);
      setForm((f) => ({ ...f, heroImageUrl: res.data?.url || f.heroImageUrl }));
    } catch {}
    finally { setUploadingHero(false); }
  };

  const save = async () => {
    if (!form.name.trim() || !form.subject.trim()) return;
    setSaving(true);
    try {
      const { name, subject, ...builderFields } = form;
      const payload = { name, subject, body_html: buildEmailHtml(builderFields), builder_fields: builderFields };
      if (editing) { await marketingApi.updateEmailCampaign(shopId, editing.id, payload); }
      else { await marketingApi.createEmailCampaign(shopId, payload); }
      setShowModal(false);
      load();
    } catch {}
    finally { setSaving(false); }
  };

  const sendCampaign = async (c: any) => {
    setSending(c.id);
    setSendResult(null);
    setSendError('');
    try {
      const r = await marketingApi.sendEmailCampaign(shopId, c.id);
      setSendResult(r.data);
      load();
    } catch (err: any) {
      setSendError(err?.response?.data?.detail ?? 'Failed to send campaign.');
    } finally {
      setSending(null);
    }
  };

  const del = async (c: any) => {
    if (!confirm('Delete this campaign?')) return;
    try { await marketingApi.deleteEmailCampaign(shopId, c.id); load(); } catch {}
  };

  const preview = campaigns.find(c => c.id === previewId);
  const marketingLocked = usageMarketing?.limit === 0;
  const marketingFull = usageMarketing !== null && usageMarketing.limit !== null && usageMarketing.used >= usageMarketing.limit;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Email Marketing</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and send promotional emails to your customers</p>
        </div>
        <button
          onClick={openNew}
          disabled={marketingLocked}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      {/* Plan gate */}
      {marketingLocked && (
        <div className="bg-muted border border-border rounded-xl px-5 py-3.5 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">Email marketing is not available on your current plan.</p>
          <Link href="/dashboard/billing" className="shrink-0 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
            Upgrade Plan
          </Link>
        </div>
      )}

      {/* Usage bar */}
      {usageMarketing && usageMarketing.limit !== null && usageMarketing.limit > 0 && (
        <div className="bg-card border border-border rounded-xl px-5 py-3 flex items-center gap-4">
          <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">Marketing emails</span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${marketingFull ? 'bg-red-500' : usageMarketing.used / usageMarketing.limit >= 0.8 ? 'bg-yellow-500' : 'bg-primary'}`}
              style={{ width: `${Math.min((usageMarketing.used / usageMarketing.limit) * 100, 100)}%` }}
            />
          </div>
          <span className={`text-sm font-semibold tabular-nums shrink-0 ${marketingFull ? 'text-red-500' : 'text-foreground'}`}>
            {usageMarketing.used} / {usageMarketing.limit}
          </span>
        </div>
      )}

      {/* Send result banner */}
      {sendResult && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-5 py-3 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-400 flex-1">
            Campaign sent to <strong>{sendResult.sent}</strong> customer{sendResult.sent !== 1 ? 's' : ''} (out of {sendResult.total_customers} with emails).
          </p>
          <button onClick={() => setSendResult(null)} className="p-1 hover:bg-muted rounded text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
      )}
      {sendError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400 flex-1">{sendError}</p>
          <button onClick={() => setSendError('')} className="p-1 hover:bg-muted rounded text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: campaigns.length, color: '' },
          { label: 'Draft', value: campaigns.filter(c => c.status === 'draft').length, color: 'text-muted-foreground' },
          { label: 'Scheduled', value: campaigns.filter(c => c.status === 'scheduled').length, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Sent', value: campaigns.filter(c => c.status === 'sent').length, color: 'text-green-600 dark:text-green-400' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color || 'text-foreground'}`}>{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : campaigns.length === 0 ? (
          <div className="p-16 text-center">
            <Mail className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold text-foreground mb-1">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground mb-5">Create your first email campaign to reach your customers</p>
            {!marketingLocked && (
              <button onClick={openNew} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
                <Plus className="w-4 h-4" /> New Campaign
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {['Campaign', 'Subject', 'Status', 'Recipients', 'Created', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {campaigns.map(c => (
                  <tr key={c.id} className="hover:bg-muted/20 transition">
                    <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{c.subject}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[c.status] || STATUS_COLORS.draft}`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.recipients_count > 0 ? c.recipients_count : '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setPreviewId(c.id)} className="p-1.5 text-muted-foreground hover:text-primary rounded transition" title="Preview"><Eye className="w-4 h-4" /></button>
                        {c.status !== 'sent' && (
                          <>
                            <button onClick={() => openEdit(c)} className="p-1.5 text-muted-foreground hover:text-primary rounded transition" title="Edit"><Edit2 className="w-4 h-4" /></button>
                            <button
                              onClick={() => sendCampaign(c)}
                              disabled={!!sending || marketingLocked || marketingFull}
                              className="p-1.5 text-muted-foreground hover:text-green-600 dark:hover:text-green-400 rounded transition disabled:opacity-40"
                              title={marketingLocked ? 'Upgrade to send' : marketingFull ? 'Monthly limit reached' : 'Send to all customers'}
                            >
                              {sending === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </button>
                          </>
                        )}
                        <button onClick={() => del(c)} className="p-1.5 text-muted-foreground hover:text-destructive rounded transition" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-5xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold text-foreground">{editing ? 'Edit Campaign' : 'New Email Campaign'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid lg:grid-cols-2 overflow-y-auto flex-1 min-h-0">

              {/* ── LEFT: form ── */}
              <div className="p-6 space-y-5 border-r border-border">

                {/* My Templates */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowTemplates(v => !v)}
                    className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition"
                  >
                    <Bookmark className="w-4 h-4" />
                    {showTemplates ? 'Hide my templates' : `My Templates (${templates.length})`}
                  </button>
                  {showTemplates && (
                    <div className="mt-3 space-y-2">
                      {templates.length === 0 && (
                        <p className="text-xs text-muted-foreground">No saved templates yet — build one below, then "Save as Template" to reuse it next time.</p>
                      )}
                      {templates.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 border border-border rounded-lg p-2.5 hover:border-primary/50 transition">
                          <button type="button" onClick={() => applyTemplate(t)} className="flex-1 text-left flex items-center gap-2.5 min-w-0">
                            <span className="w-8 h-8 rounded-lg shrink-0 border border-border" style={{ background: t.button_color || '#6B3FD9' }} />
                            <span className="text-sm text-foreground truncate">{t.name}</span>
                          </button>
                          <button type="button" onClick={() => deleteTemplate(t.id)} className="p-1.5 text-muted-foreground hover:text-destructive rounded transition shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Campaign Name *</label>
                    <input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                      placeholder="Summer Sale Campaign"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Subject Line *</label>
                    <input
                      value={form.subject}
                      onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                      placeholder="Don't miss our biggest sale!"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Hero Image <span className="text-muted-foreground/60">(optional)</span></label>
                  <div className="flex items-center gap-3">
                    {form.heroImageUrl ? (
                      <img src={form.heroImageUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-border shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground shrink-0">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}
                    <label className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted cursor-pointer transition">
                      {uploadingHero ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uploadingHero ? 'Uploading…' : 'Upload'}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploadingHero}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadHero(f); e.target.value = ''; }} />
                    </label>
                    {form.heroImageUrl && (
                      <button type="button" onClick={() => setForm(f => ({ ...f, heroImageUrl: '' }))} className="text-xs text-muted-foreground hover:text-destructive transition">Remove</button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Heading</label>
                  <input
                    value={form.heading}
                    onChange={e => setForm(f => ({ ...f, heading: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                    placeholder="50% OFF Today Only"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Subtitle</label>
                  <input
                    value={form.subtitle}
                    onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                    placeholder="Our biggest sale of the year"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Message</label>
                  <RichTextEditor
                    value={form.bodyMessage}
                    onChange={(html) => setForm(f => ({ ...f, bodyMessage: html }))}
                    placeholder="A short message to your customers..."
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Button Text</label>
                    <input
                      value={form.buttonText}
                      onChange={e => setForm(f => ({ ...f, buttonText: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                      placeholder="Shop Now"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Button Link</label>
                    <input
                      value={form.buttonLink}
                      onChange={e => setForm(f => ({ ...f, buttonLink: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                      placeholder="https://thedersi.lk/new-arrivals"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-[auto_1fr_1fr] gap-4 items-end">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Color</label>
                    <input
                      type="color"
                      value={form.buttonColor}
                      onChange={e => setForm(f => ({ ...f, buttonColor: e.target.value }))}
                      className="w-11 h-10 rounded-lg border border-border cursor-pointer bg-transparent p-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Button Shape</label>
                    <div className="flex gap-1.5">
                      {BUTTON_SHAPES.map((s) => (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, buttonShape: s.key }))}
                          className={`flex-1 px-2 py-2 text-xs border rounded-lg transition ${form.buttonShape === s.key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Font</label>
                    <select
                      value={form.fontKey}
                      onChange={e => setForm(f => ({ ...f, fontKey: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                    >
                      {EMAIL_FONTS.map((fnt) => <option key={fnt.key} value={fnt.key}>{fnt.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Save as template */}
                <div className="pt-1">
                  {!showSaveTemplate ? (
                    <button type="button" onClick={() => setShowSaveTemplate(true)} className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition">
                      <Bookmark className="w-4 h-4" /> Save as Template
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        value={newTemplateName}
                        onChange={e => setNewTemplateName(e.target.value)}
                        placeholder="Template name"
                        className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                      />
                      <button
                        type="button"
                        onClick={saveAsTemplate}
                        disabled={savingTemplate || !newTemplateName.trim()}
                        className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        {savingTemplate && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
                      </button>
                      <button type="button" onClick={() => { setShowSaveTemplate(false); setNewTemplateName(''); }} className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              </div>

              {/* ── RIGHT: live preview ── */}
              <div className="p-6 bg-muted/20 flex flex-col min-h-[400px]">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Live Preview</p>
                <div className="flex-1 border border-border rounded-lg overflow-hidden bg-white">
                  <iframe
                    title="Email preview"
                    srcDoc={buildEmailHtml(form)}
                    className="w-full h-full border-0"
                    style={{ minHeight: 500 }}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-border shrink-0">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition text-sm">Cancel</button>
              <button
                onClick={save}
                disabled={saving || !form.name.trim() || !form.subject.trim()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-start justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{preview.name}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Subject: {preview.subject}</p>
              </div>
              <button onClick={() => setPreviewId(null)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition shrink-0"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              {preview.body_html ? (
                <div
                  className="border border-border rounded-lg p-4 bg-white text-black"
                  dangerouslySetInnerHTML={{ __html: preview.body_html }}
                />
              ) : (
                <p className="text-muted-foreground text-center py-8">No email body yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
