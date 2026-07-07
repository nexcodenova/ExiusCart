'use client';

import { useState, useEffect } from 'react';
import {
  Users, Plus, Edit2, Trash2, X, Loader2, CheckCircle,
  DollarSign, Calendar, Printer, ChevronDown,
} from 'lucide-react';
import { payrollApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

type Tab = 'staff' | 'runs';

interface Staff {
  id: number;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  salary: number;
  currency: string;
  join_date?: string;
  notes?: string;
  is_active: boolean;
}

interface RunStaffEntry {
  staff_id: number;
  name: string;
  role: string;
  base_salary: number;
  bonus: number;
  deduction: number;
}

interface PayrollRun {
  id: number;
  month: number;
  year: number;
  status: 'draft' | 'paid';
  total_amount: number;
  paid_date?: string;
  notes?: string;
  created_at: string;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CURRENCIES = ['AED','USD','LKR','EUR','GBP','SAR'];

const emptyStaff = { name: '', role: '', email: '', phone: '', salary: 0, currency: 'AED', join_date: '', notes: '', is_active: true };

export default function PayrollPage() {
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
  const { fmt } = useCurrency();
  const [tab, setTab] = useState<Tab>('staff');
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [runLoading, setRunLoading] = useState(false);

  const [staffModal, setStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [staffForm, setStaffForm] = useState<typeof emptyStaff>({ ...emptyStaff });
  const [staffSaving, setStaffSaving] = useState(false);

  const [runModal, setRunModal] = useState(false);
  const now = new Date();
  const [runMonth, setRunMonth] = useState(now.getMonth() + 1);
  const [runYear, setRunYear] = useState(now.getFullYear());
  const [runNotes, setRunNotes] = useState('');
  const [runEntries, setRunEntries] = useState<RunStaffEntry[]>([]);
  const [runSaving, setRunSaving] = useState(false);

  const [viewRun, setViewRun] = useState<{ run: PayrollRun; entries: any[] } | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (!shopId) { setLoading(false); return; }
    Promise.all([
      payrollApi.getStaff(shopId),
      payrollApi.getRuns(shopId),
    ]).then(([s, r]) => {
      setStaffList(s.data ?? []);
      setRuns(r.data ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [shopId]);

  function openAddStaff() {
    setEditingStaff(null);
    setStaffForm({ ...emptyStaff });
    setStaffModal(true);
  }

  function openEditStaff(s: Staff) {
    setEditingStaff(s);
    setStaffForm({
      name: s.name, role: s.role, email: s.email ?? '', phone: s.phone ?? '',
      salary: s.salary, currency: s.currency, join_date: s.join_date ?? '',
      notes: s.notes ?? '', is_active: s.is_active,
    });
    setStaffModal(true);
  }

  async function saveStaff() {
    setStaffSaving(true);
    try {
      if (editingStaff) {
        const res = await payrollApi.updateStaff(shopId, editingStaff.id, staffForm);
        setStaffList(prev => prev.map(s => s.id === editingStaff.id ? res.data : s));
      } else {
        const res = await payrollApi.createStaff(shopId, staffForm);
        setStaffList(prev => [...prev, res.data]);
      }
      setStaffModal(false);
      showToast(editingStaff ? 'Staff updated' : 'Staff added', 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Failed to save', 'error');
    } finally {
      setStaffSaving(false);
    }
  }

  async function softDeleteStaff(s: Staff) {
    if (!confirm(`Set ${s.name} as inactive?`)) return;
    try {
      await payrollApi.updateStaff(shopId, s.id, { is_active: false });
      setStaffList(prev => prev.map(x => x.id === s.id ? { ...x, is_active: false } : x));
      showToast('Staff set to inactive', 'success');
    } catch {
      showToast('Failed', 'error');
    }
  }

  function openRunModal() {
    const active = staffList.filter(s => s.is_active);
    setRunEntries(active.map(s => ({ staff_id: s.id, name: s.name, role: s.role, base_salary: s.salary, bonus: 0, deduction: 0 })));
    setRunNotes('');
    setRunModal(true);
  }

  async function createRun() {
    setRunSaving(true);
    try {
      const payload = {
        month: runMonth,
        year: runYear,
        notes: runNotes,
        entries: runEntries.map(e => ({ staff_id: e.staff_id, bonus: e.bonus, deduction: e.deduction })),
      };
      const res = await payrollApi.createRun(shopId, payload);
      setRuns(prev => [res.data, ...prev]);
      setRunModal(false);
      showToast('Payroll run created', 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Failed to create run', 'error');
    } finally {
      setRunSaving(false);
    }
  }

  async function markPaid(run: PayrollRun) {
    if (!confirm(`Mark payroll for ${MONTHS[run.month - 1]} ${run.year} as paid?`)) return;
    try {
      await payrollApi.markPaid(shopId, run.id);
      setRuns(prev => prev.map(r => r.id === run.id ? { ...r, status: 'paid', paid_date: new Date().toISOString() } : r));
      showToast('Marked as paid', 'success');
    } catch {
      showToast('Failed', 'error');
    }
  }

  async function openPayslips(run: PayrollRun) {
    setViewLoading(true);
    try {
      const res = await payrollApi.getRun(shopId, run.id);
      setViewRun({ run, entries: res.data?.entries ?? [] });
    } catch {
      showToast('Failed to load payslips', 'error');
    } finally {
      setViewLoading(false);
    }
  }

  function printPayslips() {
    window.print();
  }

  const grandTotal = runEntries.reduce((s, e) => s + e.base_salary + e.bonus - e.deduction, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payroll</h1>
          <p className="text-muted-foreground text-sm">Manage staff and payroll runs</p>
        </div>
        <button type="button"
          onClick={tab === 'staff' ? openAddStaff : openRunModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
          <Plus className="w-4 h-4" />
          {tab === 'staff' ? 'Add Staff' : 'Run Payroll'}
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border p-1.5">
        <div className="flex gap-1">
          {(['staff', 'runs'] as Tab[]).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium capitalize transition ${tab === t ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
              {t === 'staff' ? <Users className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
              {t === 'staff' ? 'Staff' : 'Payroll Runs'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'staff' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {staffList.length === 0 ? (
            <div className="py-20 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground text-sm">No staff added yet. Add your first staff member.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {['Name','Role','Salary','Join Date','Status','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {staffList.map(s => (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{s.name}</p>
                        {s.email && <p className="text-xs text-muted-foreground">{s.email}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.role}</td>
                      <td className="px-4 py-3 text-foreground font-medium">{s.salary.toLocaleString()} {s.currency}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.join_date || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.is_active ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                          {s.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => openEditStaff(s)}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {s.is_active && (
                            <button type="button" onClick={() => softDeleteStaff(s)}
                              className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'runs' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {runs.length === 0 ? (
            <div className="py-20 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground text-sm">No payroll runs yet. Click "Run Payroll" to create one.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {['Period','Status','Total Amount','Paid Date','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {runs.map(run => (
                    <tr key={run.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-foreground">{MONTHS[run.month - 1]} {run.year}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${run.status === 'paid' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'}`}>
                          {run.status === 'paid' ? 'Paid' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground font-semibold">{fmt(run.total_amount)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {run.paid_date ? new Date(run.paid_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {run.status === 'draft' && (
                            <button type="button" onClick={() => markPaid(run)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 text-xs font-medium rounded-lg transition">
                              <CheckCircle className="w-3.5 h-3.5" /> Mark Paid
                            </button>
                          )}
                          <button type="button" onClick={() => openPayslips(run)} disabled={viewLoading}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-medium rounded-lg transition">
                            <Printer className="w-3.5 h-3.5" /> Payslips
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {staffModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">{editingStaff ? 'Edit Staff' : 'Add Staff'}</h2>
              <button type="button" onClick={() => setStaffModal(false)} className="p-1.5 hover:bg-muted rounded-lg transition text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Full Name *</label>
                  <input type="text" value={staffForm.name} onChange={e => setStaffForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Role / Position *</label>
                  <input type="text" value={staffForm.role} onChange={e => setStaffForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                  <input type="email" value={staffForm.email} onChange={e => setStaffForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Phone</label>
                  <input type="tel" value={staffForm.phone} onChange={e => setStaffForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Base Salary *</label>
                  <input type="number" min="0" value={staffForm.salary} onChange={e => setStaffForm(f => ({ ...f, salary: Number(e.target.value) }))}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Currency</label>
                  <select value={staffForm.currency} onChange={e => setStaffForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Join Date</label>
                  <input type="date" value={staffForm.join_date} onChange={e => setStaffForm(f => ({ ...f, join_date: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                <textarea value={staffForm.notes} onChange={e => setStaffForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button type="button" onClick={() => setStaffModal(false)}
                className="flex-1 py-2.5 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={saveStaff} disabled={staffSaving || !staffForm.name || !staffForm.role}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
                {staffSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editingStaff ? 'Save Changes' : 'Add Staff'}
              </button>
            </div>
          </div>
        </div>
      )}

      {runModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">Run Payroll</h2>
              <button type="button" onClick={() => setRunModal(false)} className="p-1.5 hover:bg-muted rounded-lg transition text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Month</label>
                  <select value={runMonth} onChange={e => setRunMonth(Number(e.target.value))}
                    className="px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary">
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Year</label>
                  <input type="number" value={runYear} onChange={e => setRunYear(Number(e.target.value))}
                    className="w-24 px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                <textarea value={runNotes} onChange={e => setRunNotes(e.target.value)} rows={2}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>

              {runEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No active staff found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        {['Name','Role','Base Salary','Bonus','Deduction','Net Pay'].map(h => (
                          <th key={h} className="text-left px-3 py-2.5 text-muted-foreground font-medium text-xs">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {runEntries.map((e, i) => {
                        const net = e.base_salary + e.bonus - e.deduction;
                        return (
                          <tr key={e.staff_id}>
                            <td className="px-3 py-2.5 font-medium text-foreground">{e.name}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{e.role}</td>
                            <td className="px-3 py-2.5 text-foreground">{e.base_salary.toLocaleString()}</td>
                            <td className="px-3 py-2.5">
                              <input type="number" min="0" value={e.bonus}
                                onChange={ev => setRunEntries(prev => prev.map((x, j) => j === i ? { ...x, bonus: Number(ev.target.value) } : x))}
                                className="w-24 px-2 py-1 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
                            </td>
                            <td className="px-3 py-2.5">
                              <input type="number" min="0" value={e.deduction}
                                onChange={ev => setRunEntries(prev => prev.map((x, j) => j === i ? { ...x, deduction: Number(ev.target.value) } : x))}
                                className="w-24 px-2 py-1 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
                            </td>
                            <td className={`px-3 py-2.5 font-semibold ${net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                              {net.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-muted/50 border-t-2 border-border">
                      <tr>
                        <td colSpan={5} className="px-3 py-3 font-bold text-foreground">Grand Total</td>
                        <td className="px-3 py-3 font-bold text-foreground text-base">{grandTotal.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button type="button" onClick={() => setRunModal(false)}
                className="flex-1 py-2.5 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={createRun} disabled={runSaving || runEntries.length === 0}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
                {runSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                Create Run
              </button>
            </div>
          </div>
        </div>
      )}

      {viewRun && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">
                Payslips — {MONTHS[viewRun.run.month - 1]} {viewRun.run.year}
              </h2>
              <div className="flex items-center gap-2">
                <button type="button" onClick={printPayslips}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-lg transition">
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button type="button" onClick={() => setViewRun(null)} className="p-1.5 hover:bg-muted rounded-lg transition text-muted-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1 payslip-content">
              {viewRun.entries.map((entry: any, i: number) => (
                <div key={i} className="border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-foreground">{entry.name ?? entry.staff_name}</p>
                      <p className="text-xs text-muted-foreground">{entry.role ?? entry.staff_role}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Pay Period</p>
                      <p className="text-sm font-medium text-foreground">{MONTHS[viewRun.run.month - 1]} {viewRun.run.year}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground">Base Salary</p>
                      <p className="font-semibold text-foreground">{(entry.base_salary ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-green-500/10 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground">Bonus</p>
                      <p className="font-semibold text-green-600 dark:text-green-400">+{(entry.bonus ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-red-500/10 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground">Deductions</p>
                      <p className="font-semibold text-red-500">-{(entry.deduction ?? 0).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-between items-center bg-indigo-500/10 rounded-lg p-3">
                    <span className="font-semibold text-foreground">Net Pay</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {((entry.base_salary ?? 0) + (entry.bonus ?? 0) - (entry.deduction ?? 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .payslip-content, .payslip-content * { visibility: visible; }
          .payslip-content { position: absolute; top: 0; left: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
