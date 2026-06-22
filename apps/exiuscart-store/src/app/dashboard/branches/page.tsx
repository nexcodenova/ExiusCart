'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Store, Plus, Edit, Trash2, X, Loader2,
  MapPin, Phone, Check, ArrowRight,
} from 'lucide-react';
import { shopApi } from '@/lib/api';

interface Branch {
  id: number;
  name: string;
  city?: string;
  address?: string;
  phone?: string;
  country: string;
  is_active: boolean;
}

const EMPTY_FORM = { name: '', city: '', address: '', phone: '', country: 'UAE' };

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [switchSuccess, setSwitchSuccess] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('shop_id');
      if (stored) setActiveBranchId(parseInt(stored));
    }
  }, []);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await shopApi.getAllBranches();
      setBranches(res.data ?? []);
    } catch {
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  const switchBranch = (branch: Branch) => {
    localStorage.setItem('shop_id', String(branch.id));
    setActiveBranchId(branch.id);
    setSwitchSuccess(`Switched to ${branch.name}`);
    setTimeout(() => setSwitchSuccess(''), 2500);
  };

  const openAdd = () => { setEditingBranch(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (b: Branch) => {
    setEditingBranch(b);
    setForm({ name: b.name, city: b.city || '', address: b.address || '', phone: b.phone || '', country: b.country });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingBranch) {
        await shopApi.updateBranch(editingBranch.id, form);
      } else {
        await shopApi.createBranch(form);
      }
      setShowModal(false);
      fetchBranches();
    } catch {/* no-op */}
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      await shopApi.deleteBranch(id);
      setBranches(prev => prev.filter(b => b.id !== id));
      // If deleting active branch, switch to first remaining
      if (activeBranchId === id) {
        const remaining = branches.filter(b => b.id !== id);
        if (remaining.length > 0) switchBranch(remaining[0]);
      }
    } catch {/* no-op */}
    setDeleteId(null);
  };

  const f = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Branches</h1>
          <p className="text-muted-foreground text-sm">Manage multiple store locations</p>
        </div>
        <button type="button" onClick={openAdd}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition">
          <Plus className="w-4 h-4" /> Add Branch
        </button>
      </div>

      {/* Switch success toast */}
      {switchSuccess && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex items-center gap-2">
          <Check className="w-4 h-4 text-green-500" />
          <p className="text-green-500 text-sm font-medium">{switchSuccess} — all pages now show data for this branch</p>
        </div>
      )}

      {/* Info banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
        <p className="text-sm text-foreground font-medium mb-1">How Multi-Branch Works</p>
        <p className="text-sm text-muted-foreground">
          Each branch is an independent store with its own products, inventory, orders, and staff.
          Switch between branches using the <strong>Switch</strong> button — the entire dashboard will update to show that branch&apos;s data.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Branches</p>
          <p className="text-2xl font-bold text-foreground">{loading ? '—' : branches.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Active Branch</p>
          <p className="text-lg font-bold text-primary truncate">
            {loading ? '—' : branches.find(b => b.id === activeBranchId)?.name || 'None'}
          </p>
        </div>
      </div>

      {/* Branch list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-card rounded-xl border border-border animate-pulse" />)}</div>
      ) : branches.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-16 text-center">
          <Store className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="font-semibold text-foreground mb-2">No branches yet</h3>
          <p className="text-sm text-muted-foreground mb-5">Your first branch is created automatically when you registered. Add more branches to manage multiple locations.</p>
          <button type="button" onClick={openAdd}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
            <Plus className="w-4 h-4" /> Add Branch
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {branches.map((branch) => {
            const isActive = branch.id === activeBranchId;
            return (
              <div
                key={branch.id}
                className={`bg-card rounded-xl border-2 p-5 transition ${isActive ? 'border-primary' : 'border-border'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-primary' : 'bg-muted'}`}>
                      <Store className={`w-6 h-6 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{branch.name}</h3>
                        {isActive && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                            Active
                          </span>
                        )}
                        {!branch.is_active && (
                          <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-medium">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-2">
                        {(branch.city || branch.address) && (
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="w-3.5 h-3.5" />
                            {branch.city || branch.address}
                          </span>
                        )}
                        {branch.phone && (
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="w-3.5 h-3.5" />
                            {branch.phone}
                          </span>
                        )}
                        <span className="text-sm text-muted-foreground">Branch ID: {branch.id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => switchBranch(branch)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition"
                      >
                        Switch <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button type="button" onClick={() => openEdit(branch)}
                      className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
                      <Edit className="w-4 h-4" />
                    </button>
                    {branches.length > 1 && (
                      <button type="button" onClick={() => setDeleteId(branch.id)}
                        className="p-2 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-400 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-md">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {editingBranch ? 'Edit Branch' : 'Add New Branch'}
              </h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {[
                { key: 'name' as const, label: 'Branch Name *', placeholder: 'e.g., Main Branch - City Center' },
                { key: 'city' as const, label: 'City', placeholder: 'e.g., Colombo' },
                { key: 'address' as const, label: 'Address', placeholder: 'Shop 101, Level 1...' },
                { key: 'phone' as const, label: 'Phone', placeholder: '+XX X XXX XXXX' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-sm text-muted-foreground mb-1 block">{label}</label>
                  <input type="text" value={form[key]} onChange={f(key)} placeholder={placeholder}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none" />
                </div>
              ))}
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Country</label>
                <select value={form.country} onChange={f('country')}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none">
                  <option value="UAE">UAE</option>
                  <option value="Saudi Arabia">Saudi Arabia</option>
                  <option value="Bahrain">Bahrain</option>
                  <option value="Oman">Oman</option>
                  <option value="Kuwait">Kuwait</option>
                  <option value="Qatar">Qatar</option>
                  <option value="Sri Lanka">Sri Lanka</option>
                  <option value="India">India</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-border flex gap-3">
              <button type="button" onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.name.trim()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingBranch ? 'Save Changes' : 'Create Branch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete Branch?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              This will permanently delete this branch and all its data including products, orders, and customers. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteId(null)} className="flex-1 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={() => handleDelete(deleteId)} className="flex-1 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition">Delete Branch</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
