'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Webhook, Plus, Trash2, X, Loader2, Check, Play,
  ChevronDown, AlertCircle, Clock, CheckCircle,
} from 'lucide-react';
import { webhooksApi } from '@/lib/api';

interface WebhookItem {
  id: number;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

interface WebhookLog {
  id: number;
  event: string;
  response_status: number | null;
  success: boolean;
  created_at: string;
}

const ALL_EVENTS = [
  { value: 'order.created',           label: 'Order Created' },
  { value: 'order.paid',              label: 'Order Paid' },
  { value: 'order.completed',         label: 'Order Completed' },
  { value: 'order.cancelled',         label: 'Order Cancelled' },
  { value: 'subscription.approved',   label: 'Subscription Approved' },
  { value: 'product.low_stock',       label: 'Product Low Stock' },
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<number | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [form, setForm] = useState({ url: '', secret: '', events: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; msg: string } | null>(null);
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  const fetchWebhooks = useCallback(async () => {
    if (!shopId) return;
    try {
      const res = await webhooksApi.getAll(shopId);
      setWebhooks(res.data ?? []);
    } catch { setWebhooks([]); }
    finally { setLoading(false); }
  }, [shopId]);

  useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);

  const toggleEvent = (event: string) => {
    setForm(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }));
  };

  const handleCreate = async () => {
    if (!form.url.trim() || form.events.length === 0) return;
    setSaving(true);
    try {
      await webhooksApi.create(shopId, {
        url: form.url.trim(),
        secret: form.secret.trim() || undefined,
        events: form.events,
      });
      setShowAddModal(false);
      setForm({ url: '', secret: '', events: [] });
      fetchWebhooks();
    } catch {/* no-op */}
    finally { setSaving(false); }
  };

  const handleToggleActive = async (wh: WebhookItem) => {
    try {
      await webhooksApi.update(shopId, wh.id, { is_active: !wh.is_active });
      setWebhooks(prev => prev.map(w => w.id === wh.id ? { ...w, is_active: !w.is_active } : w));
    } catch {/* no-op */}
  };

  const handleDelete = async (id: number) => {
    try {
      await webhooksApi.delete(shopId, id);
      setWebhooks(prev => prev.filter(w => w.id !== id));
    } catch {/* no-op */}
  };

  const handleTest = async (id: number) => {
    setTestingId(id);
    setTestResult(null);
    try {
      await webhooksApi.test(shopId, id);
      setTestResult({ id, msg: 'Test event sent!' });
      setTimeout(() => setTestResult(null), 3000);
    } catch {
      setTestResult({ id, msg: 'Test failed' });
    } finally { setTestingId(null); }
  };

  const loadLogs = async (id: number) => {
    if (expandedLogs === id) { setExpandedLogs(null); return; }
    setExpandedLogs(id);
    setLogsLoading(true);
    try {
      const res = await webhooksApi.getLogs(shopId, id);
      setLogs(res.data ?? []);
    } catch { setLogs([]); }
    finally { setLogsLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">API Webhooks</h1>
          <p className="text-muted-foreground text-sm">Receive real-time POST notifications when events happen in your store</p>
        </div>
        <button type="button" onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition">
          <Plus className="w-4 h-4" /> Add Webhook
        </button>
      </div>

      {/* Docs callout */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-sm">
        <p className="font-medium text-foreground mb-1">How Webhooks Work</p>
        <p className="text-muted-foreground">
          ExiusCart sends an HTTP POST with a JSON payload to your URL when the selected event fires.
          If you set a secret, we include an <code className="bg-muted px-1 rounded">X-ExiusCart-Signature: sha256=...</code> header for verification.
        </p>
      </div>

      {/* Webhook list */}
      {loading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-20 bg-card rounded-xl border border-border animate-pulse" />)}</div>
      ) : webhooks.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-16 text-center">
          <Webhook className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="font-semibold text-foreground mb-2">No webhooks configured</h3>
          <p className="text-sm text-muted-foreground mb-5">Add a webhook to receive real-time events from your store</p>
          <button type="button" onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
            <Plus className="w-4 h-4" /> Add Webhook
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div key={wh.id} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${wh.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <code className="text-sm text-foreground font-medium break-all">{wh.url}</code>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {wh.events.map(e => (
                        <span key={e} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {ALL_EVENTS.find(ev => ev.value === e)?.label || e}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Active toggle */}
                    <button type="button" onClick={() => handleToggleActive(wh)}
                      className={`relative w-10 h-6 rounded-full transition-colors ${wh.is_active ? 'bg-green-500' : 'bg-muted-foreground/30'}`}>
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${wh.is_active ? 'left-5' : 'left-1'}`} />
                    </button>
                    {/* Test */}
                    <button type="button" onClick={() => handleTest(wh.id)} disabled={testingId === wh.id}
                      title="Send test event"
                      className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition disabled:opacity-50">
                      {testingId === wh.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    </button>
                    {/* Logs */}
                    <button type="button" onClick={() => loadLogs(wh.id)} title="View delivery logs"
                      className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedLogs === wh.id ? 'rotate-180' : ''}`} />
                    </button>
                    {/* Delete */}
                    <button type="button" onClick={() => handleDelete(wh.id)}
                      className="p-2 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-400 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {testResult?.id === wh.id && (
                  <p className={`text-xs mt-2 flex items-center gap-1 ${testResult.msg.includes('failed') ? 'text-red-400' : 'text-green-400'}`}>
                    <Check className="w-3 h-3" /> {testResult.msg}
                  </p>
                )}
              </div>

              {/* Logs drawer */}
              {expandedLogs === wh.id && (
                <div className="border-t border-border bg-muted/20 p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3">Recent Deliveries</p>
                  {logsLoading ? (
                    <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}</div>
                  ) : logs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No deliveries yet. Send a test event to check.</p>
                  ) : (
                    <div className="space-y-2">
                      {logs.map(log => (
                        <div key={log.id} className="flex items-center gap-3 text-sm">
                          {log.success
                            ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                            : <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                          }
                          <span className="text-foreground flex-1">{log.event}</span>
                          <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${log.success ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-400'}`}>
                            {log.response_status ?? 'err'}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(log.created_at).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Add Webhook</h2>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Endpoint URL *</label>
                <input type="url" value={form.url} onChange={(e) => setForm(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://your-app.com/webhooks/exiuscart"
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Secret (optional)</label>
                <input type="text" value={form.secret} onChange={(e) => setForm(prev => ({ ...prev, secret: e.target.value }))}
                  placeholder="Used to sign payloads with HMAC-SHA256"
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Events to subscribe *</label>
                <div className="space-y-2">
                  {ALL_EVENTS.map(ev => (
                    <label key={ev.value} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-muted transition">
                      <input type="checkbox" checked={form.events.includes(ev.value)} onChange={() => toggleEvent(ev.value)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                      <div>
                        <p className="text-sm text-foreground">{ev.label}</p>
                        <p className="text-xs text-muted-foreground font-mono">{ev.value}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-border flex gap-3">
              <button type="button" onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={handleCreate} disabled={saving || !form.url.trim() || form.events.length === 0}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Webhook
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
