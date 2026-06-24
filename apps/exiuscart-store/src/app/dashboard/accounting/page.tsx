'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen, TrendingUp, TrendingDown, DollarSign, FileText,
  Download, Loader2, BarChart3, ArrowUpRight, ArrowDownRight,
  Receipt, Scale, Calculator,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { reportsApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

function AcctTooltip({ active, payload, label, fmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg">
      {label && <p className="mb-1 text-xs font-medium text-foreground">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs text-muted-foreground">
          {p.name}: <span className="font-semibold text-foreground">{fmt(p.value, 0)}</span>
        </p>
      ))}
    </div>
  );
}

type Tab = 'overview' | 'pl' | 'balance' | 'tax';

export default function AccountingPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  useEffect(() => {
    if (!shopId) { setLoading(false); return; }
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const to = now.toISOString().split('T')[0];
    Promise.all([
      reportsApi.getSalesReport(shopId, { from, to }),
      reportsApi.getTopProducts(shopId),
    ])
      .then(([s, t]) => { setSalesData(s.data ?? []); setTopProducts(t.data ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shopId]);

  const totalRevenue = salesData.reduce((s, d) => s + (d.sales ?? 0), 0);
  const totalOrders  = salesData.reduce((s, d) => s + (d.orders ?? 0), 0);
  const avgOrder     = totalOrders ? totalRevenue / totalOrders : 0;
  const outputVat    = totalRevenue * 0.05 / 1.05;
  const netRevenue   = totalRevenue - outputVat;
  const acctChart = salesData.map((d) => ({ label: new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), revenue: Math.round(d.sales ?? 0) }));
  const vatPie = [{ name: 'Net Revenue', value: Math.round(netRevenue) }, { name: 'VAT', value: Math.round(outputVat) }];
  const VAT_COLORS = ['#6366f1', '#f59e0b'];

  const { fmt: fmtCurrency, sym } = useCurrency();
  const fmt = (n: number) => fmtCurrency(n);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview',       icon: BarChart3   },
    { id: 'pl',       label: 'Profit & Loss',  icon: TrendingUp  },
    { id: 'balance',  label: 'Balance Sheet',  icon: Scale       },
    { id: 'tax',      label: 'Tax Filing',     icon: Receipt     },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Accounting</h1>
          <p className="text-muted-foreground text-sm">General ledger, P&amp;L, balance sheet &amp; tax filing</p>
        </div>
        <button type="button" className="inline-flex items-center gap-2 border border-border px-4 py-2.5 rounded-lg text-foreground hover:bg-muted transition text-sm font-medium">
          <Download className="w-4 h-4" /> Export Financials
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-card rounded-xl border border-border p-1.5">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${tab === id ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Revenue',   value: `${fmt(totalRevenue)}`,  icon: TrendingUp,   color: 'text-green-500',  bg: 'bg-green-500/10' },
                  { label: 'Total Orders',    value: totalOrders.toString(),       icon: FileText,     color: 'text-blue-500',   bg: 'bg-blue-500/10'  },
                  { label: 'Avg Order Value', value: `${fmt(avgOrder)}`,       icon: DollarSign,   color: 'text-purple-500', bg: 'bg-purple-500/10'},
                  { label: 'VAT Payable',     value: `${fmt(totalRevenue * 0.05 / 1.05)}`, icon: Receipt, color: 'text-orange-500', bg: 'bg-orange-500/10'},
                ].map((s) => (
                  <div key={s.label} className="bg-card rounded-xl border border-border p-5">
                    <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                      <s.icon className={`w-5 h-5 ${s.color}`} />
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                    <p className="text-xl font-bold text-foreground">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Charts: revenue trend + VAT split */}
              {salesData.length > 0 && (
                <div className="grid lg:grid-cols-3 gap-5">
                  <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <h2 className="mb-1 font-semibold text-foreground">Revenue Trend</h2>
                    <p className="mb-4 text-xs text-muted-foreground">Daily revenue this month</p>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={acctChart} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                          <defs>
                            <linearGradient id="acctRev" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={56} />
                          <Tooltip content={<AcctTooltip fmt={fmtCurrency} />} />
                          <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#acctRev)" dot={false} activeDot={{ r: 5, fill: '#10b981' }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <h2 className="mb-1 font-semibold text-foreground">Revenue vs VAT</h2>
                    <p className="mb-2 text-xs text-muted-foreground">Net revenue and VAT owed</p>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={vatPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={66} paddingAngle={2} stroke="none">
                            {vatPie.map((_, i) => <Cell key={i} fill={VAT_COLORS[i]} />)}
                          </Pie>
                          <Tooltip content={<AcctTooltip fmt={fmtCurrency} />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {vatPie.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: VAT_COLORS[i] }} />
                          <span className="flex-1 truncate text-muted-foreground">{p.name}</span>
                          <span className="font-medium text-foreground">{fmtCurrency(p.value, 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Daily revenue table */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h2 className="font-semibold text-foreground">Daily Revenue — This Month</h2>
                </div>
                {salesData.length === 0 ? (
                  <div className="p-12 text-center">
                    <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <p className="text-muted-foreground text-sm">No transactions this month</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          {['Date','Orders',`Revenue (${sym})`,'Avg Order'].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {salesData.map((row) => (
                          <tr key={row.date} className="hover:bg-muted/30">
                            <td className="px-4 py-3 text-foreground font-medium">
                              {new Date(row.date).toLocaleDateString('en-AE',{day:'numeric',month:'short'})}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{row.orders}</td>
                            <td className="px-4 py-3 text-foreground font-semibold">{fmt(row.sales)}</td>
                            <td className="px-4 py-3 text-muted-foreground">{row.orders ? fmt(row.sales/row.orders) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/50 border-t border-border font-bold">
                        <tr>
                          <td className="px-4 py-3 text-foreground">Total</td>
                          <td className="px-4 py-3 text-foreground">{totalOrders}</td>
                          <td className="px-4 py-3 text-foreground">{fmt(totalRevenue)}</td>
                          <td className="px-4 py-3 text-foreground">{fmt(avgOrder)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Profit & Loss ── */}
          {tab === 'pl' && (
            <div className="space-y-4">
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h2 className="font-semibold text-foreground">Profit &amp; Loss Statement</h2>
                  <span className="text-xs text-muted-foreground">Current Month</span>
                </div>
                <div className="p-4 space-y-1">
                  {/* Revenue */}
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="font-semibold text-foreground">Revenue</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">{fmt(totalRevenue)} {sym}</span>
                  </div>
                  <div className="flex justify-between py-2 pl-4 text-sm">
                    <span className="text-muted-foreground">Sales Revenue</span>
                    <span className="text-foreground">{fmt(totalRevenue)} {sym}</span>
                  </div>

                  {/* Cost of Goods */}
                  <div className="flex justify-between py-2 border-b border-border mt-2">
                    <span className="font-semibold text-foreground">Cost of Goods Sold</span>
                    <span className="font-semibold text-red-500">— {sym}</span>
                  </div>
                  <div className="flex justify-between py-2 pl-4 text-sm">
                    <span className="text-muted-foreground">Purchase Cost</span>
                    <span className="text-muted-foreground">Connect suppliers for data</span>
                  </div>

                  {/* Gross Profit */}
                  <div className="flex justify-between py-3 bg-muted/30 rounded-lg px-3 mt-2">
                    <span className="font-bold text-foreground">Gross Profit</span>
                    <span className="font-bold text-green-600 dark:text-green-400">{fmt(totalRevenue)} {sym}</span>
                  </div>

                  {/* VAT */}
                  <div className="flex justify-between py-2 border-b border-border mt-2">
                    <span className="font-semibold text-foreground">VAT (5%)</span>
                    <span className="font-semibold text-orange-500">({fmt(totalRevenue * 0.05 / 1.05)}) {sym}</span>
                  </div>

                  {/* Net Profit */}
                  <div className="flex justify-between py-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl px-3 border border-indigo-200 dark:border-indigo-500/20 mt-3">
                    <span className="font-bold text-lg text-foreground">Net Profit</span>
                    <span className="font-bold text-lg text-indigo-600 dark:text-indigo-400">{fmt(totalRevenue - (totalRevenue * 0.05 / 1.05))} {sym}</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Connect purchase orders &amp; expenses for a complete P&amp;L.
                <Link href="/dashboard/expenses" className="text-primary ml-1 hover:underline">Add Expenses →</Link>
              </p>
            </div>
          )}

          {/* ── Balance Sheet ── */}
          {tab === 'balance' && (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Assets */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="p-4 border-b border-border bg-green-500/5">
                  <h2 className="font-semibold text-foreground flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4 text-green-500" /> Assets
                  </h2>
                </div>
                <div className="p-4 space-y-3">
                  {[
                    { label: 'Cash & Bank',         value: '—',               note: 'Connect bank feed' },
                    { label: 'Accounts Receivable', value: '—',               note: 'Unpaid invoices'   },
                    { label: 'Inventory Value',     value: `${fmt(0)} ${sym}`,   note: 'Stock on hand'     },
                    { label: 'Revenue This Month',  value: `${fmt(totalRevenue)} ${sym}`, note: '' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div>
                        <p className="text-sm text-foreground">{item.label}</p>
                        {item.note && <p className="text-xs text-muted-foreground">{item.note}</p>}
                      </div>
                      <span className="text-sm font-semibold text-foreground">{item.value}</span>
                    </div>
                  ))}
                  <div className="pt-2 flex justify-between font-bold">
                    <span className="text-foreground">Total Assets</span>
                    <span className="text-green-600 dark:text-green-400">{fmt(totalRevenue)} {sym}</span>
                  </div>
                </div>
              </div>

              {/* Liabilities & Equity */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="p-4 border-b border-border bg-red-500/5">
                  <h2 className="font-semibold text-foreground flex items-center gap-2">
                    <ArrowDownRight className="w-4 h-4 text-red-500" /> Liabilities &amp; Equity
                  </h2>
                </div>
                <div className="p-4 space-y-3">
                  {[
                    { label: 'VAT Payable',          value: `${fmt(totalRevenue * 0.05 / 1.05)} ${sym}`, note: 'Due to tax authority' },
                    { label: 'Accounts Payable',     value: '—',    note: 'Unpaid supplier bills'  },
                    { label: 'Subscription Payable', value: '—',    note: 'Platform fees'          },
                    { label: "Owner's Equity",        value: '—',    note: 'Assets minus liabilities'},
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div>
                        <p className="text-sm text-foreground">{item.label}</p>
                        {item.note && <p className="text-xs text-muted-foreground">{item.note}</p>}
                      </div>
                      <span className="text-sm font-semibold text-foreground">{item.value}</span>
                    </div>
                  ))}
                  <div className="pt-2 flex justify-between font-bold">
                    <span className="text-foreground">Total Liabilities</span>
                    <span className="text-red-500">{fmt(totalRevenue * 0.05 / 1.05)} {sym}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Tax Filing ── */}
          {tab === 'tax' && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { label: 'Output VAT (Collected)', value: fmt(totalRevenue * 0.05 / 1.05), color: 'text-green-500' },
                  { label: 'Input VAT (Paid)',        value: '0.00',                           color: 'text-blue-500'  },
                  { label: 'Net VAT Payable',         value: fmt(totalRevenue * 0.05 / 1.05), color: 'text-orange-500'},
                ].map((s) => (
                  <div key={s.label} className="bg-card rounded-xl border border-border p-5 text-center">
                    <p className="text-xs text-muted-foreground mb-2">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{sym}</p>
                  </div>
                ))}
              </div>

              <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-primary" /> VAT Return Summary
                </h2>
                <div className="space-y-2 text-sm">
                  {[
                    ['Standard-rated supplies (5%)', fmt(totalRevenue / 1.05), fmt(totalRevenue * 0.05 / 1.05)],
                    ['Zero-rated supplies (0%)',     '0.00', '0.00'],
                    ['Exempt supplies',              '0.00', '0.00'],
                  ].map(([label, amount, vat]) => (
                    <div key={label} className="grid grid-cols-3 py-2 border-b border-border/50">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="text-foreground text-right">{amount} {sym}</span>
                      <span className="text-foreground text-right">{vat} {sym}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 pt-2">
                  <Link href="/dashboard/reports/vat"
                    className="flex-1 py-2.5 bg-foreground text-background rounded-lg font-medium text-center text-sm transition hover:opacity-90">
                    Full VAT Report
                  </Link>
                  <button type="button"
                    className="flex-1 py-2.5 border border-border rounded-lg text-foreground text-sm hover:bg-muted transition flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" /> Download Return
                  </button>
                </div>
              </div>

              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-sm text-muted-foreground">
                <strong className="text-foreground">UAE VAT:</strong> File quarterly with the Federal Tax Authority (FTA) at uaefta.gov.ae. Deadline is 28 days after the end of the tax period.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
