'use client';

import { useState, useEffect } from 'react';
import {
  GitBranch, Plus, Edit2, Trash2, X, Loader2,
  MapPin, Phone, User, CheckCircle, Star,
} from 'lucide-react';
import { branchApi } from '@/lib/api';

interface Branch {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  manager_name?: string;
  manager_email?: string;
  notes?: string;
  is_main: boolean;
  is_active: boolean;
}

const emptyForm = {
  name: '', address: '', phone: '', manager_name: '', manager_email: '', notes: '',
};

export default function BranchesPage() {
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (!shopId) { setLoading(false); return; }
    branchApi.getAll(shopId)
      .then(r => setBranches(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shopId]);

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm });
    setModal(true);
  }

  function openEdit(b: Branch) {
    setEditing(b);
    setForm({
      name: b.name, address: b.address ?? '', phone: b.phone ?? '',
      manager_name: b.manager_name ?? '', manager_email: b.manager_email ?? '',
      notes: b.notes ?? '',
    });
    setModal(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editing) {
        const res = await branchApi.update(shopId, editing.id, form);
        setBranches(prev => prev.map(b => b.id === editing.id ? res.data : b));
        showToast('Branch updated', 'success');
      } else {
        const res = await branchApi.create(shopId, form);
        setBranches(prev => [...prev, res.data]);
        showToast('Branch created', 'success');
      }
      setModal(false);
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteBranch(b: Branch) {
    if (b.is_main) return;
    if (!confirm(`Delete branch "${b.name}"? This cannot be undone.`)) return;
    try {
      await branchApi.delete(shopId, b.id);
      setBranches(prev => prev.filter(x => x.id !== b.id));
      showToast('Branch deleted', 'success');
    } catch {
      showToast('Failed to delete', 'error');
    }
  }

  async function setMain(b: Branch) {
    if (b.is_main) return;
    try {
      await branchApi.setMain(shopId, b.id);
      setBranches(prev => prev.map(x => ({ ...x, is_main: x.id === b.id })));
      showToast(`"${b.name}" is now the main branch`, 'success');
    } catch {
      showToast('Failed', 'error');
    }
  }

  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />)}
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
          <h1 className="text-2xl font-bold text-foreground">Branches</h1>
          <p className="text-muted-foreground text-sm">Manage your store locations</p>
        </div>
        <button type="button" onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
          <Plus className="w-4 h-4" /> Add Branch
        </button>
      </div>

      {branches.length === 0 ? (
        <div className="py-24 text-center bg-card border border-border rounded-2xl">
          <GitBranch className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-30" />
          <h3 className="font-semibold text-foreground mb-1">No branches yet</h3>
          <p className="text-muted-foreground text-sm mb-5">Add your first branch location to get started.</p>
          <button type="button" onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
            <Plus className="w-4 h-4" /> Add your first branch location
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map(b => (
            <div key={b.id} className={`bg-card border rounded-xl p-5 space-y-4 ${b.is_main ? 'border-primary/40' : 'border-border'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground">{b.name}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {b.is_main && (
                      <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium flex items-center gap-1">
                        <Star className="w-3 h-3" /> Main
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.is_active ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                      {b.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => openEdit(b)}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => deleteBranch(b)} disabled={b.is_main}
                    className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {b.address && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{b.address}</span>
                  </div>
                )}
                {b.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    <span>{b.phone}</span>
                  </div>
                )}
                {b.manager_name && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="w-4 h-4 flex-shrink-0" />
                    <span>{b.manager_name}</span>
                  </div>
                )}
              </div>

              {!b.is_main && (
                <button type="button" onClick={() => setMain(b)}
                  className="w-full py-2 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition">
                  Set as Main
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">{editing ? 'Edit Branch' : 'Add Branch'}</h2>
              <button type="button" onClick={() => setModal(false)} className="p-1.5 hover:bg-muted rounded-lg transition text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Branch Name *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Main Branch, Downtown, JLT"
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Address</label>
                <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2}
                  placeholder="Full address"
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Phone</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Manager Name</label>
                  <input type="text" value={form.manager_name} onChange={e => setForm(f => ({ ...f, manager_name: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Manager Email</label>
                <input type="email" value={form.manager_email} onChange={e => setForm(f => ({ ...f, manager_email: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button type="button" onClick={() => setModal(false)}
                className="flex-1 py-2.5 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={save} disabled={saving || !form.name}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editing ? 'Save Changes' : 'Add Branch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
