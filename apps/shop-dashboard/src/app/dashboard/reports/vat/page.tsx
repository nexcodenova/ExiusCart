'use client';

import { useState, useEffect } from 'react';
import { FileText, Download, Loader2, AlertCircle, TrendingUp, TrendingDown, DollarSign, ChevronDown } from 'lucide-react';
import { reportsApi } from '@/lib/api';

const COUNTRY_RATES: Record<string, { label: string; rate: number; currency: string }> = {
  UAE:          { label: 'UAE (5%)',                 rate: 5,  currency: 'AED' },
  SA:           { label: 'Saudi Arabia (15%)',        rate: 15, currency: 'SAR' },
  BH:           { label: 'Bahrain (10%)',             rate: 10, currency: 'BHD' },
  OM:           { label: 'Oman (5%)',                 rate: 5,  currency: 'OMR' },
  LK:           { label: 'Sri Lanka (18%)',           rate: 18, currency: 'LKR' },
  IN:           { label: 'India GST (18%)',           rate: 18, currency: 'INR' },
  GB:           { label: 'UK (20%)',                  rate: 20, currency: 'GBP' },
  EU:           { label: 'EU Standard (20%)',         rate: 20, currency: 'EUR' },
  Custom:       { label: 'Custom rate',              rate: 0,  currency: '' },
};

export default function VatReportPage() {
  const [vatData, setVatData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [country, setCountry] = useState('UAE');
  const [customRate, setCustomRate] = useState(5);
  const [pricesIncludeVat, setPricesIncludeVat] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState<number | null>(null);
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  const vatRate = country === 'Custom' ? customRate : COUNTRY_RATES[country]?.rate ?? 5;

  const fetchReport = async () => {
    if (!shopId) return;
    setLoading(true);
    setError('');
    try {
      const res = await reportsApi.getVatReport(shopId, {
        year,
        quarter: quarter ?? undefined,
        vat_rate: vatRate,
        prices_include_vat: pricesIncludeVat,
      });
      setVatData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load VAT report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, [shopId, year, quarter, vatRate, pricesIncludeVat]);

  const downloadCsv = () => {
    if (!vatData) return;
    const rows = [
      ['Month', 'Gross Sales', 'Sales excl. VAT', 'Output VAT', 'Purchase Cost', 'Input VAT', 'Net VAT Payable'],
      ...vatData.monthly.map((r: any) => [
        r.month, r.sales_total, r.sales_excl_vat, r.output_vat,
        r.purchase_cost, r.input_vat, r.net_vat_payable,
      ]),
      ['TOTAL', '', '',
        vatData.total_output_vat, '',
        vatData.total_input_vat, vatData.total_net_payable,
      ],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vat_report_${year}${quarter ? `_Q${quarter}` : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const currency = country === 'Custom' ? '' : COUNTRY_RATES[country]?.currency || '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">VAT Tax Report</h1>
          <p className="text-muted-foreground text-sm">Output & input tax summary for filing</p>
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          disabled={!vatData}
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Country / Rate */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Country / Rate</label>
            <div className="relative">
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none appearance-none"
              >
                {Object.entries(COUNTRY_RATES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Custom rate input */}
          {country === 'Custom' && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Custom VAT %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={customRate}
                onChange={(e) => setCustomRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
          )}

          {/* Year */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Year</label>
            <input
              type="number"
              min={2020}
              max={2030}
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Quarter */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Quarter</label>
            <div className="relative">
              <select
                value={quarter ?? ''}
                onChange={(e) => setQuarter(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:outline-none appearance-none"
              >
                <option value="">Full Year</option>
                <option value="1">Q1 (Jan–Mar)</option>
                <option value="2">Q2 (Apr–Jun)</option>
                <option value="3">Q3 (Jul–Sep)</option>
                <option value="4">Q4 (Oct–Dec)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Prices include VAT */}
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={pricesIncludeVat}
                onChange={(e) => setPricesIncludeVat(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground">Prices include VAT</span>
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : vatData ? (
        <>
          {/* TRN / Tax Number */}
          {vatData.tax_number && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <p className="text-sm text-muted-foreground">Tax Registration Number (TRN)</p>
              <p className="text-lg font-bold text-foreground">{vatData.tax_number}</p>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-muted-foreground text-sm">Total Output VAT</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{fmt(vatData.total_output_vat)}</p>
              <p className="text-xs text-muted-foreground mt-1">{currency} — collected from customers</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-muted-foreground text-sm">Total Input VAT</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{fmt(vatData.total_input_vat)}</p>
              <p className="text-xs text-muted-foreground mt-1">{currency} — paid on purchases</p>
            </div>
            <div className={`bg-card rounded-xl border p-5 ${vatData.total_net_payable >= 0 ? 'border-orange-500/30' : 'border-green-500/30'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${vatData.total_net_payable >= 0 ? 'bg-orange-500/10' : 'bg-green-500/10'}`}>
                  <DollarSign className={`w-5 h-5 ${vatData.total_net_payable >= 0 ? 'text-orange-500' : 'text-green-500'}`} />
                </div>
                <p className="text-muted-foreground text-sm">Net VAT Payable</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{fmt(Math.abs(vatData.total_net_payable))}</p>
              <p className={`text-xs mt-1 ${vatData.total_net_payable >= 0 ? 'text-orange-500' : 'text-green-500'}`}>
                {vatData.total_net_payable >= 0 ? `${currency} due to tax authority` : `${currency} refund due to you`}
              </p>
            </div>
          </div>

          {/* Monthly breakdown */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">Monthly Breakdown — {vatRate}% VAT</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {['Period', 'Gross Sales', 'Sales excl. VAT', 'Output VAT', 'Purchase Cost', 'Input VAT', 'Net Payable'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {vatData.monthly.map((row: any) => (
                    <tr key={row.month} className="hover:bg-muted/30 transition">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {new Date(row.month + '-01').toLocaleDateString('en-AE', { month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-foreground">{fmt(row.sales_total)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmt(row.sales_excl_vat)}</td>
                      <td className="px-4 py-3 text-green-600 dark:text-green-400 font-medium">{fmt(row.output_vat)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmt(row.purchase_cost)}</td>
                      <td className="px-4 py-3 text-blue-600 dark:text-blue-400 font-medium">{fmt(row.input_vat)}</td>
                      <td className={`px-4 py-3 font-bold ${row.net_vat_payable >= 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                        {row.net_vat_payable >= 0 ? '' : '−'}{fmt(Math.abs(row.net_vat_payable))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/50 border-t border-border">
                  <tr>
                    <td className="px-4 py-3 font-bold text-foreground">Total</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 font-bold text-green-600 dark:text-green-400">{fmt(vatData.total_output_vat)}</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 font-bold text-blue-600 dark:text-blue-400">{fmt(vatData.total_input_vat)}</td>
                    <td className={`px-4 py-3 font-bold text-lg ${vatData.total_net_payable >= 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                      {vatData.total_net_payable >= 0 ? '' : '−'}{fmt(Math.abs(vatData.total_net_payable))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* VAT filing note */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-sm text-muted-foreground">
            <strong className="text-foreground">Filing Note:</strong> Output VAT is the tax you collected from customers. Input VAT is the tax you paid on business purchases. Net VAT Payable = Output − Input. File your return with the tax authority by the deadline for your jurisdiction.
          </div>
        </>
      ) : null}
    </div>
  );
}
