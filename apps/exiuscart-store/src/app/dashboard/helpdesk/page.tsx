'use client';
import { useState, useEffect } from 'react';
import { Plus, Ticket, CheckCircle, Clock, AlertCircle, Trash2, Edit2, X } from 'lucide-react';
import { helpdeskApi } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  in_progress: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  normal: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

const EMPTY = { subject: '', description: '', customer_name: '', customer_email: '', customer_phone: '', priority: 'normal', assigned_to: '' };

export default function HelpdeskPage() {
  const [shopId, setShopId] = useState<string>('');
  const [tickets, setTickets] = useState<any[]>([]);
  useEffect(() => { setShopId(localStorage.getItem('shop_id') || '1'); }, []);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    try { const r = await helpdeskApi.getTickets(shopId, statusFilter || undefined); setTickets(r.data); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [shopId, statusFilter]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (t: any) => {
    setEditing(t);
    setForm({ subject: t.subject, description: t.description || '', customer_name: t.customer_name || '', customer_email: t.customer_email || '', customer_phone: t.customer_phone || '', priority: t.priority, assigned_to: t.assigned_to || '' });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.subject.trim()) return;
    setSaving(true);
    try {
      if (editing) await helpdeskApi.updateTicket(shopId!, editing.id, form);
      else await helpdeskApi.createTicket(shopId!, form);
      setShowModal(false); load();
    } catch {} finally { setSaving(false); }
  };

  const updateStatus = async (t: any, status: string) => {
    try { await helpdeskApi.updateTicket(shopId!, t.id, { status }); load(); } catch {}
  };

  const del = async (t: any) => {
    if (!confirm('Delete this ticket?')) return;
    try { await helpdeskApi.deleteTicket(shopId!, t.id); load(); } catch {}
  };

  const fld = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const stats = { open: tickets.filter(t => t.status === 'open').length, in_progress: tickets.filter(t => t.status === 'in_progress').length, resolved: tickets.filter(t => t.status === 'resolved').length };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Helpdesk</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage customer support tickets</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Ticket
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: tickets.length, icon: Ticket, color: 'text-gray-900 dark:text-white' },
          { label: 'Open', value: stats.open, icon: AlertCircle, color: 'text-blue-600' },
          { label: 'In Progress', value: stats.in_progress, icon: Clock, color: 'text-orange-600' },
          { label: 'Resolved', value: stats.resolved, icon: CheckCircle, color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {[{ label: 'All', value: '' }, { label: 'Open', value: 'open' }, { label: 'In Progress', value: 'in_progress' }, { label: 'Resolved', value: 'resolved' }, { label: 'Closed', value: 'closed' }].map(f => (
          <button key={f.value} onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${statusFilter === f.value ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Tickets Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
          : tickets.length === 0 ? (
            <div className="p-12 text-center">
              <Ticket className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No tickets{statusFilter ? ` with status "${statusFilter}"` : ''} yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>{['Ticket #', 'Subject', 'Customer', 'Priority', 'Status', 'Assigned', 'Created', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {tickets.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{t.ticket_number}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-xs truncate">{t.subject}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{t.customer_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      <select value={t.status} onChange={e => updateStatus(t, e.target.value)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 ${STATUS_COLORS[t.status]}`}>
                        {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{t.assigned_to || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => del(t)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editing ? 'Edit Ticket' : 'New Support Ticket'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject *</label>
                <input value={form.subject} onChange={e => fld('subject', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Customer can't login to their account" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea value={form.description} onChange={e => fld('description', e.target.value)} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Detailed description of the issue..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Customer Name', key: 'customer_name', placeholder: 'John Doe' },
                  { label: 'Customer Email', key: 'customer_email', placeholder: 'john@example.com' },
                  { label: 'Customer Phone', key: 'customer_phone', placeholder: '+971 50 000 0000' },
                  { label: 'Assigned To', key: 'assigned_to', placeholder: 'Support agent name' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{f.label}</label>
                    <input value={form[f.key]} onChange={e => fld(f.key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      placeholder={f.placeholder} />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                <select value={form.priority} onChange={e => fld('priority', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                  {Object.keys(PRIORITY_COLORS).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Ticket'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
