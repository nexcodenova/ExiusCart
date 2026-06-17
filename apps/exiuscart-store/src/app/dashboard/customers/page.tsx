'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, User, Phone, Mail, MapPin, Edit, Trash2, X, Users, ShoppingBag, Star } from 'lucide-react';
import { customersApi } from '@/lib/api';

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

  const vipCount = customers.filter((c) => c.isVip).length;
  const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customers</h1>
          <p className="text-muted-foreground text-sm">Manage your customer database</p>
        </div>
        <button
          type="button"
          onClick={() => { setEditingCustomer(null); setShowAddModal(true); }}
          className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition"
        >
          <Plus className="w-5 h-5" /> Add Customer
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-muted-foreground text-xs mb-1">Total Customers</p>
          <p className="text-2xl font-bold text-foreground">{loading ? '—' : customers.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-muted-foreground text-xs mb-1">VIP Customers</p>
          <p className="text-2xl font-bold text-yellow-500">{loading ? '—' : vipCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-muted-foreground text-xs mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-foreground">{loading ? '—' : `${totalRevenue.toLocaleString()} AED`}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-muted-foreground text-xs mb-1">Avg. Spent</p>
          <p className="text-2xl font-bold text-foreground">{loading || customers.length === 0 ? '—' : `${Math.round(totalRevenue / customers.length).toLocaleString()} AED`}</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, phone, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
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
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition"
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
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-primary">{customer.name.charAt(0).toUpperCase()}</span>
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
                      <span className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{customer.totalSpent.toLocaleString()} AED</span> spent</span>
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
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g. Ahmad Ali" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Phone</label>
            <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+971 50 123 4567" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Email</label>
            <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@example.com" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Address</label>
            <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="e.g. Dubai Marina, Dubai" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium">{customer ? 'Update' : 'Add Customer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
