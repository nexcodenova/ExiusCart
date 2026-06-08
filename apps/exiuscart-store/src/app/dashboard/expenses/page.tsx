'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, Wallet, X, Trash2, ChevronDown } from 'lucide-react';
import { expensesApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  paymentMethod: string;
}

const EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Supplies', 'Marketing', 'Salary', 'Transport', 'Other'];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [formData, setFormData] = useState({ category: EXPENSE_CATEGORIES[0], description: '', amount: '', date: new Date().toISOString().split('T')[0], paymentMethod: 'cash' });
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
  const { fmt, sym } = useCurrency();

  const fetchExpenses = () => {
    if (!shopId) return;
    expensesApi.getAll(shopId)
      .then((res) => setExpenses(res.data ?? []))
      .catch(() => setExpenses([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchExpenses(); }, [shopId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await expensesApi.create(shopId, { ...formData, amount: Number(formData.amount) });
      fetchExpenses();
    } catch {}
    setShowAddModal(false);
    setFormData({ category: EXPENSE_CATEGORIES[0], description: '', amount: '', date: new Date().toISOString().split('T')[0], paymentMethod: 'cash' });
  };

  const handleDelete = async (id: string) => {
    try {
      await expensesApi.delete(shopId, id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch {}
  };

  const filtered = expenses.filter((e) => {
    const matchesSearch = e.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'All' || e.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const total = filtered.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
          <p className="text-muted-foreground text-sm">Track your business expenses</p>
        </div>
        <button type="button" onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition">
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Expenses</p>
          <p className="text-2xl font-bold text-foreground">{loading ? '—' : fmt(expenses.reduce((s,e)=>s+e.amount,0), 0)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Filtered Total</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{loading ? '—' : fmt(total, 0)}</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input type="text" placeholder="Search expenses..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground placeholder:text-muted-foreground" />
        </div>
        <div className="relative">
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} aria-label="Filter by category"
            className="appearance-none w-full sm:w-44 px-4 py-2.5 pr-10 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground">
            <option value="All">All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Wallet className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold text-foreground mb-1">{searchQuery || selectedCategory !== 'All' ? 'No expenses found' : 'No expenses recorded'}</h3>
            <p className="text-sm text-muted-foreground mb-5">{searchQuery || selectedCategory !== 'All' ? 'Try adjusting your filters' : 'Start tracking your business expenses'}</p>
            {!searchQuery && selectedCategory === 'All' && (
              <button type="button" onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
                <Plus className="w-4 h-4" /> Add First Expense
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">{expense.category}</span>
                    <span className="text-sm font-medium text-foreground">{expense.description}</span>
                  </div>
                  <div className="flex gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">{expense.date}</span>
                    <span className="text-xs text-muted-foreground capitalize">{expense.paymentMethod}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400">{fmt(expense.amount)}</span>
                  <button type="button" onClick={() => handleDelete(expense.id)} aria-label="Delete expense"
                    className="p-2 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Add Expense</h2>
              <button type="button" onClick={() => setShowAddModal(false)} aria-label="Close" className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAdd} className="p-4 space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Category *</label>
                <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} required
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground">
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Description *</label>
                <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required
                  placeholder="e.g. Shop rent January" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Amount ({sym}) *</label>
                  <input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required min="0"
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Date *</label>
                  <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground" />
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Payment Method</label>
                <select value={formData.paymentMethod} onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground">
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium">Add Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
