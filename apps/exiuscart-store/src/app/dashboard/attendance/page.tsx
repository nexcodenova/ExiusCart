'use client';
import { useState, useEffect } from 'react';
import { Plus, Clock, CheckCircle, XCircle, AlertCircle, Trash2, Edit2, X } from 'lucide-react';
import { attendanceApi, hrApi } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  present: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  absent: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  late: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  half_day: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  leave: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
};
const STATUS_ICONS: Record<string, any> = {
  present: CheckCircle, absent: XCircle, late: AlertCircle, half_day: Clock, leave: Clock,
};

function todayStr() { return new Date().toISOString().slice(0, 10); }
function monthStr() { return new Date().toISOString().slice(0, 7); }

const EMPTY_FORM = { employee_id: '', date: todayStr(), status: 'present', check_in: '', check_out: '', notes: '' };

export default function AttendancePage() {
  const [shopId, setShopId] = useState<string>('');
  const [records, setRecords] = useState<any[]>([]);
  useEffect(() => { setShopId(localStorage.getItem('shop_id') || '1'); }, []);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(monthStr());
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [r, e] = await Promise.all([attendanceApi.getAll(shopId, month), hrApi.getEmployees(shopId)]);
      setRecords(r.data); setEmployees(e.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [shopId, month]);

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (r: any) => {
    setEditing(r);
    setForm({
      employee_id: r.employee_id, date: r.date, status: r.status,
      check_in: r.check_in?.slice(0, 16) || '', check_out: r.check_out?.slice(0, 16) || '',
      notes: r.notes || '',
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.employee_id || !form.date) return;
    setSaving(true);
    try {
      const payload = { ...form, employee_id: parseInt(form.employee_id), check_in: form.check_in || null, check_out: form.check_out || null };
      if (editing) await attendanceApi.update(shopId!, editing.id, payload);
      else await attendanceApi.create(shopId!, payload);
      setShowModal(false); load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Error saving record');
    } finally { setSaving(false); }
  };

  const del = async (r: any) => {
    if (!confirm('Delete this record?')) return;
    try { await attendanceApi.delete(shopId!, r.id); load(); } catch {}
  };

  const fld = (key: string, val: any) => setForm((f: any) => ({ ...f, [key]: val }));

  const stats = {
    present: records.filter(r => r.status === 'present').length,
    absent: records.filter(r => r.status === 'absent').length,
    late: records.filter(r => r.status === 'late').length,
    leave: records.filter(r => r.status === 'leave').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track employee attendance and working hours</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Record
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Present', value: stats.present, color: 'text-green-600' },
          { label: 'Absent', value: stats.absent, color: 'text-red-600' },
          { label: 'Late', value: stats.late, color: 'text-orange-600' },
          { label: 'On Leave', value: stats.leave, color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
          : records.length === 0 ? (
            <div className="p-12 text-center">
              <Clock className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No attendance records for this month.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>{['Employee', 'Date', 'Status', 'Check In', 'Check Out', 'Hours', 'Notes', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {records.map(r => {
                  const Icon = STATUS_ICONS[r.status] || Clock;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.employee_name}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{r.date}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[r.status]}`}>
                          <Icon className="w-3 h-3" />{r.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{r.check_in ? new Date(r.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{r.check_out ? new Date(r.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{r.hours_worked ? `${r.hours_worked}h` : '—'}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">{r.notes || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => del(r)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editing ? 'Edit Record' : 'Add Attendance'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Employee *</label>
                <select value={form.employee_id} onChange={e => fld('employee_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                  <option value="">Select employee...</option>
                  {employees.map((e: any) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
                  <input type="date" value={form.date} onChange={e => fld('date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select value={form.status} onChange={e => fld('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                    {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Check In</label>
                  <input type="datetime-local" value={form.check_in} onChange={e => fld('check_in', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Check Out</label>
                  <input type="datetime-local" value={form.check_out} onChange={e => fld('check_out', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <input value={form.notes} onChange={e => fld('notes', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Optional note..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Record'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
