'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, Plus, Phone, Mail, Edit, Trash2,
  UserPlus, X, Loader2,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

interface Lead {
  id: number;
  name: string;
  shop_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  business_type: string | null;
  notes: string | null;
  status: string;
  source: string;
  created_at: string;
}

const STATUS_OPTIONS = ['new', 'contacted', 'demo', 'converted', 'lost'];
const SOURCE_OPTIONS = ['manual', 'website', 'whatsapp', 'referral'];

const statusStyles: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-400',
  contacted: 'bg-[#6B3FD9]/10 text-[#6B3FD9]',
  demo: 'bg-purple-500/10 text-purple-400',
  converted: 'bg-green-500/10 text-green-400',
  lost: 'bg-red-500/10 text-red-400',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getLeads({
        search: searchQuery || undefined,
        status_filter: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setLeads(res.data ?? []);
    } catch {
      setLeads([]);
    }
    setLoading(false);
  }, [searchQuery, statusFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleDelete = async (id: number) => {
    try {
      await adminApi.deleteLead(id);
      setLeads((prev) => prev.filter((l) => l.id !== id));
    } catch {/* no-op */}
    setDeleteConfirm(null);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="text-gray-400 text-sm mt-1">Track potential customers</p>
        </div>
        <button
          type="button"
          onClick={() => { setEditingLead(null); setShowModal(true); }}
          className="inline-flex items-center justify-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-black font-semibold px-4 py-2.5 rounded-lg transition"
        >
          <Plus className="w-5 h-5" /> Add Lead
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-6">
        {STATUS_OPTIONS.map((s) => (
          <div key={s} className="bg-[#151F32] rounded-xl border border-gray-800 p-3 text-center">
            <p className="text-2xl font-bold text-white">{leads.filter((l) => l.status === s).length}</p>
            <p className="text-xs text-gray-400 mt-1 capitalize">{s}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-[#151F32] rounded-xl border border-gray-800 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-9 pr-8 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white focus:border-[#6B3FD9] focus:outline-none transition appearance-none cursor-pointer"
            >
              <option value="all">All Status</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 text-[#6B3FD9] animate-spin" />
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-16 text-center">
          <UserPlus className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">No leads yet</p>
          <button
            type="button"
            onClick={() => { setEditingLead(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-black font-semibold px-4 py-2 rounded-lg transition text-sm"
          >
            <Plus className="w-4 h-4" /> Add First Lead
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <div key={lead.id} className="bg-[#151F32] rounded-xl border border-gray-800 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-medium text-white">{lead.name}</p>
                    {lead.shop_name && <p className="text-sm text-gray-400">· {lead.shop_name}</p>}
                    {lead.business_type && (
                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{lead.business_type}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mt-1">
                    {lead.phone && (
                      <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{lead.phone}</span>
                    )}
                    {lead.email && (
                      <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{lead.email}</span>
                    )}
                    {lead.city && <span>{lead.city}</span>}
                  </div>
                  {lead.notes && <p className="text-xs text-gray-500 mt-2 line-clamp-1">{lead.notes}</p>}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`text-xs px-2.5 py-1 rounded-lg capitalize ${statusStyles[lead.status] ?? 'bg-gray-500/10 text-gray-400'}`}>
                    {lead.status}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => { setEditingLead(lead); setShowModal(true); }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(lead.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <LeadModal
          lead={editingLead}
          onClose={() => { setShowModal(false); setEditingLead(null); }}
          onSaved={() => { setShowModal(false); setEditingLead(null); fetchLeads(); }}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#151F32] rounded-xl border border-gray-800 p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Lead?</h3>
            <p className="text-sm text-gray-400 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-white hover:bg-gray-800 transition">Cancel</button>
              <button type="button" onClick={() => handleDelete(deleteConfirm)} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Lead Modal ───────────────────────────────────────────────────────────────

function LeadModal({ lead, onClose, onSaved }: {
  lead: Lead | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: lead?.name ?? '',
    shop_name: lead?.shop_name ?? '',
    phone: lead?.phone ?? '',
    email: lead?.email ?? '',
    city: lead?.city ?? '',
    business_type: lead?.business_type ?? '',
    notes: lead?.notes ?? '',
    status: lead?.status ?? 'new',
    source: lead?.source ?? 'manual',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (lead) {
        await adminApi.updateLead(lead.id, form);
      } else {
        await adminApi.createLead(form);
      }
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Failed to save lead.');
      setSaving(false);
    }
  };

  const set = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#151F32] rounded-xl border border-gray-800 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-800 sticky top-0 bg-[#151F32]">
          <h2 className="text-lg font-semibold text-white">{lead ? 'Edit Lead' : 'Add Lead'}</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm text-gray-400 mb-1.5 block">Name *</label>
              <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} required
                className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg focus:border-[#6B3FD9] outline-none text-white" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Store Name</label>
              <input type="text" value={form.shop_name} onChange={(e) => set('shop_name', e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg focus:border-[#6B3FD9] outline-none text-white" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Business Type</label>
              <input type="text" value={form.business_type} onChange={(e) => set('business_type', e.target.value)}
                placeholder="e.g. Mobile, Grocery"
                className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg focus:border-[#6B3FD9] outline-none text-white" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Phone</label>
              <input type="text" value={form.phone} onChange={(e) => set('phone', e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg focus:border-[#6B3FD9] outline-none text-white" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Email</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg focus:border-[#6B3FD9] outline-none text-white" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">City</label>
              <input type="text" value={form.city} onChange={(e) => set('city', e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg focus:border-[#6B3FD9] outline-none text-white" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg focus:border-[#6B3FD9] outline-none text-white">
                {STATUS_OPTIONS.map((s) => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Source</label>
              <select value={form.source} onChange={(e) => set('source', e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg focus:border-[#6B3FD9] outline-none text-white">
                {SOURCE_OPTIONS.map((s) => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-sm text-gray-400 mb-1.5 block">Notes</label>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
                className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg focus:border-[#6B3FD9] outline-none text-white resize-none" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 px-4 py-2.5 border border-gray-700 rounded-lg text-white hover:bg-gray-800 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 bg-[#6B3FD9] text-black font-semibold rounded-lg hover:bg-[#5A2EC9] transition disabled:opacity-50 inline-flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {lead ? 'Update' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

