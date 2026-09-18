interface LowPerformer { name: string; views: number; units_sold: number; conversion_pct: number }

// "Low performers" = real traffic (10+ views) but a weak view-to-sale
// conversion — surfaces listings worth rewriting/repricing, not just
// low-traffic products that were never going to sell much anyway.
export default function LowPerformersTable({ data }: { data: LowPerformer[] }) {
  if (!data.length) {
    return <p className="text-sm text-muted-foreground py-10 text-center">Not enough product view data yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide border-b border-border">
            <th className="py-2 pr-4 font-medium">Product</th>
            <th className="py-2 pr-4 font-medium text-right">Views</th>
            <th className="py-2 pr-4 font-medium text-right">Units sold</th>
            <th className="py-2 font-medium text-right">Conversion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((p, i) => (
            <tr key={i}>
              <td className="py-2.5 pr-4 text-foreground font-medium truncate max-w-xs">{p.name}</td>
              <td className="py-2.5 pr-4 text-right text-foreground tabular-nums">{p.views.toLocaleString()}</td>
              <td className="py-2.5 pr-4 text-right text-foreground tabular-nums">{p.units_sold}</td>
              <td className="py-2.5 text-right tabular-nums text-destructive">{p.conversion_pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
