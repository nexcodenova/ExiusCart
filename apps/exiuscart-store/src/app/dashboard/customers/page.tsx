'use client';

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import Link from 'next/link';
import {
  Search, Plus, Phone, Mail, MapPin, Edit, Trash2, X, Users, Wallet, TrendingUp, TrendingDown,
  Crown, Sparkles, RefreshCcw, Ban, Copy, Check, ChevronLeft, ChevronRight, MoreHorizontal,
  Upload, Download, Eye, SlidersHorizontal, Loader2, ShoppingCart, ExternalLink,
} from 'lucide-react';
import { customersApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { flagEmoji } from '@/lib/country-flag';

// Matches app/core/country_utils.py's COUNTRY_NAME_TO_ISO on the backend —
// the small set of countries ExiusCart's channel/country-gated features
// already recognize by code, not an exhaustive world list.
const COUNTRIES: { code: string; name: string }[] = [
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'IN', name: 'India' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'NP', name: 'Nepal' },
  { code: 'MM', name: 'Myanmar' },
];

type CustomerStatus = 'vip' | 'new' | 'returning' | 'inactive';

interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  notes?: string | null;
  tags: string[];
  source?: string | null;
  isActive: boolean;
  totalOrders: number;
  totalSpent: number;
  lastOrder?: string | null;
  joinedDate?: string | null;
  isVip: boolean;
  status: CustomerStatus;
}

interface CustomerSnapshot { total: number; vip: number; revenue: number; avg_spent: number }
interface CustomerStats {
  now: CustomerSnapshot;
  prior: CustomerSnapshot;
  changes: { total_customers: number | null; vip_customers: number | null; total_revenue: number | null; avg_spent: number | null };
  daily: { date: string; new_customers: number; revenue: number }[];
}

const STATUS_META: Record<CustomerStatus, { label: string; icon: React.ElementType; className: string }> = {
  vip: { label: 'VIP', icon: Crown, className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  new: { label: 'New', icon: Sparkles, className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  returning: { label: 'Returning', icon: RefreshCcw, className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  inactive: { label: 'Inactive', icon: Ban, className: 'bg-muted text-muted-foreground' },
};

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Added manually', signup: 'Storefront signup', custom: 'Custom Website checkout',
  pos: 'Point of Sale', shopify: 'Shopify', gumroad: 'Gumroad', whop: 'Whop',
};

function sourceLabel(s: string): string {
  return SOURCE_LABELS[s] ?? s.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function customerIdLabel(id: number): string {
  return `#CUS-${String(id).padStart(6, '0')}`;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgoShort(iso?: string | null): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  return formatDate(iso);
}

function csvEscape(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function pageWindow(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = Array.from(pages).filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | '…')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push('…');
    result.push(p);
    prev = p;
  }
  return result;
}

// ── Small building blocks ────────────────────────────────────────────────────

function Sparkline({ data, colorClass }: { data: number[]; colorClass: string }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[2px] h-9 w-20 shrink-0">
      {data.map((v, i) => (
        <div key={i} className={`flex-1 min-w-[2px] rounded-t-[1px] ${colorClass}`} style={{ height: `${Math.max(14, (v / max) * 100)}%` }} />
      ))}
    </div>
  );
}

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-[11px] text-muted-foreground">No prior data</span>;
  if (pct === 0) return <span className="text-[11px] text-muted-foreground">No change</span>;
  const up = pct > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${up ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
      <Icon className="w-3 h-3" /> {up ? '+' : ''}{pct}%
    </span>
  );
}

function KpiCard({ icon: Icon, iconClass, label, value, changePct, sparkData, sparkClass }: {
  icon: React.ElementType; iconClass: string; label: string; value: string; changePct: number | null;
  sparkData?: number[]; sparkClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold leading-tight tracking-tight tabular-nums text-foreground">{value}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <TrendBadge pct={changePct} />
            {changePct !== null && <span className="text-[11px] text-muted-foreground">vs last month</span>}
          </div>
        </div>
      </div>
      {sparkData && sparkData.length > 0 && <Sparkline data={sparkData} colorClass={sparkClass ?? 'bg-primary/40'} />}
    </div>
  );
}

function StatusBadge({ status }: { status: CustomerStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold ${meta.className}`}>
      <Icon className="w-3 h-3" /> {meta.label}
    </span>
  );
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
      }}
      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition shrink-0"
      aria-label="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Detail panel ─────────────────────────────────────────────────────────────

function CustomerDetailPanel({ customer, onClose, onUpdated, onEdit, onDelete }: {
  customer: Customer;
  onClose: () => void;
  onUpdated: (patch: Partial<Customer>) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { fmt } = useCurrency();
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
  const [notesDraft, setNotesDraft] = useState(customer.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [addingTag, setAddingTag] = useState(false);

  useEffect(() => { setNotesDraft(customer.notes ?? ''); }, [customer.id, customer.notes]);

  const avgOrder = customer.totalOrders > 0 ? customer.totalSpent / customer.totalOrders : 0;

  const saveNotes = async () => {
    if (notesDraft === (customer.notes ?? '')) return;
    setSavingNotes(true);
    try {
      await customersApi.update(shopId, customer.id, { notes: notesDraft });
      onUpdated({ notes: notesDraft });
    } catch {} finally { setSavingNotes(false); }
  };

  const removeTag = async (tag: string) => {
    const next = customer.tags.filter((t) => t !== tag);
    try {
      await customersApi.update(shopId, customer.id, { tags: next });
      onUpdated({ tags: next });
    } catch {}
  };

  const addTag = async () => {
    const tag = newTag.trim();
    if (!tag || customer.tags.includes(tag)) { setNewTag(''); setAddingTag(false); return; }
    const next = [...customer.tags, tag];
    try {
      await customersApi.update(shopId, customer.id, { tags: next });
      onUpdated({ tags: next });
    } catch {}
    setNewTag(''); setAddingTag(false);
  };

  return (
    <>
      {/* Backdrop — click to close. A real fixed-position drawer (not a flex
          sibling of the table) so it always renders fully inside the
          viewport: the table's own natural width plus a 360px inline column
          could exceed the viewport, and this app's global `overflow-x:
          hidden` safeguard (globals.css) would then silently clip it with
          no way to scroll to the rest — a fixed right-edge drawer can't run
          into that regardless of how wide the table gets. */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[400px] bg-card border-l border-border shadow-2xl flex flex-col">
      <div className="flex items-start justify-between p-5 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
            <span className="text-sm font-semibold text-foreground">{initials(customer.name)}</span>
          </div>
          <div className="min-w-0">
            {customer.isVip && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                <Crown className="w-3 h-3" /> VIP
              </span>
            )}
            <p className="font-semibold text-foreground leading-snug truncate">{customer.name}</p>
            <p className="text-xs text-muted-foreground">{customerIdLabel(customer.id)}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="overflow-y-auto flex-1 p-5 space-y-5">
        <p className="text-xs text-muted-foreground">Customer since {formatDate(customer.joinedDate)}</p>

        {/* Contact */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Contact</p>
          <div className="space-y-1.5">
            {customer.email && (
              <div className="flex items-center justify-between gap-2 text-sm">
                <a href={`mailto:${customer.email}`} className="flex items-center gap-2 text-foreground hover:text-primary transition min-w-0">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> <span className="truncate">{customer.email}</span>
                </a>
                <CopyField value={customer.email} />
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center justify-between gap-2 text-sm">
                <a href={`tel:${customer.phone}`} className="flex items-center gap-2 text-foreground hover:text-primary transition min-w-0">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> <span className="truncate">{customer.phone}</span>
                </a>
                <CopyField value={customer.phone} />
              </div>
            )}
            {customer.address && (
              <div className="flex items-start justify-between gap-2 text-sm">
                <span className="flex items-start gap-2 text-foreground min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" /> <span>{customer.address}{customer.city ? `, ${customer.city}` : ''}</span>
                </span>
                <CopyField value={`${customer.address}${customer.city ? `, ${customer.city}` : ''}`} />
              </div>
            )}
            {!customer.email && !customer.phone && !customer.address && (
              <p className="text-xs text-muted-foreground">No contact details on file.</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-[11px] text-muted-foreground">Total orders</p>
            <p className="text-base font-bold text-foreground tabular-nums">{customer.totalOrders}</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-[11px] text-muted-foreground">Total spent</p>
            <p className="text-base font-bold text-foreground tabular-nums">{fmt(customer.totalSpent, 0)}</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-[11px] text-muted-foreground">Avg. order value</p>
            <p className="text-base font-bold text-foreground tabular-nums">{fmt(avgOrder, 0)}</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-[11px] text-muted-foreground">Last order</p>
            <p className="text-sm font-bold text-foreground">{formatDate(customer.lastOrder)}</p>
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Customer tags</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {customer.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                {tag}
                <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`} className="hover:bg-primary/20 rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {addingTag ? (
              <input
                autoFocus
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') { setAddingTag(false); setNewTag(''); } }}
                onBlur={addTag}
                placeholder="Tag name…"
                className="w-24 px-2 py-1 text-xs rounded-full border border-border bg-background outline-none focus:ring-2 focus:ring-primary"
              />
            ) : (
              <button type="button" onClick={() => setAddingTag(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-border text-xs text-muted-foreground hover:bg-muted transition">
                <Plus className="w-3 h-3" /> Add tag
              </button>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Notes</p>
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={saveNotes}
            placeholder="Add a private note about this customer…"
            rows={3}
            className="w-full px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary resize-none text-foreground placeholder:text-muted-foreground"
          />
          {savingNotes && <p className="text-[11px] text-muted-foreground">Saving…</p>}
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-border space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/dashboard/orders?customer_id=${customer.id}&name=${encodeURIComponent(customer.name)}`}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted transition"
          >
            <ExternalLink className="w-3.5 h-3.5" /> View Orders
          </Link>
          {customer.email ? (
            <a href={`mailto:${customer.email}`}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted transition">
              <Mail className="w-3.5 h-3.5" /> Send Email
            </a>
          ) : (
            <button type="button" disabled
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-medium text-muted-foreground opacity-50 cursor-not-allowed">
              <Mail className="w-3.5 h-3.5" /> Send Email
            </button>
          )}
        </div>
        <button type="button" onClick={onEdit}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted transition">
          <Edit className="w-3.5 h-3.5" /> Edit Customer
        </button>
        <button type="button" onClick={onDelete}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-destructive/30 text-destructive rounded-lg text-xs font-medium hover:bg-destructive/10 transition">
          <Trash2 className="w-3.5 h-3.5" /> Delete Customer
        </button>
      </div>
      </div>
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'spent_desc', label: 'Highest spent' },
  { value: 'spent_asc', label: 'Lowest spent' },
  { value: 'orders_desc', label: 'Most orders' },
  { value: 'name_asc', label: 'Name A–Z' },
];

export default function CustomersPage() {
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';
  const { fmt } = useCurrency();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({ all: 0, vip: 0, new: 0, returning: 0, inactive: 0 });
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CustomerStats | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusTab, setStatusTab] = useState<'all' | CustomerStatus>('all');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Customer | Customer[] | null>(null);

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; failed: number; limitHit: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setSearchQuery(searchInput.trim()); setPage(1); }, 400);
  }, [searchInput]);

  const fetchCustomers = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const res = await customersApi.getAll(shopId, {
        search: searchQuery || undefined,
        source: sourceFilter || undefined,
        status: statusTab !== 'all' ? statusTab : undefined,
        sort: sortBy,
        skip: (page - 1) * rowsPerPage,
        limit: rowsPerPage,
      });
      setCustomers(res.data?.items ?? []);
      setTotal(res.data?.total ?? 0);
      setCounts(res.data?.counts ?? { all: 0, vip: 0, new: 0, returning: 0, inactive: 0 });
      setSources(res.data?.sources ?? []);
    } catch {
      setCustomers([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [shopId, searchQuery, sourceFilter, statusTab, sortBy, page, rowsPerPage]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const fetchStats = useCallback(() => {
    if (!shopId) return;
    customersApi.getStats(shopId).then((r) => setStats(r.data)).catch(() => setStats(null));
  }, [shopId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => { setPage(1); }, [sourceFilter, statusTab, sortBy, rowsPerPage]);
  useEffect(() => { setSelectedIds(new Set()); }, [customers]);

  const applyUpdateToState = (id: number, patch: Partial<Customer>) => {
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setSelectedCustomer((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  };

  const handleDelete = async (targets: Customer[]) => {
    try {
      await Promise.all(targets.map((c) => customersApi.delete(shopId, c.id)));
    } catch {}
    setShowDeleteConfirm(null);
    setSelectedCustomer((prev) => (prev && targets.some((t) => t.id === prev.id) ? null : prev));
    fetchCustomers(); fetchStats();
  };

  const handleSave = async (data: any) => {
    try {
      if (editingCustomer) {
        await customersApi.update(shopId, editingCustomer.id, data);
      } else {
        await customersApi.create(shopId, data);
      }
      fetchCustomers(); fetchStats();
    } catch {}
    setShowAddModal(false);
    setEditingCustomer(null);
  };

  const handleExport = async () => {
    if (!shopId) return;
    setExporting(true);
    try {
      const res = await customersApi.getAll(shopId, {
        search: searchQuery || undefined,
        source: sourceFilter || undefined,
        status: statusTab !== 'all' ? statusTab : undefined,
        sort: sortBy,
        limit: 1000,
      });
      const items: Customer[] = res.data?.items ?? [];
      const header = ['Customer ID', 'Name', 'Email', 'Phone', 'Address', 'City', 'Status', 'Total Orders', 'Total Spent', 'Last Order', 'Joined Date', 'Tags'];
      const rows = items.map((c) => [
        customerIdLabel(c.id), c.name, c.email ?? '', c.phone ?? '', c.address ?? '', c.city ?? '',
        STATUS_META[c.status].label, String(c.totalOrders), c.totalSpent.toFixed(2), c.lastOrder ?? '', c.joinedDate ?? '', c.tags.join('; '),
      ]);
      const csv = [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {} finally { setExporting(false); }
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !shopId) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) { setImportResult({ created: 0, failed: 0, limitHit: false }); return; }
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const idx = (name: string) => header.indexOf(name);
      const nameIdx = idx('name'); const emailIdx = idx('email'); const phoneIdx = idx('phone');
      const addressIdx = idx('address'); const cityIdx = idx('city');
      let created = 0, failed = 0, limitHit = false;
      for (const r of rows.slice(1)) {
        const name = nameIdx >= 0 ? r[nameIdx]?.trim() : '';
        if (!name) { failed++; continue; }
        try {
          await customersApi.create(shopId, {
            name,
            email: emailIdx >= 0 ? (r[emailIdx]?.trim() || undefined) : undefined,
            phone: phoneIdx >= 0 ? (r[phoneIdx]?.trim() || undefined) : undefined,
            address: addressIdx >= 0 ? (r[addressIdx]?.trim() || undefined) : undefined,
            city: cityIdx >= 0 ? (r[cityIdx]?.trim() || undefined) : undefined,
          });
          created++;
        } catch (err: any) {
          if (err?.response?.status === 429) { limitHit = true; break; }
          failed++;
        }
      }
      setImportResult({ created, failed, limitHit });
      fetchCustomers(); fetchStats();
    } finally {
      setImporting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === customers.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(customers.map((c) => c.id)));
  };
  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const rangeStart = total === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const rangeEnd = Math.min(page * rowsPerPage, total);

  const tabs: { key: 'all' | CustomerStatus; label: string }[] = [
    { key: 'all', label: 'All Customers' },
    { key: 'vip', label: 'VIP' },
    { key: 'new', label: 'New' },
    { key: 'returning', label: 'Returning' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground">Manage your customer database, view orders, and build stronger relationships</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".csv" hidden onChange={handleImportFile} />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={importing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3.5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition disabled:opacity-60">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import
          </button>
          <button type="button" onClick={handleExport} disabled={exporting}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3.5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition disabled:opacity-60">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export
          </button>
          <button
            type="button"
            onClick={() => { setEditingCustomer(null); setShowAddModal(true); }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add customer
          </button>
        </div>
      </div>

      {importResult && (
        <div className="flex items-center justify-between gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
          <p className="text-sm text-green-700 dark:text-green-400">
            Imported {importResult.created} customer{importResult.created === 1 ? '' : 's'}.
            {importResult.failed > 0 && ` ${importResult.failed} row${importResult.failed === 1 ? '' : 's'} skipped (missing name).`}
            {importResult.limitHit && ' Stopped — your plan’s customer limit was reached.'}
          </p>
          <button type="button" onClick={() => setImportResult(null)} className="p-1 hover:bg-green-500/20 rounded"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Users} iconClass="bg-blue-500/10 text-blue-600 dark:text-blue-400" label="Total customers"
          value={stats ? stats.now.total.toLocaleString() : '—'} changePct={stats?.changes.total_customers ?? null}
          sparkData={stats?.daily.map((d) => d.new_customers)} sparkClass="bg-blue-500/40" />
        <KpiCard icon={Crown} iconClass="bg-purple-500/10 text-purple-600 dark:text-purple-400" label="VIP customers"
          value={stats ? stats.now.vip.toLocaleString() : '—'} changePct={stats?.changes.vip_customers ?? null} />
        <KpiCard icon={Wallet} iconClass="bg-green-500/10 text-green-600 dark:text-green-400" label="Total revenue"
          value={stats ? fmt(stats.now.revenue, 0) : '—'} changePct={stats?.changes.total_revenue ?? null}
          sparkData={stats?.daily.map((d) => d.revenue)} sparkClass="bg-green-500/40" />
        <KpiCard icon={ShoppingCart} iconClass="bg-orange-500/10 text-orange-600 dark:text-orange-400" label="Avg. spent"
          value={stats ? fmt(stats.now.avg_spent, 0) : '—'} changePct={stats?.changes.avg_spent ?? null} />
      </div>

      <div className="space-y-4">
          {/* Search + filter + sort */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, email, phone, or customer ID…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-xl border border-border bg-card py-2.5 pl-11 pr-4 text-foreground outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-foreground/10"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition">
                  <SlidersHorizontal className="h-4 w-4" /> Filter
                  {(sourceFilter || statusTab === 'inactive') && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-4 space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Customer source</label>
                  <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary">
                    <option value="">All sources</option>
                    {sources.map((s) => <option key={s} value={s}>{sourceLabel(s)}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input type="checkbox" checked={statusTab === 'inactive'}
                    onChange={(e) => setStatusTab(e.target.checked ? 'inactive' : 'all')}
                    className="rounded border-border" />
                  Inactive customers only
                </label>
                {(sourceFilter || statusTab === 'inactive') && (
                  <button type="button" onClick={() => { setSourceFilter(''); setStatusTab('all'); }}
                    className="text-xs text-primary hover:underline">Clear filters</button>
                )}
              </PopoverContent>
            </Popover>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="sm:w-44 rounded-xl border border-border bg-card py-2.5 px-3.5 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-foreground/10">
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
            {tabs.map((t) => (
              <button key={t.key} type="button" onClick={() => setStatusTab(t.key)}
                className={`px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
                  statusTab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}>
                {t.label} <span className="text-xs opacity-70">({(counts[t.key] ?? 0).toLocaleString()})</span>
              </button>
            ))}
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5">
              <p className="text-sm font-medium text-foreground">{selectedIds.size} selected</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setSelectedIds(new Set())} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
                <button type="button"
                  onClick={() => setShowDeleteConfirm(customers.filter((c) => selectedIds.has(c.id)))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-destructive border border-destructive/30 hover:bg-destructive/10 transition">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            {loading ? (
              <div className="p-8 space-y-3">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
              </div>
            ) : customers.length === 0 ? (
              <div className="p-16 text-center">
                <Users className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
                <h3 className="font-semibold text-foreground mb-1">
                  {searchQuery || sourceFilter || statusTab !== 'all' ? 'No customers found' : 'No customers yet'}
                </h3>
                <p className="text-sm text-muted-foreground mb-5">
                  {searchQuery || sourceFilter || statusTab !== 'all' ? 'Try a different search term or filter' : 'Customers are added automatically when you create orders, or add them manually'}
                </p>
                {!searchQuery && statusTab === 'all' && !sourceFilter && (
                  <button type="button" onClick={() => { setEditingCustomer(null); setShowAddModal(true); }}
                    className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition">
                    <Plus className="w-4 h-4" /> Add First Customer
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="p-3 w-8">
                          <input type="checkbox" checked={selectedIds.size === customers.length && customers.length > 0}
                            onChange={toggleSelectAll} className="rounded border-border" />
                        </th>
                        <th className="p-3 font-medium">Customer</th>
                        <th className="p-3 font-medium hidden md:table-cell">Contact</th>
                        <th className="p-3 font-medium">Orders</th>
                        <th className="p-3 font-medium">
                          <button type="button" onClick={() => setSortBy(sortBy === 'spent_desc' ? 'spent_asc' : 'spent_desc')}
                            className="inline-flex items-center gap-1 hover:text-foreground transition">
                            Total Spent
                          </button>
                        </th>
                        <th className="p-3 font-medium hidden lg:table-cell">Last Order</th>
                        <th className="p-3 font-medium">Status</th>
                        <th className="p-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {customers.map((customer) => (
                        <tr key={customer.id}
                          onClick={() => setSelectedCustomer(customer)}
                          className={`cursor-pointer transition hover:bg-muted/30 ${selectedCustomer?.id === customer.id ? 'bg-primary/5' : ''}`}>
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={selectedIds.has(customer.id)} onChange={() => toggleSelectOne(customer.id)} className="rounded border-border" />
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                                <span className="text-xs font-semibold text-foreground">{initials(customer.name)}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-foreground truncate">{customer.name}</p>
                                <p className="text-xs text-muted-foreground">{customerIdLabel(customer.id)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 hidden md:table-cell">
                            <div className="space-y-0.5">
                              {customer.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{customer.email}</p>}
                              {customer.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{customer.phone}</p>}
                            </div>
                          </td>
                          <td className="p-3 tabular-nums text-foreground">{customer.totalOrders}</td>
                          <td className="p-3 tabular-nums font-medium text-foreground">{fmt(customer.totalSpent, 0)}</td>
                          <td className="p-3 text-muted-foreground hidden lg:table-cell">{timeAgoShort(customer.lastOrder)}</td>
                          <td className="p-3"><StatusBadge status={customer.status} /></td>
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button type="button" onClick={() => setSelectedCustomer(customer)} aria-label={`View ${customer.name}`}
                                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
                                <Eye className="w-4 h-4" />
                              </button>
                              <button type="button" onClick={() => { setEditingCustomer(customer); setShowAddModal(true); }} aria-label={`Edit ${customer.name}`}
                                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
                                <Edit className="w-4 h-4" />
                              </button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button type="button" aria-label="More actions" className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem asChild>
                                    <Link href={`/dashboard/orders?customer_id=${customer.id}&name=${encodeURIComponent(customer.name)}`}>
                                      <ExternalLink className="w-3.5 h-3.5 mr-2" /> View Orders
                                    </Link>
                                  </DropdownMenuItem>
                                  {customer.email && (
                                    <DropdownMenuItem asChild>
                                      <a href={`mailto:${customer.email}`}><Mail className="w-3.5 h-3.5 mr-2" /> Send Email</a>
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setShowDeleteConfirm(customer)} className="text-destructive focus:text-destructive">
                                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">Showing {rangeStart}-{rangeEnd} of {total.toLocaleString()} customers</p>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                      className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {pageWindow(page, totalPages).map((p, i) => p === '…' ? (
                      <span key={`e${i}`} className="px-1.5 text-xs text-muted-foreground">…</span>
                    ) : (
                      <button key={p} type="button" onClick={() => setPage(p)}
                        className={`min-w-[2rem] px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                          p === page ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
                        }`}>
                        {p}
                      </button>
                    ))}
                    <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    Rows per page
                    <select value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))}
                      className="rounded-lg border border-border bg-background py-1.5 px-2 text-foreground outline-none focus:ring-2 focus:ring-primary">
                      {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>
      </div>

      {selectedCustomer && (
        <CustomerDetailPanel
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onUpdated={(patch) => applyUpdateToState(selectedCustomer.id, patch)}
          onEdit={() => { setEditingCustomer(selectedCustomer); setShowAddModal(true); }}
          onDelete={() => setShowDeleteConfirm(selectedCustomer)}
        />
      )}

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
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {Array.isArray(showDeleteConfirm) ? `Delete ${showDeleteConfirm.length} customers?` : 'Delete Customer?'}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">Their order history will be preserved, but the customer record will be removed.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
              <button type="button" onClick={() => handleDelete(Array.isArray(showDeleteConfirm) ? showDeleteConfirm : [showDeleteConfirm])}
                className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition">Delete</button>
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
    city: customer?.city ?? '',
    country: customer?.country ?? '',
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
            <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="e.g. Street, building" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">City</label>
            <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder="e.g. Colombo" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-foreground/15 outline-none text-foreground" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Country</label>
            <Select value={formData.country || undefined} onValueChange={(v) => setFormData({ ...formData, country: v })}>
              <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{flagEmoji(c.code)} {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
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
