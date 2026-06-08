'use client';
import { useState, useEffect } from 'react';
import { Plus, Mail, Send, Trash2, Edit2, Eye, X } from 'lucide-react';
import { marketingApi } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  sent: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const EMPTY = { name: '', subject: '', body_html: '' };

export default function EmailMarketingPage() {
  const [shopId, setShopId] = useState<string>('');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  useEffect(() => { setShopId(localStorage.getItem('shop_id') || '1'); }, []);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!shopId) return;
    try { const r = await marketingApi.getEmailCampaigns(shopId); setCampaigns(r.data); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [shopId]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (c: any) => { setEditing(c); setForm({ name: c.name, subject: c.subject, body_html: c.body_html || '' }); setShowModal(true); };

  const save = async () => {
    if (!form.name.trim() || !form.subject.trim()) return;
    setSaving(true);
    try {
      if (editing) { await marketingApi.updateEmailCampaign(shopId!, editing.id, form); }
      else { await marketingApi.createEmailCampaign(shopId!, form); }
      setShowModal(false); load();
    } catch {} finally { setSaving(false); }
  };

  const sendCampaign = async (c: any) => {
    if (!confirm(`Mark "${c.name}" as sent?`)) return;
    try { await marketingApi.updateEmailCampaign(shopId!, c.id, { status: 'sent' }); load(); } catch {}
  };

  const del = async (c: any) => {
    if (!confirm('Delete this campaign?')) return;
    try { await marketingApi.deleteEmailCampaign(shopId!, c.id); load(); } catch {}
  };

  const preview = campaigns.find(c => c.id === previewId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Marketing</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create and send email campaigns to your customers</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: campaigns.length, color: 'text-gray-900 dark:text-white' },
          { label: 'Draft', value: campaigns.filter(c => c.status === 'draft').length, color: 'text-gray-600 dark:text-gray-300' },
          { label: 'Scheduled', value: campaigns.filter(c => c.status === 'scheduled').length, color: 'text-blue-600' },
          { label: 'Sent', value: campaigns.filter(c => c.status === 'sent').length, color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No campaigns yet. Create your first one.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                {['Campaign Name', 'Subject', 'Status', 'Created', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {campaigns.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-xs truncate">{c.subject}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] || STATUS_COLORS.draft}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPreviewId(c.id)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="Preview"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Edit2 className="w-4 h-4" /></button>
                      {c.status !== 'sent' && (
                        <button onClick={() => sendCampaign(c)} className="p-1.5 text-gray-400 hover:text-green-600 rounded" title="Mark as sent"><Send className="w-4 h-4" /></button>
                      )}
                      <button onClick={() => del(c)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editing ? 'Edit Campaign' : 'New Email Campaign'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Campaign Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Summer Sale Campaign" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject Line *</label>
                <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Don't miss our biggest sale of the year!" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Body (HTML)</label>
                <textarea value={form.body_html} onChange={e => setForm(f => ({ ...f, body_html: e.target.value }))} rows={8}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="<h1>Hello!</h1><p>Your message here...</p>" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Campaign'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{preview.name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Subject: {preview.subject}</p>
              </div>
              <button onClick={() => setPreviewId(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              {preview.body_html ? (
                <div className="prose dark:prose-invert max-w-none border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50"
                  dangerouslySetInnerHTML={{ __html: preview.body_html }} />
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No email body yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
