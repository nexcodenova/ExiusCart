'use client';

import { useState } from 'react';
import { Search, X, Filter, ChevronDown } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { CHANNEL_META } from './channelMeta';
import ChannelLogo from './ChannelLogo';
import type { ListingStatus } from './StatusBadge';
import DateRangePicker, { DateRangeValue, dateRangeLabel } from './DateRangePicker';

const STATUS_OPTIONS: { value: ListingStatus; label: string }[] = [
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'processing', label: 'Processing' },
  { value: 'warning', label: 'Warning' },
];

const ACTIVITY_OPTIONS = [
  { value: 'create_listing', label: 'Create Listing' },
  { value: 'update_stock', label: 'Update Stock' },
  { value: 'update_price', label: 'Update Price' },
  { value: 'sync_order', label: 'Sync Order' },
];

export interface FiltersState {
  search: string;
  channels: string[];
  statuses: ListingStatus[];
  actions: string[];
  suppliers: string[];
  dateRange: DateRangeValue;
  onlyNeedsAction: boolean;
  showRetries: boolean;
}

function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

// A small "pills inside a bordered box + popover checklist to add more"
// multi-select — same shape as the reference's Sales channels control.
function MultiSelectBox({ placeholder, options, selected, onToggle }: {
  placeholder: string;
  options: { value: string; label: string; icon?: React.ElementType; color?: string; channelType?: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full min-h-10 px-2 py-1.5 flex items-center gap-1.5 flex-wrap bg-muted border border-border rounded-lg text-left">
          {selected.length === 0 ? (
            <span className="text-sm text-muted-foreground px-1">{placeholder}</span>
          ) : (
            selected.map((v) => {
              const opt = options.find((o) => o.value === v);
              return (
                <span key={v} className="inline-flex items-center gap-1 bg-card border border-border rounded-md px-2 py-1 text-xs font-medium text-foreground">
                  {opt?.channelType
                    ? <ChannelLogo channelType={opt.channelType} size={12} />
                    : opt?.icon && <opt.icon className={`w-3 h-3 ${opt.color ?? ''}`} />}
                  {opt?.label ?? v}
                  <X className="w-3 h-3 text-muted-foreground hover:text-foreground"
                    onClick={(e) => { e.stopPropagation(); onToggle(v); }} />
                </span>
              );
            })
          )}
          <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="max-h-72 overflow-y-auto space-y-0.5">
          {options.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-1.5">Nothing to choose from yet</p>
          ) : options.map((opt) => {
            const active = selected.includes(opt.value);
            return (
              <button key={opt.value} onClick={() => onToggle(opt.value)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-left transition ${active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}>
                {opt.channelType
                  ? <ChannelLogo channelType={opt.channelType} size={14} />
                  : opt.icon && <opt.icon className={`w-3.5 h-3.5 ${active ? '' : opt.color ?? ''}`} />}
                {opt.label}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function FiltersPanel({
  activeChannels, activeSuppliers, filters, onChange, onClearAll,
}: {
  activeChannels: string[];
  activeSuppliers: string[];
  filters: FiltersState;
  onChange: (next: Partial<FiltersState>) => void;
  onClearAll: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const channelOptions = activeChannels.map((c) => ({ value: c, label: CHANNEL_META[c]?.label ?? c, icon: CHANNEL_META[c]?.icon, color: CHANNEL_META[c]?.color, channelType: c }));
  const supplierOptions = activeSuppliers.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }));

  const activeFilterChips: { key: string; label: string; onRemove: () => void }[] = [
    ...(filters.dateRange.preset !== 'all' ? [{ key: 'range', label: dateRangeLabel(filters.dateRange), onRemove: () => onChange({ dateRange: { preset: 'all' } }) }] : []),
    ...(filters.onlyNeedsAction ? [{ key: 'action-flag', label: 'Only needs action', onRemove: () => onChange({ onlyNeedsAction: false }) }] : []),
    ...filters.channels.map((c) => ({ key: `ch-${c}`, label: CHANNEL_META[c]?.label ?? c, onRemove: () => onChange({ channels: toggle(filters.channels, c) }) })),
    ...filters.statuses.map((s) => ({ key: `st-${s}`, label: STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s, onRemove: () => onChange({ statuses: toggle(filters.statuses, s) }) })),
    ...filters.actions.map((a) => ({ key: `ac-${a}`, label: ACTIVITY_OPTIONS.find((o) => o.value === a)?.label ?? a, onRemove: () => onChange({ actions: toggle(filters.actions, a) }) })),
    ...filters.suppliers.map((s) => ({ key: `su-${s}`, label: s, onRemove: () => onChange({ suppliers: toggle(filters.suppliers, s) }) })),
  ];

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button onClick={() => setCollapsed((c) => !c)} className="w-full flex items-center justify-between px-5 py-4">
        <span className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Filter className="w-4 h-4" /> Filters
        </span>
        <div className="flex items-center gap-4">
          {activeFilterChips.length > 0 && (
            <span onClick={(e) => { e.stopPropagation(); onClearAll(); }} className="text-xs font-semibold text-primary hover:opacity-80">Clear all</span>
          )}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition ${collapsed ? '' : 'rotate-180'}`} />
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-border p-5 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={filters.search}
                  onChange={(e) => onChange({ search: e.target.value })}
                  placeholder="Search by product name, SKU, or product ID..."
                  className="w-full h-10 pl-9 pr-3 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Sales channels</label>
              <MultiSelectBox placeholder="All channels" options={channelOptions} selected={filters.channels} onToggle={(v) => onChange({ channels: toggle(filters.channels, v) })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Status</label>
              <MultiSelectBox placeholder="All statuses" options={STATUS_OPTIONS} selected={filters.statuses} onToggle={(v) => onChange({ statuses: toggle(filters.statuses, v as ListingStatus) })} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Activity type</label>
              <MultiSelectBox placeholder="All activity types" options={ACTIVITY_OPTIONS} selected={filters.actions} onToggle={(v) => onChange({ actions: toggle(filters.actions, v) })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Date range</label>
              <DateRangePicker value={filters.dateRange} onChange={(dateRange) => onChange({ dateRange })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Supplier</label>
              <MultiSelectBox placeholder="All suppliers" options={supplierOptions} selected={filters.suppliers} onToggle={(v) => onChange({ suppliers: toggle(filters.suppliers, v) })} />
            </div>
          </div>

          <div className="flex items-center gap-5 pt-1">
            <button onClick={() => onChange({ onlyNeedsAction: !filters.onlyNeedsAction })} className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span className={`relative h-5 w-9 rounded-full transition ${filters.onlyNeedsAction ? 'bg-amber-500' : 'bg-muted'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${filters.onlyNeedsAction ? 'left-4' : 'left-0.5'}`} />
              </span>
              Only needs action
            </button>
            <button onClick={() => onChange({ showRetries: !filters.showRetries })} className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span className={`relative h-5 w-9 rounded-full transition ${filters.showRetries ? 'bg-primary' : 'bg-muted'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${filters.showRetries ? 'left-4' : 'left-0.5'}`} />
              </span>
              Show all retries
            </button>
          </div>

          {activeFilterChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <span className="text-xs font-semibold text-muted-foreground">Active filters:</span>
              {activeFilterChips.map((chip) => (
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
