'use client';

import { useState, useEffect, useCallback } from 'react';
import { hrApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';
import {
  Users, DollarSign, Calendar, Plus, Edit2, Trash2,
  CheckCircle, XCircle, Clock, Play, CreditCard, ChevronDown, ChevronUp,
} from 'lucide-react';

type Tab = 'employees' | 'payroll' | 'leaves';

interface Employee {
  id: number; full_name: string; position: string | null; department: string | null;
  email: string | null; phone: string | null; join_date: string | null;
  basic_salary: number; allowances: number; currency: string;
  employment_type: string; status: string;
}

interface PayrollRecord {
  id: number; month: string; employee_id: number; employee_name: string;
  basic_salary: number; allowances: number; deductions: number; bonus: number;
  net_salary: number; currency: string; status: string; paid_at: string | null;
}

interface LeaveRequest {
  id: number; employee_id: number; employee_name: string; leave_type: string;
  start_date: string; end_date: string; days: number; reason: string | null; status: string; created_at: string;
}

const EMPTY_EMP = (defaultCurrency = 'AED') => ({
  full_name: '', position: '', department: '', email: '', phone: '',
  join_date: '', basic_salary: '0', allowances: '0',
  employment_type: 'full_time', currency: defaultCurrency,
});

export default function HRPage() {
  const [tab, setTab] = useState<Tab>('employees');
  const [shopId, setShopId] = useState<string>('');
  const { currency, fmt } = useCurrency();

  // Employees
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [empModal, setEmpModal] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [empForm, setEmpForm] = useState(EMPTY_EMP());
  const [empSaving, setEmpSaving] = useState(false);

  // Payroll
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [payrollMonth, setPayrollMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [runningPayroll, setRunningPayroll] = useState(false);
  const [expandedPay, setExpandedPay] = useState<number | null>(null);
  const [deductions, setDeductions] = useState<Record<string, string>>({});
  const [bonuses, setBonuses] = useState<Record<string, string>>({});

  // Leaves
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveModal, setLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    employee_id: '', leave_type: 'annual', start_date: '', end_date: '', reason: '',
  });
  const [leaveSaving, setLeaveSaving] = useState(false);

  useEffect(() => {
    const id = localStorage.getItem('shop_id') || '1';
    setShopId(id);
  }, []);

  const loadEmployees = useCallback(async () => {
    if (!shopId) return;
    setEmpLoading(true);
    try {
      const res = await hrApi.getEmployees(shopId);
      setEmployees(res.data);
    } catch {}
    setEmpLoading(false);
  }, [shopId]);

  const loadPayroll = useCallback(async () => {
    if (!shopId) return;
    setPayrollLoading(true);
    try {
      const res = await hrApi.getPayroll(shopId, payrollMonth);
      setPayroll(res.data);
    } catch {}
    setPayrollLoading(false);
  }, [shopId, payrollMonth]);

  const loadLeaves = useCallback(async () => {
    if (!shopId) return;
    setLeaveLoading(true);
    try {
      const res = await hrApi.getLeaves(shopId);
      setLeaves(res.data);
    } catch {}
    setLeaveLoading(false);
  }, [shopId]);

  useEffect(() => { if (shopId) loadEmployees(); }, [loadEmployees]);
  useEffect(() => { if (shopId && tab === 'payroll') loadPayroll(); }, [loadPayroll, tab]);
  useEffect(() => { if (shopId && tab === 'leaves') loadLeaves(); }, [loadLeaves, tab]);

  // ── Employee handlers ───────────────────────────────────────
  function openAddEmp() {
    setEditEmp(null);
    setEmpForm({ ...EMPTY_EMP(currency) });
    setEmpModal(true);
  }
  function openEditEmp(e: Employee) {
    setEditEmp(e);
    setEmpForm({
      full_name: e.full_name, position: e.position || '', department: e.department || '',
      email: e.email || '', phone: e.phone || '', join_date: e.join_date || '',
      basic_salary: String(e.basic_salary), allowances: String(e.allowances),
      employment_type: e.employment_type, currency: e.currency,
    });
    setEmpModal(true);
  }
  async function saveEmployee() {
    if (!empForm.full_name.trim()) return;
    setEmpSaving(true);
    try {
      const payload = {
        ...empForm,
        basic_salary: parseFloat(empForm.basic_salary) || 0,
        allowances: parseFloat(empForm.allowances) || 0,
      };
      if (editEmp) {
        await hrApi.updateEmployee(shopId, editEmp.id, payload);
      } else {
        await hrApi.createEmployee(shopId, payload);
      }
      setEmpModal(false);
      loadEmployees();
    } catch {}
    setEmpSaving(false);
  }
  async function terminateEmployee(empId: number) {
    if (!confirm('Mark this employee as terminated?')) return;
    try {
      await hrApi.deleteEmployee(shopId, empId);
      loadEmployees();
    } catch {}
  }

  // ── Payroll handlers ────────────────────────────────────────
  async function runPayroll() {
    setRunningPayroll(true);
    try {
      const dec: Record<string, number> = {};
      const bon: Record<string, number> = {};
      employees.forEach(e => {
        if (deductions[e.id]) dec[e.id] = parseFloat(deductions[e.id]) || 0;
        if (bonuses[e.id]) bon[e.id] = parseFloat(bonuses[e.id]) || 0;
      });
      await hrApi.runPayroll(shopId, { month: payrollMonth, deductions: dec, bonuses: bon });
      loadPayroll();
    } catch {}
    setRunningPayroll(false);
  }
  async function markPaid(recordId: number) {
    try {
      await hrApi.markPaid(shopId, recordId);
      loadPayroll();
    } catch {}
  }

  // ── Leave handlers ──────────────────────────────────────────
  async function saveLeave() {
    if (!leaveForm.employee_id || !leaveForm.start_date || !leaveForm.end_date) return;
    setLeaveSaving(true);
    try {
      await hrApi.createLeave(shopId, {
        ...leaveForm,
        employee_id: parseInt(leaveForm.employee_id),
      });
      setLeaveModal(false);
      setLeaveForm({ employee_id: '', leave_type: 'annual', start_date: '', end_date: '', reason: '' });
      loadLeaves();
    } catch {}
    setLeaveSaving(false);
  }
  async function updateLeaveStatus(leaveId: number, status: string) {
    try {
      await hrApi.updateLeaveStatus(shopId, leaveId, status);
      loadLeaves();
    } catch {}
  }

  const activeCount = employees.filter(e => e.status === 'active').length;
  const totalPayroll = payroll.reduce((s, r) => s + r.net_salary, 0);
  const pendingLeaves = leaves.filter(l => l.status === 'pending').length;

  const leaveColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">HR &amp; Payroll</h1>
          <p className="text-sm text-muted-foreground">Manage employees, payroll and leave requests</p>
        </div>
        {tab === 'employees' && (
          <button onClick={openAddEmp} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Add Employee
          </button>
        )}
        {tab === 'leaves' && (
          <button onClick={() => setLeaveModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Request Leave
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-blue-500" /></div>
          <div><p className="text-sm text-muted-foreground">Active Employees</p><p className="text-xl font-bold text-foreground">{activeCount}</p></div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center"><DollarSign className="w-5 h-5 text-green-500" /></div>
          <div><p className="text-sm text-muted-foreground">Payroll This Month</p><p className="text-xl font-bold text-foreground">{fmt(totalPayroll)}</p></div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center"><Calendar className="w-5 h-5 text-yellow-500" /></div>
          <div><p className="text-sm text-muted-foreground">Pending Leaves</p><p className="text-xl font-bold text-foreground">{pendingLeaves}</p></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1">
          {(['employees', 'payroll', 'leaves'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition capitalize ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {t === 'leaves' ? 'Leave Management' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── EMPLOYEES TAB ── */}
      {tab === 'employees' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {empLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading employees...</div>
          ) : employees.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No employees yet. Add your first employee.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-border bg-muted/30">
                  {['Name','Position','Department','Salary','Type','Status','Actions'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-muted/20 transition">
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm text-foreground">{emp.full_name}</div>
                        {emp.email && <div className="text-xs text-muted-foreground">{emp.email}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{emp.position || '—'}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{emp.department || '—'}</td>
                      <td className="px-4 py-3 text-sm text-foreground font-medium">
                        {emp.currency} {(emp.basic_salary + emp.allowances).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                          {emp.employment_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${emp.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEditEmp(emp)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {emp.status === 'active' && (
                            <button onClick={() => terminateEmployee(emp.id)} className="p-1.5 rounded-lg hover:bg-red-100 text-muted-foreground hover:text-red-600 transition" title="Terminate">
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* ── PAYROLL TAB ── */}
      {tab === 'payroll' && (
        <div className="space-y-4">
          {/* Run Payroll Panel */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex flex-wrap items-end gap-4 mb-5">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Payroll Month</label>
                <input type="month" value={payrollMonth} onChange={e => setPayrollMonth(e.target.value)}
                  className="px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" />
              </div>
              <button onClick={runPayroll} disabled={runningPayroll}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                <Play className="w-4 h-4" />
                {runningPayroll ? 'Generating...' : 'Run Payroll'}
              </button>
            </div>

            {/* Per-employee deductions/bonuses */}
            {employees.filter(e => e.status === 'active').length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Adjustments (optional)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border">
                      <th className="text-left text-xs font-medium text-muted-foreground py-2 pr-4">Employee</th>
                      <th className="text-left text-xs font-medium text-muted-foreground py-2 pr-4">Base Salary</th>
                      <th className="text-left text-xs font-medium text-muted-foreground py-2 pr-4">Deductions</th>
                      <th className="text-left text-xs font-medium text-muted-foreground py-2">Bonus</th>
                    </tr></thead>
                    <tbody className="divide-y divide-border">
                      {employees.filter(e => e.status === 'active').map(emp => (
                        <tr key={emp.id}>
                          <td className="py-2 pr-4 font-medium text-foreground">{emp.full_name}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{emp.currency} {(emp.basic_salary + emp.allowances).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="py-2 pr-4">
                            <input type="number" placeholder="0.00" min="0"
                              value={deductions[emp.id] || ''}
                              onChange={e => setDeductions(d => ({ ...d, [emp.id]: e.target.value }))}
                              className="w-28 px-2 py-1 border border-border rounded text-sm bg-background text-foreground" />
                          </td>
                          <td className="py-2">
                            <input type="number" placeholder="0.00" min="0"
                              value={bonuses[emp.id] || ''}
                              onChange={e => setBonuses(b => ({ ...b, [emp.id]: e.target.value }))}
                              className="w-28 px-2 py-1 border border-border rounded text-sm bg-background text-foreground" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Payroll Records */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-medium text-foreground">Payroll Records — {payrollMonth}</h3>
              <span className="text-sm text-muted-foreground">{payroll.length} records</span>
            </div>
            {payrollLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : payroll.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No payroll records. Run payroll above to generate.</div>
            ) : (
              <div className="divide-y divide-border">
                {payroll.map(r => (
                  <div key={r.id}>
                    <div className="px-4 py-3 flex items-center justify-between hover:bg-muted/20 transition cursor-pointer"
                      onClick={() => setExpandedPay(expandedPay === r.id ? null : r.id)}>
                      <div className="flex items-center gap-3">
                        {expandedPay === r.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        <div>
                          <p className="font-medium text-sm text-foreground">{r.employee_name}</p>
                          <p className="text-xs text-muted-foreground">{r.month}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold text-foreground">{r.currency} {r.net_salary.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                          <p className="text-xs text-muted-foreground">Net salary</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>
                          {r.status}
                        </span>
                        {r.status === 'draft' && (
                          <button onClick={e => { e.stopPropagation(); markPaid(r.id); }}
                            className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                            <CreditCard className="w-3 h-3" /> Mark Paid
                          </button>
                        )}
                      </div>
                    </div>
                    {expandedPay === r.id && (
                      <div className="px-10 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-muted/10">
                        {[
                          { label: 'Basic Salary', val: r.basic_salary },
                          { label: 'Allowances', val: r.allowances },
                          { label: 'Deductions', val: -r.deductions },
                          { label: 'Bonus', val: r.bonus },
                        ].map(({ label, val }) => (
                          <div key={label}>
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className={`font-medium text-sm ${val < 0 ? 'text-red-500' : 'text-foreground'}`}>
                              {r.currency} {Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        ))}
                        {r.paid_at && <div className="col-span-full text-xs text-muted-foreground">Paid on {new Date(r.paid_at).toLocaleDateString()}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── LEAVES TAB ── */}
      {tab === 'leaves' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {leaveLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : leaves.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No leave requests yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-border bg-muted/30">
                  {['Employee','Type','Dates','Days','Reason','Status','Actions'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {leaves.map(l => (
                    <tr key={l.id} className="hover:bg-muted/20 transition">
                      <td className="px-4 py-3 font-medium text-sm text-foreground">{l.employee_name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{l.leave_type}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(l.start_date).toLocaleDateString()} – {new Date(l.end_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{l.days}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">{l.reason || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${leaveColors[l.status] || ''}`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {l.status === 'pending' && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => updateLeaveStatus(l.id, 'approved')}
                              className="p-1.5 rounded-lg hover:bg-green-100 text-muted-foreground hover:text-green-600 transition" title="Approve">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button onClick={() => updateLeaveStatus(l.id, 'rejected')}
                              className="p-1.5 rounded-lg hover:bg-red-100 text-muted-foreground hover:text-red-600 transition" title="Reject">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {l.status !== 'pending' && <Clock className="w-4 h-4 text-muted-foreground/30" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── EMPLOYEE MODAL ── */}
      {empModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">{editEmp ? 'Edit Employee' : 'Add Employee'}</h2>
              <button onClick={() => setEmpModal(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Full Name *</label>
                  <input value={empForm.full_name} onChange={e => setEmpForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="Jane Smith"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" />
                </div>
                {[
                  { key: 'position', label: 'Position', placeholder: 'Sales Manager' },
                  { key: 'department', label: 'Department', placeholder: 'Sales' },
                  { key: 'email', label: 'Email', placeholder: 'jane@example.com' },
                  { key: 'phone', label: 'Phone', placeholder: '+971 50 000 0000' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
                    <input value={(empForm as any)[key]} onChange={e => setEmpForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Join Date</label>
                  <input type="date" value={empForm.join_date} onChange={e => setEmpForm(f => ({ ...f, join_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Basic Salary</label>
                  <input type="number" min="0" value={empForm.basic_salary}
                    onChange={e => setEmpForm(f => ({ ...f, basic_salary: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Allowances</label>
                  <input type="number" min="0" value={empForm.allowances}
                    onChange={e => setEmpForm(f => ({ ...f, allowances: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Employment Type</label>
                  <select value={empForm.employment_type} onChange={e => setEmpForm(f => ({ ...f, employment_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground">
                    <option value="full_time">Full Time</option>
                    <option value="part_time">Part Time</option>
                    <option value="contract">Contract</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Currency</label>
                  <select value={empForm.currency} onChange={e => setEmpForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground">
                    {['AED','USD','EUR','GBP','SAR','BHD','LKR','INR','PKR'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 pb-5">
              <button onClick={() => setEmpModal(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted">Cancel</button>
              <button onClick={saveEmployee} disabled={empSaving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                {empSaving ? 'Saving...' : (editEmp ? 'Update' : 'Add Employee')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LEAVE MODAL ── */}
      {leaveModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">New Leave Request</h2>
              <button onClick={() => setLeaveModal(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Employee *</label>
                <select value={leaveForm.employee_id} onChange={e => setLeaveForm(f => ({ ...f, employee_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground">
                  <option value="">Select employee</option>
                  {employees.filter(e => e.status === 'active').map(e => (
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Leave Type</label>
                <select value={leaveForm.leave_type} onChange={e => setLeaveForm(f => ({ ...f, leave_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground">
                  <option value="annual">Annual</option>
                  <option value="sick">Sick</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Start Date *</label>
                  <input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">End Date *</label>
                  <input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Reason</label>
                <textarea value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                  rows={2} placeholder="Optional reason..."
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 pb-5">
              <button onClick={() => setLeaveModal(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted">Cancel</button>
              <button onClick={saveLeave} disabled={leaveSaving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                {leaveSaving ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
