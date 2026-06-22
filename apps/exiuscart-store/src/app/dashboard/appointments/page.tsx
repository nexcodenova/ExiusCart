'use client';
import { useState, useEffect } from 'react';
import { Plus, CalendarCheck, Clock, User, Phone, Mail, Trash2, Edit2, X } from 'lucide-react';
import { appointmentsApi } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  completed: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  no_show: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
};

const EMPTY = { title: '', customer_name: '', customer_phone: '', customer_email: '', start_datetime: '', end_datetime: '', notes: '', assigned_to: '' };

function fmt(dt: string) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AppointmentsPage() {
  const [shopId, setShopId] = useState<string>('');
  const [appointments, setAppointments] = useState<any[]>([]);
  useEffect(() => { setShopId(localStorage.getItem('shop_id') || '1'); }, []);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'today'>('list');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    try { const r = await appointmentsApi.getAll(shopId); setAppointments(r.data); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [shopId]);

  const openNew = () => {
    setEditing(null);
    const now = new Date(); now.setMinutes(0, 0, 0);
    const end = new Date(now); end.setHours(end.getHours() + 1);
    setForm({ ...EMPTY, start_datetime: now.toISOString().slice(0, 16), end_datetime: end.toISOString().slice(0, 16) });
    setShowModal(true);
  };
  const openEdit = (a: any) => {
    setEditing(a);
    setForm({
      title: a.title, customer_name: a.customer_name || '', customer_phone: a.customer_phone || '',
      customer_email: a.customer_email || '', start_datetime: a.start_datetime?.slice(0, 16) || '',
      end_datetime: a.end_datetime?.slice(0, 16) || '', notes: a.notes || '', assigned_to: a.assigned_to || '',
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.start_datetime) return;
    setSaving(true);
    try {
      if (editing) await appointmentsApi.update(shopId!, editing.id, form);
      else await appointmentsApi.create(shopId!, form);
      setShowModal(false); load();
    } catch {} finally { setSaving(false); }
  };

  const updateStatus = async (a: any, status: string) => {
    try { await appointmentsApi.update(shopId!, a.id, { status }); load(); } catch {}
  };

  const del = async (a: any) => {
    if (!confirm('Delete this appointment?')) return;
    try { await appointmentsApi.delete(shopId!, a.id); load(); } catch {}
  };

  const fld = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const today = new Date().toISOString().slice(0, 10);
  const todayApps = appointments.filter(a => a.start_datetime?.startsWith(today));
  const upcoming = appointments.filter(a => a.start_datetime > new Date().toISOString() && a.status !== 'cancelled');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Appointments</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Schedule and manage customer appointments</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Appointment
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Today's Appointments", value: todayApps.length },
          { label: 'Upcoming', value: upcoming.length },
          { label: 'Confirmed', value: appointments.filter(a => a.status === 'confirmed').length },
          { label: 'Completed', value: appointments.filter(a => a.status === 'completed').length },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Today's Appointments highlight */}
      {todayApps.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-3">Today's Schedule</h3>
          <div className="space-y-2">
            {todayApps.map(a => (
              <div key={a.id} className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg px-3 py-2">
                <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">{a.title}</span>
                {a.customer_name && <span className="text-sm text-gray-500 dark:text-gray-400">— {a.customer_name}</span>}
                <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">{new Date(a.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[a.status]}`}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Appointments */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
          : appointments.length === 0 ? (
            <div className="p-12 text-center">
              <CalendarCheck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No appointments yet. Schedule your first one.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>{['Title', 'Customer', 'Start', 'End', 'Assigned To', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {appointments.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{a.title}</td>
                    <td className="px-4 py-3">
                      {a.customer_name ? (
                        <div>
                          <div className="text-gray-900 dark:text-white">{a.customer_name}</div>
                          {a.customer_phone && <div className="text-xs text-gray-400">{a.customer_phone}</div>}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{fmt(a.start_datetime)}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmt(a.end_datetime)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{a.assigned_to || '—'}</td>
                    <td className="px-4 py-3">
                      <select value={a.status} onChange={e => updateStatus(a, e.target.value)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 ${STATUS_COLORS[a.status]}`}>
                        {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(a)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => del(a)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editing ? 'Edit Appointment' : 'New Appointment'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                <input value={form.title} onChange={e => fld('title', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Hair Cut, Consultation, etc." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start *</label>
                  <input type="datetime-local" value={form.start_datetime} onChange={e => fld('start_datetime', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End</label>
                  <input type="datetime-local" value={form.end_datetime} onChange={e => fld('end_datetime', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
              </div>
              {[
                { label: 'Customer Name', key: 'customer_name', placeholder: 'John Doe', icon: User },
                { label: 'Customer Phone', key: 'customer_phone', placeholder: '+XX XX XXX XXXX', icon: Phone },
                { label: 'Customer Email', key: 'customer_email', placeholder: 'john@example.com', icon: Mail },
                { label: 'Assigned To', key: 'assigned_to', placeholder: 'Staff member', icon: User },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{f.label}</label>
                  <input value={form[f.key]} onChange={e => fld(f.key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    placeholder={f.placeholder} />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => fld('notes', e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Any special notes..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : editing ? 'Save Changes' : 'Schedule Appointment'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
