interface SupplierRow { supplier: string; statuses: Record<string, number>; total: number }

export default function SupplierPerformanceTable({ data }: { data: SupplierRow[] }) {
  if (!data.length) {
    return <p className="text-sm text-muted-foreground py-10 text-center">No dropship orders in the last 30 days.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide border-b border-border">
            <th className="py-2 pr-4 font-medium">Supplier</th>
            <th className="py-2 pr-4 font-medium text-right">Total orders</th>
            <th className="py-2 pr-4 font-medium text-right">Delivered</th>
            <th className="py-2 font-medium text-right">Failed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((s) => (
            <tr key={s.supplier}>
              <td className="py-2.5 pr-4 text-foreground font-medium">{s.supplier}</td>
              <td className="py-2.5 pr-4 text-right text-foreground tabular-nums">{s.total}</td>
              <td className="py-2.5 pr-4 text-right text-emerald-600 tabular-nums">{s.statuses.delivered ?? 0}</td>
              <td className="py-2.5 text-right tabular-nums">
                {(s.statuses.failed ?? 0) > 0 ? <span className="text-destructive">{s.statuses.failed}</span> : <span className="text-muted-foreground">0</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
