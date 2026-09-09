import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ExternalLink } from 'lucide-react';

export interface ConnectedSupplierRow {
  supplierType: string;
  name: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  products: number;
  orders: number;
  fulfilled: number;
  dashboardUrl: string;
}

// Read-only — real per-supplier counts from /dropship/stats
// (DropshipProductLink/DropshipOrder), no duplicate disconnect/auto-fulfill
// controls here since those already live on each supplier's own card above
// this table; this is purely a denser overview.
export default function ConnectedSuppliersTable({ rows }: { rows: ConnectedSupplierRow[] }) {
  if (rows.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-border">
        <h2 className="text-lg font-bold text-foreground">Your connected suppliers</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Real product and order counts per supplier.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-muted/50 text-left border-b border-border">
              {['Supplier', 'Status', 'Products', 'Orders', 'Fulfillment', 'Actions'].map((h) => (
                <th key={h} className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rate = row.orders > 0 ? Math.round((row.fulfilled / row.orders) * 100) : null;
              return (
                <tr key={row.supplierType} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${row.bg}`}>
                        <row.icon className={`w-4 h-4 ${row.color}`} />
                      </span>
                      <span className="text-xs font-bold text-foreground">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-green-600">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs font-semibold text-foreground">{row.products.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-xs font-semibold text-foreground">{row.orders.toLocaleString()}</td>
                  <td className="px-5 py-3.5">
                    {rate === null ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-600">{rate}%</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                      <a href={row.dashboardUrl} target="_blank" rel="noopener noreferrer">Open <ExternalLink className="w-3 h-3" /></a>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
