'use client';
import { useState, useEffect } from 'react';
import { Plus, Calendar, MapPin, Users, Globe, Trash2, Edit2, X } from 'lucide-react';
import { marketingApi } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  ongoing: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  completed: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const EMPTY = { title: '', description: '', location: '', start_date: '', end_date: '', capacity: '', is_online: false, meeting_url: '' };

export default function EventsPage() {
  const [shopId, setShopId] = useState<string>('');
  const [events, setEvents] = useState<any[]>([]);
  useEffect(() => { setShopId(localStorage.getItem('shop_id') || '1'); }, []);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!shopId) return;
    try { const r = await marketingApi.getEvents(shopId); setEvents(r.data); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [shopId]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (e: any) => {
    setEditing(e);
    setForm({
      title: e.title, description: e.description || '', location: e.location || '',
      start_date: e.start_date?.slice(0, 16) || '', end_date: e.end_date?.slice(0, 16) || '',
      capacity: e.capacity || '', is_online: e.is_online, meeting_url: e.meeting_url || '',
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.start_date) return;
    setSaving(true);
    try {
      const payload = { ...form, capacity: form.capacity ? parseInt(form.capacity) : null, meeting_url: form.meeting_url || null };
      if (editing) await marketingApi.updateEvent(shopId!, editing.id, payload);
      else await marketingApi.createEvent(shopId!, payload);
      setShowModal(false); load();
    } catch {} finally { setSaving(false); }
  };

  const del = async (e: any) => {
    if (!confirm('Delete this event?')) return;
    try { await marketingApi.deleteEvent(shopId!, e.id); load(); } catch {}
  };

  const fld = (key: string, val: any) => setForm((f: any) => ({ ...f, [key]: val }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Events</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your events, webinars, and meetups</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Event
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
      ) : events.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No events yet. Create your first event.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {events.map(e => (
            <div key={e.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[e.status] || STATUS_COLORS.upcoming}`}>{e.status}</span>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(e)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => del(e)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{e.title}</h3>
              {e.description && <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{e.description}</p>}
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  {new Date(e.start_date).toLocaleString()}
                </div>
                {e.is_online ? (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <Globe className="w-3.5 h-3.5 text-gray-400" /> Online Event
                  </div>
                ) : e.location && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" /> {e.location}
                  </div>
                )}
                {e.capacity && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <Users className="w-3.5 h-3.5 text-gray-400" /> Capacity: {e.capacity}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editing ? 'Edit Event' : 'New Event'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {[
                { label: 'Event Title *', key: 'title', placeholder: 'Annual Customer Meetup' },
                { label: 'Description', key: 'description', placeholder: 'Brief description...' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{f.label}</label>
                  <input value={form[f.key]} onChange={e => fld(f.key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={f.placeholder} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date *</label>
                  <input type="datetime-local" value={form.start_date} onChange={e => fld('start_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                  <input type="datetime-local" value={form.end_date} onChange={e => fld('end_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="is_online" checked={form.is_online} onChange={e => fld('is_online', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded" />
                <label htmlFor="is_online" className="text-sm text-gray-700 dark:text-gray-300">Online Event</label>
              </div>
              {form.is_online ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meeting URL</label>
                  <input value={form.meeting_url} onChange={e => fld('meeting_url', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    placeholder="https://meet.google.com/..." />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                  <input value={form.location} onChange={e => fld('location', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    placeholder="Dubai Convention Centre" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Capacity</label>
                <input type="number" min="1" value={form.capacity} onChange={e => fld('capacity', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="100" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Event'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
