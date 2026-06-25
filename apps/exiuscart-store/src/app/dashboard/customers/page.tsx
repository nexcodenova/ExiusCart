'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Phone, Mail, MapPin, Edit, Trash2, X, Users, Star, Wallet, TrendingUp } from 'lucide-react';
import { customersApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrder?: string;
  joinedDate: string;
  isVip?: boolean;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  const fetchCustomers = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const res = await customersApi.getAll(shopId, { search: searchQuery || undefined });
      setCustomers(res.data);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [shopId, searchQuery]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const handleDelete = async (id: string) => {
    try {
      await customersApi.delete(shopId, id);
      setCustomers((prev) => prev.filter((c) => c.id !== id));
    } catch {}
    setShowDeleteConfirm(null);
  };

  const handleSave = async (data: Omit<Customer, 'id' | 'totalOrders' | 'totalSpent' | 'joinedDate'>) => {
    try {
      if (editingCustomer) {
        await customersApi.update(shopId, editingCustomer.id, data);
      } else {
        await customersApi.create(shopId, data);
      }
      fetchCustomers();
    } catch {}
    setShowAddModal(false);
    setEditingCustomer(null);
  };

  const { sym } = useCurrency();
  const vipCount = customers.filter((c) => c.isVip).length;
  const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground">Manage your customer database</p>
        </div>
        <button
          type="button"
          onClick={() => { setEditingCustomer(null); setShowAddModal(true); }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add customer
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total customers', icon: Users, value: loading ? '—' : String(customers.length) },
          { label: 'VIP customers', icon: Star, value: loading ? '—' : String(vipCount) },
          { label: 'Total revenue', icon: Wallet, value: loading ? '—' : `${totalRevenue.toLocaleString()} ${sym}` },
          { label: 'Avg. spent', icon: TrendingUp, value: loading || customers.length === 0 ? '—' : `${Math.round(totalRevenue / customers.length).toLocaleString()} ${sym}` },
        ].map(({ label, icon: Icon, value }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><Icon className="h-5 w-5 text-foreground/70" /></div>
            <p className="mt-4 text-sm text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-2xl font-bold tracking-tight tabular-nums text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name, phone, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-border bg-card py-2.5 pl-11 pr-4 text-foreground outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-foreground/10"
        />
      </div>

      {/* List */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : customers.length === 0 ? (
          <div className="p-16 text-center">
            <Users className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold text-foreground mb-1">
              {searchQuery ? 'No customers found' : 'No customers yet'}
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              {searchQuery ? 'Try a different search term' : 'Customers are added automatically when you create orders, or add them manually'}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => { setEditingCustomer(null); setShowAddModal(true); }}
                className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
              >
                <Plus className="w-4 h-4" /> Add First Customer
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {customers.map((customer) => (
              <div key={customer.id} className="p-4 hover:bg-muted/30 transition">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-foreground">{customer.name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{customer.name}</h3>
                      {customer.isVip && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                      {customer.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{customer.phone}</span>}
                      {customer.email && <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{customer.email}</span>}
                      {customer.address && <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{customer.address}</span>}
                    </div>
                    <div className="flex gap-4 mt-2">
                      <span className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{customer.totalOrders}</span> orders</span>
                      <span className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{customer.totalSpent.toLocaleString()} {sym}</span> spent</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => { setEditingCustomer(customer); setShowAddModal(true); }} aria-label={`Edit ${customer.name}`} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => setShowDeleteConfirm(customer.id)} aria-label={`Delete ${customer.name}`} className="p-2 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <CustomerModal
          customer={editingCustomer}
          onClose={() => { setShowAddModal(false); setEditingCustomer(null); }}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete Customer?</h3>
            <p className="text-sm text-muted-foreground mb-6">Their order history will be preserved, but the customer record will be removed.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={() => handleDelete(showDeleteConfirm)} className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerModal({ customer, onClose, onSave }: {
  customer: Customer | null;
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    address: customer?.address ?? '',
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{customer ? 'Edit Customer' : 'Add Customer'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="p-4 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Full Name *</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g. Ahmad Ali" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Phone</label>
            <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+XX XXX XXXX XXXX" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Email</label>
            <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@example.com" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Address</label>
            <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="e.g. City, Province" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg hover:opacity-90 transition font-medium">{customer ? 'Update' : 'Add Customer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
