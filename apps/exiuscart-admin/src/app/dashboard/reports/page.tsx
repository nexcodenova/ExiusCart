'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, format, startOfDay, subDays } from 'date-fns';
import {
  ArrowDownRight, ArrowUpRight, CreditCard, DollarSign, Download, Loader2, Minus,
  Receipt, RotateCcw, Store, Timer, UserPlus, Users,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, Cell, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DateRangePicker, type DateRange } from '@/components/date-range-picker';

interface Kpi {
  value: number | null;
  prev: number | null;
  change: number | null;
}
interface SeriesPoint {
  label: string;
  date: string;
  revenue: number;
  payments: number;
  stores: number;
  users: number;
}
interface Breakdown { key: string; revenue: number; payments: number }
interface TopStore { name: string; revenue: number; payments: number; plan: string }
interface Report {
  range: { start: string; end: string; days: number };
  previous: { start: string; end: string } | null;
  granularity: 'day' | 'week' | 'month';
  kpis: {
    revenue: Kpi; payments: Kpi; avg_payment: Kpi; new_stores: Kpi; new_users: Kpi; trials: Kpi; refunded: Kpi;
    trial_conversion: Kpi & { converted: number; trials: number };
  };
  series: SeriesPoint[];
  previous_series: SeriesPoint[] | null;
  by_plan: Breakdown[];
  by_source: Breakdown[];
  top_stores: TopStore[];
  snapshot: {
    mrr: number;
    active: number;
    by_status: Record<string, number>;
    plan_distribution: { plan: string; count: number; percentage: number }[];
  };
}

type Metric = 'revenue' | 'payments' | 'stores' | 'users';
const METRICS: { id: Metric; label: string; money: boolean }[] = [
  { id: 'revenue', label: 'Revenue', money: true },
  { id: 'payments', label: 'Payments', money: false },
  { id: 'stores', label: 'New stores', money: false },
  { id: 'users', label: 'New users', money: false },
];

const PURPLE = '#6B3FD9';
const PALETTE = ['#6B3FD9', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#64748B'];
const SOURCE_LABELS: Record<string, string> = { lemon_squeezy: 'Card (Lemon Squeezy)', manual: 'Manual / bank' };

const usd = (n: number, digits = 0) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
const num = (n: number) => new Intl.NumberFormat('en-US').format(n);
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : s);
const ymd = (d: Date) => format(d, 'yyyy-MM-dd');

function Change({ change, invert = false, suffix = '%' }: { change: number | null; invert?: boolean; suffix?: string }) {
  if (change === null) return <span className="text-xs text-gray-400">no prior data</span>;
  if (change === 0) return <span className="inline-flex items-center gap-0.5 text-xs font-medium text-gray-500"><Minus className="h-3 w-3" />0{suffix}</span>;
  const good = invert ? change < 0 : change > 0;
  const Icon = change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold', good ? 'text-emerald-600' : 'text-red-600')}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(change)}{suffix}
    </span>
  );
}

function KpiCard({
  label, icon: Icon, value, kpi, format: fmt, compare, invert, note, tint,
}: {
  label: string;
  icon: React.ElementType;
  value: string;
  kpi: { change: number | null; prev: number | null };
  format: (n: number) => string;
  compare: boolean;
  invert?: boolean;
  note?: string;
  tint: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{label}</span>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', tint)}><Icon className="h-4 w-4" /></span>
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{value}</div>
      <div className="mt-1 flex items-center gap-2">
        {compare ? (
          <>
            <Change change={kpi.change} invert={invert} />
            {kpi.prev !== null && <span className="text-xs text-gray-400">vs {fmt(kpi.prev)}</span>}
          </>
        ) : (
          <span className="text-xs text-gray-400">{note ?? ' '}</span>
        )}
      </div>
    </div>
  );
}

function csvCell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(report: Report) {
  const rows: (string | number)[][] = [
    ['ExiusCart report', `${report.range.start} to ${report.range.end}`, 'All amounts in USD'],
    [],
    ['Metric', 'Value', 'Previous period', 'Change %'],
    ...([
      ['Revenue', report.kpis.revenue], ['Payments', report.kpis.payments], ['Average payment', report.kpis.avg_payment],
      ['New stores', report.kpis.new_stores], ['New users', report.kpis.new_users], ['Trials started', report.kpis.trials],
      ['Refunded', report.kpis.refunded],
    ] as [string, Kpi][]).map(([n, k]) => [n, k.value ?? '', k.prev ?? '', k.change ?? '']),
    [],
    [`Per ${report.granularity}`, 'Revenue', 'Payments', 'New stores', 'New users'],
    ...report.series.map((p) => [p.date, p.revenue, p.payments, p.stores, p.users]),
    [],
    ['Revenue by plan', 'Revenue', 'Payments'],
    ...report.by_plan.map((b) => [cap(b.key), b.revenue, b.payments]),
    [],
    ['Revenue by source', 'Revenue', 'Payments'],
    ...report.by_source.map((b) => [SOURCE_LABELS[b.key] ?? b.key, b.revenue, b.payments]),
    [],
    ['Top stores', 'Revenue', 'Payments', 'Plan'],
    ...report.top_stores.map((s) => [s.name, s.revenue, s.payments, cap(s.plan)]),
  ];
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `exiuscart-report_${report.range.start}_to_${report.range.end}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const today = useMemo(() => startOfDay(new Date()), []);
  // Opens on everything ever recorded; pick a preset or dates to narrow it.
  const [allTime, setAllTime] = useState(true);
  const [range, setRange] = useState<DateRange>({ from: subDays(today, 29), to: today });
  const [compare, setCompare] = useState(true);
  const [metric, setMetric] = useState<Metric>('revenue');
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.getAdvancedReports({
        start: allTime ? 'all' : ymd(range.from),
        end: ymd(allTime ? today : range.to),
        compare: allTime ? false : compare,
      });
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not load the report. Try again.');
    } finally {
      setLoading(false);
    }
  }, [range, compare, allTime, today]);

  useEffect(() => { load(); }, [load]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.series.map((p, i) => ({
      label: p.label,
      current: p[metric],
      previous: data.previous_series?.[i]?.[metric] ?? null,
      previousLabel: data.previous_series?.[i]?.label,
    }));
  }, [data, metric]);

  const showCompare = compare && !allTime;
  const money = METRICS.find((m) => m.id === metric)!.money;
  const days = data?.range.days ?? differenceInCalendarDays(range.to, range.from) + 1;
  const planTotal = data?.by_plan.reduce((s, b) => s + b.revenue, 0) ?? 0;
  const maxStore = data?.top_stores[0]?.revenue ?? 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            Money received, sign-ups and trials for any period. All amounts are in USD, refunds are left out of revenue.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <label
            className={cn(
              'flex h-10 select-none items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700',
              allTime ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            )}
            title={allTime ? 'There is nothing before "All time" to compare with' : undefined}
          >
            <input
              id="compare-toggle"
              type="checkbox"
              checked={compare && !allTime}
              disabled={allTime}
              onChange={(e) => setCompare(e.target.checked)}
              className="h-4 w-4 accent-[#6B3FD9]"
            />
            Compare to previous period
          </label>
          <DateRangePicker
            value={range}
            onChange={(r) => { setAllTime(false); setRange(r); }}
            today={today}
            allTime={allTime}
            onAllTime={() => setAllTime(true)}
          />
          <button
            type="button"
            disabled={!data || loading}
            onClick={() => data && downloadCsv(data)}
            className="flex h-10 items-center gap-2 rounded-xl bg-[#6B3FD9] px-4 text-sm font-medium text-white transition-colors hover:bg-[#5b34b8] disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button type="button" onClick={load} className="font-semibold underline">Retry</button>
        </div>
      )}

      {!data && loading ? (
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#6B3FD9]" /></div>
      ) : data ? (
        <div className={cn('space-y-6 transition-opacity', loading && 'opacity-60')}>
          <p className="text-xs text-gray-500">
            {format(new Date(data.range.start + 'T00:00:00'), 'MMM d, yyyy')} – {format(new Date(data.range.end + 'T00:00:00'), 'MMM d, yyyy')}
            {' · '}{days} {days === 1 ? 'day' : 'days'}, grouped by {data.granularity}
            {allTime && ' · from the first store, user or payment ever recorded'}
            {data.previous && (
              <> · compared with {format(new Date(data.previous.start + 'T00:00:00'), 'MMM d, yyyy')} – {format(new Date(data.previous.end + 'T00:00:00'), 'MMM d, yyyy')}</>
            )}
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Revenue" icon={DollarSign} tint="bg-emerald-50 text-emerald-600" value={usd(data.kpis.revenue.value ?? 0, 2)} kpi={data.kpis.revenue} format={(n) => usd(n, 2)} compare={showCompare} />
            <KpiCard label="Payments" icon={CreditCard} tint="bg-blue-50 text-blue-600" value={num(data.kpis.payments.value ?? 0)} kpi={data.kpis.payments} format={num} compare={showCompare} />
            <KpiCard label="Average payment" icon={Receipt} tint="bg-violet-50 text-violet-600" value={usd(data.kpis.avg_payment.value ?? 0, 2)} kpi={data.kpis.avg_payment} format={(n) => usd(n, 2)} compare={showCompare} />
            <KpiCard label="Refunded" icon={RotateCcw} tint="bg-red-50 text-red-600" value={usd(data.kpis.refunded.value ?? 0, 2)} kpi={data.kpis.refunded} format={(n) => usd(n, 2)} compare={showCompare} invert />
            <KpiCard label="New stores" icon={Store} tint="bg-amber-50 text-amber-600" value={num(data.kpis.new_stores.value ?? 0)} kpi={data.kpis.new_stores} format={num} compare={showCompare} />
            <KpiCard label="New users" icon={UserPlus} tint="bg-sky-50 text-sky-600" value={num(data.kpis.new_users.value ?? 0)} kpi={data.kpis.new_users} format={num} compare={showCompare} />
            <KpiCard label="Trials started" icon={Timer} tint="bg-orange-50 text-orange-600" value={num(data.kpis.trials.value ?? 0)} kpi={data.kpis.trials} format={num} compare={showCompare} />
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Trial to paid</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600"><Users className="h-4 w-4" /></span>
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-gray-900">
                {data.kpis.trial_conversion.value === null ? '–' : `${data.kpis.trial_conversion.value}%`}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-gray-400">{data.kpis.trial_conversion.converted} of {data.kpis.trial_conversion.trials} trials now paying</span>
                {showCompare && data.kpis.trial_conversion.change !== null && <Change change={data.kpis.trial_conversion.change} suffix=" pts" />}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-gray-900">Trend</h2>
              <div className="inline-flex rounded-xl bg-gray-100 p-1">
                {METRICS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMetric(m.id)}
                    className={cn('rounded-lg px-3 py-1 text-sm transition-colors', metric === m.id ? 'bg-white font-semibold text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="reportFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PURPLE} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={PURPLE} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} width={52} allowDecimals={false}
                    tickFormatter={(v) => (money ? usd(v) : num(v))}
                  />
                  <Tooltip
                    cursor={{ stroke: '#D1D5DB' }}
                    contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 12 }}
                    formatter={(v: number, name) => [money ? usd(v, 2) : num(v), name === 'current' ? 'This period' : 'Previous period']}
                  />
                  {showCompare && (
                    <Line type="monotone" dataKey="previous" stroke="#9CA3AF" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
                  )}
                  <Area type="monotone" dataKey="current" stroke={PURPLE} strokeWidth={2.5} fill="url(#reportFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {data.kpis.payments.value === 0 && metric === 'revenue' && (
              <p className="mt-2 text-center text-sm text-gray-500">No payments were received in this period.</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="mb-1 font-semibold text-gray-900">Revenue by plan</h2>
              <p className="mb-3 text-xs text-gray-500">Payments received in this period</p>
              {data.by_plan.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">No payments in this period</p>
              ) : (
                <>
                  <div className="relative h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.by_plan} dataKey="revenue" nameKey="key" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
                          {data.by_plan.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number, _n, item) => [usd(v, 2), cap(String(item.payload.key))]} contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-bold tabular-nums text-gray-900">{usd(planTotal)}</span>
                      <span className="text-[11px] text-gray-400">total</span>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {data.by_plan.map((b, i) => (
                      <li key={b.key} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-gray-600">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                          {cap(b.key)}
                        </span>
                        <span className="tabular-nums text-gray-900">{usd(b.revenue, 2)} <span className="text-gray-400">· {b.payments}</span></span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="mb-1 font-semibold text-gray-900">Revenue by source</h2>
              <p className="mb-4 text-xs text-gray-500">How the money came in</p>
              {data.by_source.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">No payments in this period</p>
              ) : (
                <ul className="space-y-4">
                  {data.by_source.map((b, i) => {
                    const total = data.by_source.reduce((s, x) => s + x.revenue, 0) || 1;
                    const pct = Math.round((b.revenue / total) * 100);
                    return (
                      <li key={b.key}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="text-gray-700">{SOURCE_LABELS[b.key] ?? cap(b.key)}</span>
                          <span className="tabular-nums text-gray-900">{usd(b.revenue, 2)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PALETTE[i % PALETTE.length] }} />
                        </div>
                        <div className="mt-1 text-xs text-gray-400">{pct}% · {b.payments} {b.payments === 1 ? 'payment' : 'payments'}</div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="mb-1 font-semibold text-gray-900">Right now</h2>
              <p className="mb-4 text-xs text-gray-500">Live figures, not tied to the dates above</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">Monthly recurring</div>
                  <div className="text-lg font-bold tabular-nums text-gray-900">{usd(data.snapshot.mrr)}</div>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">Active subscriptions</div>
                  <div className="text-lg font-bold tabular-nums text-gray-900">{num(data.snapshot.active)}</div>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                {Object.entries(data.snapshot.by_status).sort((a, b) => b[1] - a[1]).map(([st, n]) => (
                  <div key={st} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{cap(st)}</span>
                    <span className="tabular-nums font-medium text-gray-900">{num(n)}</span>
                  </div>
                ))}
                {Object.keys(data.snapshot.by_status).length === 0 && <p className="text-sm text-gray-400">No subscriptions yet</p>}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 font-semibold text-gray-900">Top stores by revenue</h2>
            {data.top_stores.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No payments in this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                      <th className="w-10 pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">Store</th>
                      <th className="pb-2 font-medium">Plan</th>
                      <th className="pb-2 text-right font-medium">Payments</th>
                      <th className="w-1/3 pb-2 pl-6 text-right font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_stores.map((s, i) => (
                      <tr key={`${s.name}-${i}`} className="border-b border-gray-50 last:border-0">
                        <td className="py-2.5 tabular-nums text-gray-400">{i + 1}</td>
                        <td className="py-2.5 font-medium text-gray-900">{s.name}</td>
                        <td className="py-2.5 text-gray-600">{cap(s.plan)}</td>
                        <td className="py-2.5 text-right tabular-nums text-gray-600">{s.payments}</td>
                        <td className="py-2.5 pl-6">
                          <div className="flex items-center justify-end gap-3">
                            <div className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 sm:block">
                              <div className="h-full rounded-full bg-[#6B3FD9]" style={{ width: `${maxStore ? (s.revenue / maxStore) * 100 : 0}%` }} />
                            </div>
                            <span className="w-24 text-right font-semibold tabular-nums text-gray-900">{usd(s.revenue, 2)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
