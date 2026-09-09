'use client';

import { useState } from 'react';
import { Calendar as CalendarIcon, Check } from 'lucide-react';
import { format } from 'date-fns';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { DateRange } from 'react-day-picker';

export interface DateRangeValue {
  preset: 'all' | 'today' | '7' | '30' | '90' | 'custom';
  from?: string; // ISO date — only meaningful when preset === 'custom'
  to?: string;
}

const PRESETS: { value: DateRangeValue['preset']; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

export function dateRangeLabel(v: DateRangeValue): string {
  if (v.preset === 'custom' && v.from) {
    return v.to && v.to !== v.from ? `${format(new Date(v.from), 'MMM d')} – ${format(new Date(v.to), 'MMM d, yyyy')}` : format(new Date(v.from), 'MMM d, yyyy');
  }
  return PRESETS.find((p) => p.value === v.preset)?.label ?? 'All time';
}

// Real calendar (react-day-picker + date-fns were already installed —
// components/ui/calendar.tsx already existed, just never wired to an
// actual date-picker UI anywhere in the app until this one) alongside the
// same quick-preset shortcuts the reference design showed.
export default function DateRangePicker({ value, onChange }: { value: DateRangeValue; onChange: (v: DateRangeValue) => void }) {
  const [open, setOpen] = useState(false);
  const selectedRange: DateRange | undefined = value.preset === 'custom' && value.from
    ? { from: new Date(value.from), to: value.to ? new Date(value.to) : undefined }
    : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full h-10 px-3 flex items-center gap-2 bg-muted border border-border rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30">
          <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="truncate">{dateRangeLabel(value)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          <div className="w-40 border-r border-border p-2 space-y-0.5">
            {PRESETS.map((p) => (
              <button key={p.value} onClick={() => { onChange({ preset: p.value }); setOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-left transition ${
                  value.preset === p.value ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                }`}>
                {p.label}
                {value.preset === p.value && <Check className="w-3.5 h-3.5" />}
              </button>
            ))}
            <div className="pt-1 mt-1 border-t border-border">
              <p className={`px-3 py-2 rounded-lg text-xs font-medium ${value.preset === 'custom' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
                Custom range →
              </p>
            </div>
          </div>
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={selectedRange}
            onSelect={(range) => {
              if (!range?.from) return;
              onChange({ preset: 'custom', from: range.from.toISOString(), to: range.to?.toISOString() });
              if (range.to) setOpen(false);
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
