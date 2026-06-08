'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, Shield, Users, X, Trash2, Crown, ChevronDown } from 'lucide-react';
import { staffApi } from '@/lib/api';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  status: 'active' | 'inactive';
  lastActive?: string;
}

const ROLES = [
  { id: 'admin', label: 'Admin', description: 'Full access to all features' },
  { id: 'staff', label: 'Staff', description: 'POS, Orders, Products, Inventory, Customers' },
];

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [inviteData, setInviteData] = useState({ email: '', role: 'staff' });
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  const fetchStaff = () => {
    if (!shopId) return;
    staffApi.getAll(shopId)
      .then((res) => setStaff(res.data ?? []))
      .catch(() => setStaff([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStaff(); }, [shopId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await staffApi.invite(shopId, inviteData);
      fetchStaff();
    } catch {}
    setShowAddModal(false);
    setInviteData({ email: '', role: 'staff' });
  };

  const handleRemove = async (id: string) => {
    try {
      await staffApi.remove(shopId, id);
      setStaff((prev) => prev.filter((s) => s.id !== id));
    } catch {}
  };

  const filtered = staff.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || s.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Staff & Roles</h1>
          <p className="text-muted-foreground text-sm">Manage team members and their access</p>
        </div>
        <button type="button" onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition">
          <Plus className="w-4 h-4" /> Invite Staff
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Staff</p>
          <p className="text-2xl font-bold text-foreground">{loading ? '—' : staff.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Admins</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{loading ? '—' : staff.filter(s=>s.role==='admin').length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Staff Members</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{loading ? '—' : staff.filter(s=>s.role==='staff').length}</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input type="text" placeholder="Search staff..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground placeholder:text-muted-foreground" />
        </div>
        <div className="relative">
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by role"
            className="appearance-none w-full sm:w-40 px-4 py-2.5 pr-10 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground">
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Users className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold text-foreground mb-1">{searchQuery || roleFilter !== 'all' ? 'No staff found' : 'No staff members yet'}</h3>
            <p className="text-sm text-muted-foreground mb-5">{searchQuery || roleFilter !== 'all' ? 'Try a different search' : 'Invite your first team member to get started'}</p>
            {!searchQuery && roleFilter === 'all' && (
              <button type="button" onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
                <Plus className="w-4 h-4" /> Invite Staff
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((member) => (
              <div key={member.id} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-primary">{member.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground">{member.name}</h3>
                    {member.role === 'admin' && <Crown className="w-4 h-4 text-purple-500" />}
                  </div>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${member.role === 'admin' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                    {member.role}
                  </span>
                  <button type="button" onClick={() => handleRemove(member.id)} aria-label={`Remove ${member.name}`}
                    className="p-2 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Roles Info */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Shield className="w-5 h-5" /> Role Permissions</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {ROLES.map((role) => (
            <div key={role.id} className={`p-4 rounded-lg border ${role.id === 'admin' ? 'border-purple-500/30 bg-purple-500/5' : 'border-blue-500/30 bg-blue-500/5'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Crown className={`w-4 h-4 ${role.id === 'admin' ? 'text-purple-500' : 'text-blue-500'}`} />
                <span className="font-medium text-foreground">{role.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{role.description}</p>
            </div>
          ))}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Invite Staff Member</h2>
              <button type="button" onClick={() => setShowAddModal(false)} aria-label="Close" className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleInvite} className="p-4 space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Email Address *</label>
                <input type="email" value={inviteData.email} onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })} required
                  placeholder="staff@yourshop.com" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Role *</label>
                <select value={inviteData.role} onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground">
                  <option value="staff">Staff — Limited Access</option>
                  <option value="admin">Admin — Full Access</option>
                </select>
              </div>
              <p className="text-xs text-muted-foreground">An invitation email will be sent to this address.</p>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium">Send Invite</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
