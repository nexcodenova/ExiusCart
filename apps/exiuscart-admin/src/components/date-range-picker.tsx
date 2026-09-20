'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays, addMonths, endOfMonth, format, isAfter, isBefore, isSameDay, isSameMonth,
  startOfDay, startOfMonth, startOfWeek, startOfYear, subDays, subMonths,
} from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DateRange {
  from: Date;
  to: Date;
}

interface Preset {
  id: string;
  label: string;
  range: (today: Date) => DateRange;
}

export const PRESETS: Preset[] = [
  { id: 'today', label: 'Today', range: (t) => ({ from: t, to: t }) },
  { id: 'yesterday', label: 'Yesterday', range: (t) => ({ from: subDays(t, 1), to: subDays(t, 1) }) },
  { id: '7d', label: 'Last 7 days', range: (t) => ({ from: subDays(t, 6), to: t }) },
  { id: '30d', label: 'Last 30 days', range: (t) => ({ from: subDays(t, 29), to: t }) },
  { id: '90d', label: 'Last 90 days', range: (t) => ({ from: subDays(t, 89), to: t }) },
  { id: 'month', label: 'This month', range: (t) => ({ from: startOfMonth(t), to: t }) },
  {
    id: 'last_month',
    label: 'Last month',
    range: (t) => ({ from: startOfMonth(subMonths(t, 1)), to: endOfMonth(subMonths(t, 1)) }),
  },
  { id: 'year', label: 'This year', range: (t) => ({ from: startOfYear(t), to: t }) },
  { id: '365d', label: 'Last 12 months', range: (t) => ({ from: subDays(t, 364), to: t }) },
];

export function presetIdFor(range: DateRange, today: Date): string | null {
  for (const p of PRESETS) {
    const r = p.range(today);
    if (isSameDay(r.from, range.from) && isSameDay(r.to, range.to)) return p.id;
  }
  return null;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function MonthGrid({
  month, from, to, hover, today, onPick, onHover,
}: {
  month: Date;
  from: Date | null;
  to: Date | null;
  hover: Date | null;
  today: Date;
  onPick: (d: Date) => void;
  onHover: (d: Date | null) => void;
}) {
  const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  // While the user has picked only the start, preview the range up to the hovered day.
  const previewEnd = from && !to && hover && !isBefore(hover, from) ? hover : to;

  return (
    <div className="w-[15.5rem]">
      <div className="mb-2 text-center text-sm font-semibold text-gray-900">{format(month, 'MMMM yyyy')}</div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-gray-400">
        {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
      </div>
      <div className="grid grid-cols-7" onMouseLeave={() => onHover(null)}>
        {days.map((d) => {
          const outside = !isSameMonth(d, month);
          const isStart = !!from && isSameDay(d, from);
          const isEnd = !!previewEnd && isSameDay(d, previewEnd);
          const inRange = !!from && !!previewEnd && isAfter(d, from) && isBefore(d, previewEnd);
          const future = isAfter(d, today);
          return (
            <div
              key={d.toISOString()}
              className={cn('h-8', (inRange || (isStart && previewEnd && !isSameDay(from!, previewEnd))) && !outside && 'bg-[#6B3FD9]/10',
                isStart && 'rounded-l-full', isEnd && 'rounded-r-full')}
            >
              {outside ? null : (
                <button
                  type="button"
                  disabled={future}
                  onClick={() => onPick(d)}
                  onMouseEnter={() => onHover(d)}
                  className={cn(
                    'h-8 w-full rounded-full text-[13px] tabular-nums transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B3FD9]',
                    future ? 'cursor-not-allowed text-gray-300' : 'text-gray-700 hover:bg-[#6B3FD9]/15',
                    (isStart || isEnd) && 'bg-[#6B3FD9] font-semibold text-white hover:bg-[#6B3FD9]',
                    isSameDay(d, today) && !isStart && !isEnd && 'font-bold text-[#6B3FD9]',
                  )}
                >
                  {format(d, 'd')}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DateRangePicker({
  value, onChange, today = startOfDay(new Date()), allTime = false, onAllTime,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  today?: Date;
  /** True while the report covers everything; the button then reads "All time". */
  allTime?: boolean;
  onAllTime?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState<Date | null>(value.from);
  const [draftTo, setDraftTo] = useState<Date | null>(value.to);
  const [hover, setHover] = useState<Date | null>(null);
  const [leftMonth, setLeftMonth] = useState(startOfMonth(subMonths(value.to, 1)));
  const ref = useRef<HTMLDivElement>(null);

  // Re-sync the draft whenever the popover opens.
  useEffect(() => {
    if (!open) return;
    setDraftFrom(value.from);
    setDraftTo(value.to);
    setLeftMonth(startOfMonth(isSameMonth(value.from, value.to) ? subMonths(value.to, 1) : value.from));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const activePreset = useMemo(() => (allTime ? 'all' : presetIdFor(value, today)), [value, today, allTime]);

  const pick = (d: Date) => {
    if (!draftFrom || draftTo) { setDraftFrom(d); setDraftTo(null); return; }
    if (isBefore(d, draftFrom)) { setDraftFrom(d); return; }
    setDraftTo(d);
  };

  const apply = (r: DateRange) => { onChange(r); setOpen(false); };
  const canApply = !!draftFrom && !!draftTo;

  const label = allTime
    ? 'All time'
    : isSameDay(value.from, value.to)
    ? format(value.from, 'MMM d, yyyy')
    : `${format(value.from, 'MMM d, yyyy')} – ${format(value.to, 'MMM d, yyyy')}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B3FD9]"
      >
        <CalendarIcon className="h-4 w-4 text-[#6B3FD9]" />
        <span className="tabular-nums">{label}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Select date range"
          className="absolute right-0 z-50 mt-2 flex max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl sm:flex-row"
        >
          <div className="flex gap-1 overflow-x-auto border-b border-gray-100 p-2 sm:w-40 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r">
            {onAllTime && (
              <button
                type="button"
                onClick={() => { onAllTime(); setOpen(false); }}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-sm transition-colors',
                  activePreset === 'all' ? 'bg-[#6B3FD9]/10 font-semibold text-[#6B3FD9]' : 'text-gray-600 hover:bg-gray-50',
                )}
              >
                All time
              </button>
            )}
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => apply(p.range(today))}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-sm transition-colors',
                  activePreset === p.id ? 'bg-[#6B3FD9]/10 font-semibold text-[#6B3FD9]' : 'text-gray-600 hover:bg-gray-50',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="p-4">
            <div className="relative flex gap-6">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setLeftMonth((m) => subMonths(m, 1))}
                className="absolute left-0 top-0 rounded-lg p-1 text-gray-500 hover:bg-gray-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Next month"
                disabled={!isBefore(addMonths(leftMonth, 1), startOfMonth(today))}
                onClick={() => setLeftMonth((m) => addMonths(m, 1))}
                className="absolute right-0 top-0 rounded-lg p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <MonthGrid month={leftMonth} from={draftFrom} to={draftTo} hover={hover} today={today} onPick={pick} onHover={setHover} />
              <div className="hidden sm:block">
                <MonthGrid month={addMonths(leftMonth, 1)} from={draftFrom} to={draftTo} hover={hover} today={today} onPick={pick} onHover={setHover} />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
              <span className="text-xs tabular-nums text-gray-500">
                {draftFrom ? format(draftFrom, 'MMM d, yyyy') : 'Start date'} – {draftTo ? format(draftTo, 'MMM d, yyyy') : 'End date'}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canApply}
                  onClick={() => canApply && apply({ from: draftFrom!, to: draftTo! })}
                  className="rounded-lg bg-[#6B3FD9] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#5b34b8] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
