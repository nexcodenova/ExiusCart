interface BestSeller { name: string; units_sold: number; revenue: number; margin_pct: number | null }

export default function BestSellersTable({ data, fmt }: { data: BestSeller[]; fmt: (n: number) => string }) {
  if (!data.length) {
    return <p className="text-sm text-muted-foreground py-10 text-center">No sales in the last 30 days.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide border-b border-border">
            <th className="py-2 pr-4 font-medium">Product</th>
            <th className="py-2 pr-4 font-medium text-right">Units sold</th>
            <th className="py-2 pr-4 font-medium text-right">Revenue</th>
            <th className="py-2 font-medium text-right">Margin</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((p, i) => (
            <tr key={i}>
              <td className="py-2.5 pr-4 text-foreground font-medium truncate max-w-xs">{p.name}</td>
              <td className="py-2.5 pr-4 text-right text-foreground tabular-nums">{p.units_sold}</td>
              <td className="py-2.5 pr-4 text-right text-foreground tabular-nums">{fmt(p.revenue)}</td>
              <td className="py-2.5 text-right tabular-nums">
                {p.margin_pct === null ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  <span className={p.margin_pct >= 30 ? 'text-emerald-600' : p.margin_pct >= 10 ? 'text-amber-600' : 'text-destructive'}>
                    {p.margin_pct}%
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
