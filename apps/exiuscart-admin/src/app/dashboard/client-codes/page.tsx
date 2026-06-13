'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Key, Plus, Copy, Trash2, ToggleLeft, ToggleRight, Check,
  X, ChevronDown, RefreshCw, Clock, Users, Mail,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

interface NexCode {
  id: number;
  code: string;
  client_email: string | null;
  plan_type: string;
  duration_months: number | null;
  max_uses: number;
  used_count: number;
  max_shops: number;
  is_active: boolean;
  notes: string | null;
  code_expires_at: string | null;
  created_at: string;
  is_used_up: boolean;
}

const PLAN_OPTIONS = ['premium', 'starter', 'free_trial', 'thedersi_basic'];

function StatusBadge({ code }: { code: NexCode }) {
  if (!code.is_active) return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">Deactivated</span>;
  if (code.is_used_up) return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">Used Up</span>;
  if (code.code_expires_at && new Date(code.code_expires_at) < new Date()) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">Expired</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Active</span>;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} title="Copy code" className="p-1.5 hover:bg-gray-700 rounded transition text-gray-400 hover:text-white">
      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

export default function ClientCodesPage() {
  const [codes, setCodes] = useState<NexCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);

  // Create form state
  const [form, setForm] = useState({
    client_email: '',
    plan_type: 'premium',
    duration_months: '',
    max_uses: '1',
    max_shops: '1',
    notes: '',
    code_expires_days: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newCode, setNewCode] = useState<NexCode | null>(null);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getNexCodes();
      setCodes(res.data);
    } catch {
      setCodes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      const res = await adminApi.createNexCode({
        client_email: form.client_email || undefined,
        plan_type: form.plan_type,
        duration_months: form.duration_months ? parseInt(form.duration_months) : null,
        max_uses: parseInt(form.max_uses) || 1,
        max_shops: parseInt(form.max_shops) || 1,
        notes: form.notes || undefined,
        code_expires_days: form.code_expires_days ? parseInt(form.code_expires_days) : null,
      });
      setNewCode(res.data);
      setCodes(prev => [res.data, ...prev]);
      setForm({ client_email: '', plan_type: 'premium', duration_months: '', max_uses: '1', max_shops: '1', notes: '', code_expires_days: '' });
    } catch (err: any) {
      setCreateError(err.response?.data?.detail || 'Failed to generate code');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (code: NexCode) => {
    setToggling(code.id);
    try {
      const res = await adminApi.toggleNexCode(code.id);
      setCodes(prev => prev.map(c => c.id === code.id ? { ...c, is_active: res.data.is_active } : c));
    } catch {/* no-op */}
    setToggling(null);
  };

  const handleDelete = async (codeId: number) => {
    setDeleting(codeId);
    try {
      await adminApi.deleteNexCode(codeId);
      setCodes(prev => prev.filter(c => c.id !== codeId));
    } catch {/* no-op */}
    setDeleting(null);
  };

  const activeCodes = codes.filter(c => c.is_active && !c.is_used_up);
  const usedCodes = codes.filter(c => c.is_used_up);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Client Codes</h1>
          <p className="text-gray-400 text-sm mt-1">Generate NexCode Nova one-time activation codes for clients</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchCodes} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition">
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setShowCreate(!showCreate); setNewCode(null); setCreateError(''); }}
            className="inline-flex items-center gap-2 bg-[#6B3FD9] text-white px-4 py-2 rounded-lg hover:bg-[#5a35b8] transition font-medium"
          >
            <Plus className="w-4 h-4" /> Generate Code
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-xs mb-1">Total Codes</p>
          <p className="text-2xl font-bold text-white">{codes.length}</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-xs mb-1">Active</p>
          <p className="text-2xl font-bold text-green-400">{activeCodes.length}</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-gray-400 text-xs mb-1">Used</p>
          <p className="text-2xl font-bold text-blue-400">{usedCodes.length}</p>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Key className="w-5 h-5 text-[#6B3FD9]" /> Generate New Code
          </h2>

          {/* New code display */}
          {newCode && (
            <div className="mb-5 bg-[#6B3FD9]/10 border border-[#6B3FD9]/30 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Code generated successfully</p>
              <div className="flex items-center gap-3">
                <code className="text-2xl font-mono font-bold text-[#6B3FD9] tracking-widest">{newCode.code}</code>
                <CopyButton value={newCode.code} />
              </div>
              {newCode.client_email && <p className="text-xs text-gray-400 mt-1">For: {newCode.client_email}</p>}
            </div>
          )}

          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Client Email</label>
              <input
                type="email"
                value={form.client_email}
                onChange={e => setForm({ ...form, client_email: e.target.value })}
                placeholder="client@example.com"
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Plan</label>
              <div className="relative">
                <select
                  value={form.plan_type}
                  onChange={e => setForm({ ...form, plan_type: e.target.value })}
                  className="appearance-none w-full px-3 py-2.5 pr-8 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#6B3FD9] outline-none"
                >
                  {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Duration (months, blank = lifetime)</label>
              <input
                type="number"
                min="1"
                value={form.duration_months}
                onChange={e => setForm({ ...form, duration_months: e.target.value })}
                placeholder="e.g. 12"
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Max Stores</label>
              <input
                type="number"
                min="1"
                value={form.max_shops}
                onChange={e => setForm({ ...form, max_shops: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#6B3FD9] outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Max Uses</label>
              <input
                type="number"
                min="1"
                value={form.max_uses}
                onChange={e => setForm({ ...form, max_uses: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#6B3FD9] outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Code expires in (days, blank = never)</label>
              <input
                type="number"
                min="1"
                value={form.code_expires_days}
                onChange={e => setForm({ ...form, code_expires_days: e.target.value })}
                placeholder="e.g. 30"
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm text-gray-400 mb-1.5">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g. Ahmed — 450 package, 6-month deal"
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] outline-none"
              />
            </div>

            {createError && (
              <div className="sm:col-span-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-400">{createError}</div>
            )}

            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={creating} className="px-5 py-2.5 bg-[#6B3FD9] text-white rounded-lg hover:bg-[#5a35b8] transition font-medium disabled:opacity-50 flex items-center gap-2">
                <Key className="w-4 h-4" />
                {creating ? 'Generating...' : 'Generate Code'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-5 py-2.5 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Codes List */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-800 rounded-lg animate-pulse" />)}
          </div>
        ) : codes.length === 0 ? (
          <div className="p-16 text-center">
            <Key className="w-14 h-14 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No codes yet. Generate one for a client.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Code</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium hidden sm:table-cell">Client</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Plan</th>
                  <th className="text-center px-5 py-3 text-xs text-gray-400 font-medium hidden md:table-cell">Uses</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium hidden lg:table-cell">Notes</th>
                  <th className="text-center px-5 py-3 text-xs text-gray-400 font-medium">Status</th>
                  <th className="text-center px-5 py-3 text-xs text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {codes.map(code => (
                  <tr key={code.id} className="hover:bg-gray-800/30 transition">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono font-bold text-[#6B3FD9] tracking-wide">{code.code}</code>
                        <CopyButton value={code.code} />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{new Date(code.created_at).toLocaleDateString()}</p>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      {code.client_email
                        ? <span className="text-sm text-gray-300 flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-gray-500" />{code.client_email}</span>
                        : <span className="text-xs text-gray-500">Any email</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div>
                        <span className="text-sm text-white capitalize">{code.plan_type}</span>
                        <p className="text-xs text-gray-500">
                          {code.duration_months ? `${code.duration_months}mo` : 'Lifetime'} · {code.max_shops} store{code.max_shops > 1 ? 's' : ''}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center hidden md:table-cell">
                      <span className={`text-sm font-medium ${code.is_used_up ? 'text-blue-400' : 'text-gray-300'}`}>
                        {code.used_count}/{code.max_uses}
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <span className="text-xs text-gray-400">{code.notes || '—'}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <StatusBadge code={code} />
                      {code.code_expires_at && (
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(code.code_expires_at).toLocaleDateString()}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleToggle(code)}
                          disabled={toggling === code.id}
                          title={code.is_active ? 'Deactivate' : 'Activate'}
                          className="p-1.5 hover:bg-gray-700 rounded transition text-gray-400 hover:text-white"
                        >
                          {code.is_active
                            ? <ToggleRight className="w-5 h-5 text-green-400" />
                            : <ToggleLeft className="w-5 h-5 text-gray-500" />}
                        </button>
                        <button
                          onClick={() => handleDelete(code.id)}
                          disabled={deleting === code.id}
                          title="Delete"
                          className="p-1.5 hover:bg-red-500/10 rounded transition text-gray-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
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
    </div>
  );
}
