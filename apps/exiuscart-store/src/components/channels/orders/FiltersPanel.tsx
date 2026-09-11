'use client';

import { useState } from 'react';
import { Search, X, Filter, ChevronDown } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { CHANNEL_META } from '../channelMeta';
import ChannelLogo from '../ChannelLogo';
import DateRangePicker, { DateRangeValue, dateRangeLabel } from '../listings/DateRangePicker';

export interface OrderFiltersState {
  search: string;
  channels: string[];
  paymentStatus: string;  // '' = all — one real Order.payment_status value
  fulfillment: string;    // '' = all — one real fulfillment_key value
  dateRange: DateRangeValue;
  onlyNeedsAttention: boolean;
}

export const DEFAULT_ORDER_FILTERS: OrderFiltersState = {
  search: '', channels: [], paymentStatus: '', fulfillment: '',
  dateRange: { preset: 'all' }, onlyNeedsAttention: false,
};

const PAYMENT_OPTIONS = [
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
];

const FULFILLMENT_OPTIONS = [
  { value: 'awaiting', label: 'Awaiting' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'failed', label: 'Failed' },
];

function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

// Same "pills + popover checklist" shape as Channel Listings' own filter —
// scoped down here to just the real, connected channels (the ones that can
// actually have a channel order at all).
function ChannelMultiSelect({ options, selected, onToggle }: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full min-h-10 px-2 py-1.5 flex items-center gap-1.5 flex-wrap bg-muted border border-border rounded-lg text-left">
          {selected.length === 0 ? (
            <span className="text-sm text-muted-foreground px-1">All channels</span>
          ) : (
            selected.map((v) => (
              <span key={v} className="inline-flex items-center gap-1 bg-card border border-border rounded-md px-2 py-1 text-xs font-medium text-foreground">
                <ChannelLogo channelType={v} size={12} />
                {CHANNEL_META[v]?.label ?? v}
                <X className="w-3 h-3 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); onToggle(v); }} />
              </span>
            ))
          )}
          <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="max-h-72 overflow-y-auto space-y-0.5">
          {options.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-1.5">No connected channels yet</p>
          ) : options.map((v) => {
            const active = selected.includes(v);
            return (
              <button key={v} onClick={() => onToggle(v)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-left transition ${active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}>
                <ChannelLogo channelType={v} size={14} />
                {CHANNEL_META[v]?.label ?? v}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function FiltersPanel({
  activeChannels, filters, onChange, onClearAll,
}: {
  activeChannels: string[];
  filters: OrderFiltersState;
  onChange: (next: Partial<OrderFiltersState>) => void;
  onClearAll: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const chips: { key: string; label: string; onRemove: () => void }[] = [
    ...(filters.dateRange.preset !== 'all' ? [{ key: 'range', label: dateRangeLabel(filters.dateRange), onRemove: () => onChange({ dateRange: { preset: 'all' } }) }] : []),
    ...(filters.onlyNeedsAttention ? [{ key: 'attn', label: 'Needs attention', onRemove: () => onChange({ onlyNeedsAttention: false }) }] : []),
    ...(filters.paymentStatus ? [{ key: 'pay', label: PAYMENT_OPTIONS.find((p) => p.value === filters.paymentStatus)?.label ?? filters.paymentStatus, onRemove: () => onChange({ paymentStatus: '' }) }] : []),
    ...(filters.fulfillment ? [{ key: 'ful', label: FULFILLMENT_OPTIONS.find((f) => f.value === filters.fulfillment)?.label ?? filters.fulfillment, onRemove: () => onChange({ fulfillment: '' }) }] : []),
    ...filters.channels.map((c) => ({ key: `ch-${c}`, label: CHANNEL_META[c]?.label ?? c, onRemove: () => onChange({ channels: toggle(filters.channels, c) }) })),
  ];

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button onClick={() => setCollapsed((c) => !c)} className="w-full flex items-center justify-between px-5 py-4">
        <span className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Filter className="w-4 h-4" /> Filters
        </span>
        <div className="flex items-center gap-4">
          {chips.length > 0 && (
            <span onClick={(e) => { e.stopPropagation(); onClearAll(); }} className="text-xs font-semibold text-primary hover:opacity-80">Clear all</span>
          )}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition ${collapsed ? '' : 'rotate-180'}`} />
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-border p-5 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={filters.search}
                  onChange={(e) => onChange({ search: e.target.value })}
                  placeholder="Order #, customer name, email, or tracking number..."
                  className="w-full h-10 pl-9 pr-3 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Sales channel</label>
              <ChannelMultiSelect options={activeChannels} selected={filters.channels} onToggle={(v) => onChange({ channels: toggle(filters.channels, v) })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Date range</label>
              <DateRangePicker value={filters.dateRange} onChange={(dateRange) => onChange({ dateRange })} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Payment status</label>
              <select value={filters.paymentStatus} onChange={(e) => onChange({ paymentStatus: e.target.value })}
                className="w-full h-10 px-3 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">All payments</option>
                {PAYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Fulfillment</label>
              <select value={filters.fulfillment} onChange={(e) => onChange({ fulfillment: e.target.value })}
                className="w-full h-10 px-3 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">All fulfillment</option>
                {FULFILLMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="lg:col-span-2 flex items-end pb-1">
              <button onClick={() => onChange({ onlyNeedsAttention: !filters.onlyNeedsAttention })} className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span className={`relative h-5 w-9 rounded-full transition ${filters.onlyNeedsAttention ? 'bg-amber-500' : 'bg-muted'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${filters.onlyNeedsAttention ? 'left-4' : 'left-0.5'}`} />
                </span>
                Only needs attention
              </button>
            </div>
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <span className="text-xs font-semibold text-muted-foreground">Active filters:</span>
              {chips.map((chip) => (
                <button key={chip.key} onClick={chip.onRemove}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/70">
                  {chip.label} <X className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
