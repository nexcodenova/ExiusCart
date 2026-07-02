'use client';
import { useState, useEffect } from 'react';
import { Plus, ChevronLeft, ChevronRight, Calendar, MapPin, Globe, Trash2, Edit2, X, Loader2 } from 'lucide-react';
import { marketingApi } from '@/lib/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
  ongoing:  'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20',
  completed:'bg-muted text-muted-foreground border-border',
  cancelled:'bg-red-500/15 text-red-500 border-red-500/20',
};

const DOT_COLORS: Record<string, string> = {
  upcoming: 'bg-blue-500',
  ongoing:  'bg-green-500',
  completed:'bg-muted-foreground',
  cancelled:'bg-red-500',
};

const EMPTY = { title: '', description: '', location: '', start_date: '', end_date: '', capacity: '', is_online: false, meeting_url: '' };

export default function EventsPage() {
  const [shopId, setShopId] = useState('');
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  useEffect(() => { setShopId(localStorage.getItem('shop_id') || ''); }, []);

  const load = async () => {
    if (!shopId) return;
    try { const r = await marketingApi.getEvents(shopId); setEvents(r.data ?? []); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [shopId]);

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  // Build calendar grid
  const firstDow = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsOnDay = (day: number) =>
    events.filter(e => {
      const d = new Date(e.start_date);
      return d.getFullYear() === calYear && d.getMonth() === calMonth && d.getDate() === day;
    });

  const isToday = (day: number) =>
    day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();

  const openNew = (day?: number) => {
    setEditing(null);
    const dateStr = day
      ? `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T09:00`
      : '';
    setForm({ ...EMPTY, start_date: dateStr });
    setShowModal(true);
  };

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
      if (editing) await marketingApi.updateEvent(shopId, editing.id, payload);
      else await marketingApi.createEvent(shopId, payload);
      setShowModal(false);
      load();
    } catch {}
    finally { setSaving(false); }
  };

  const del = async (e: any, ev: React.MouseEvent) => {
    ev.stopPropagation();
    if (!confirm('Delete this event?')) return;
    try { await marketingApi.deleteEvent(shopId, e.id); load(); } catch {}
  };

  const fld = (key: string, val: any) => setForm((f: any) => ({ ...f, [key]: val }));

  // Upcoming events (sorted)
  const upcoming = [...events]
    .filter(e => e.status !== 'cancelled' && e.status !== 'completed')
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Events</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Click any day on the calendar to add an event</p>
        </div>
        <button onClick={() => openNew()} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
          <Plus className="w-4 h-4" /> New Event
        </button>
      </div>

      {/* Calendar */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <button onClick={prevMonth} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base font-semibold text-foreground">{MONTHS[calMonth]} {calYear}</h2>
          <button onClick={nextMonth} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAYS.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-border">
          {cells.map((day, idx) => {
            const dayEvents = day ? eventsOnDay(day) : [];
            return (
              <div
                key={idx}
                onClick={() => day && openNew(day)}
                className={`min-h-[80px] p-1.5 transition group ${
                  day ? 'cursor-pointer hover:bg-muted/50' : 'bg-muted/20'
                }`}
              >
                {day && (
                  <>
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium mb-1 ${
                      isToday(day)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground group-hover:bg-muted'
                    }`}>
                      {day}
                    </span>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 2).map(e => (
                        <div
                          key={e.id}
                          onClick={ev => { ev.stopPropagation(); openEdit(e); }}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition truncate cursor-pointer"
                          title={e.title}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_COLORS[e.status] ?? 'bg-primary'}`} />
                          <span className="truncate">{e.title}</span>
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <p className="text-xs text-muted-foreground px-1">+{dayEvents.length - 2} more</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming events list */}
      {!loading && upcoming.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Upcoming Events</h3>
          </div>
          <div className="divide-y divide-border">
            {upcoming.map(e => (
              <div key={e.id} className="flex items-start gap-4 px-5 py-3 hover:bg-muted/20 transition">
                <div className="shrink-0 text-center w-10">
                  <p className="text-xs text-muted-foreground uppercase">{MONTHS[new Date(e.start_date).getMonth()].slice(0,3)}</p>
                  <p className="text-xl font-bold text-foreground leading-none">{new Date(e.start_date).getDate()}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{e.title}</p>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs border ${STATUS_COLORS[e.status] ?? STATUS_COLORS.upcoming}`}>{e.status}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span>{new Date(e.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {e.is_online
                      ? <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> Online</span>
                      : e.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{e.location}</span>
                    }
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(e)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={ev => del(e, ev)} className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-16 text-center">
          <Calendar className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="font-semibold text-foreground mb-1">No events yet</h3>
          <p className="text-sm text-muted-foreground mb-5">Click any day on the calendar above to add your first event</p>
          <button onClick={() => openNew()} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
            <Plus className="w-4 h-4" /> New Event
          </button>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-lg max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h2 className="text-base font-semibold text-foreground">{editing ? 'Edit Event' : 'New Event'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Event Title *</label>
                <input
                  value={form.title}
                  onChange={e => fld('title', e.target.value)}
                  placeholder="Annual Customer Meetup"
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => fld('description', e.target.value)}
                  rows={2}
                  placeholder="Brief description..."
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Start Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={form.start_date}
                    onChange={e => fld('start_date', e.target.value)}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={form.end_date}
                    onChange={e => fld('end_date', e.target.value)}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_online"
                  checked={form.is_online}
                  onChange={e => fld('is_online', e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                />
                <label htmlFor="is_online" className="text-sm text-foreground cursor-pointer">Online Event</label>
              </div>
              {form.is_online ? (
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Meeting URL</label>
                  <input
                    value={form.meeting_url}
                    onChange={e => fld('meeting_url', e.target.value)}
                    placeholder="https://meet.google.com/..."
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Location</label>
                  <input
                    value={form.location}
                    onChange={e => fld('location', e.target.value)}
                    placeholder="Dubai Convention Centre"
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              )}
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Capacity</label>
                <input
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={e => fld('capacity', e.target.value)}
                  placeholder="100"
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-border shrink-0">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition text-sm">Cancel</button>
              <button
                onClick={save}
                disabled={saving || !form.title.trim() || !form.start_date}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
