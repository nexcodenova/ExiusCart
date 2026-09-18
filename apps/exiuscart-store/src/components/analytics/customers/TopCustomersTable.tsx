interface TopCustomer { name: string; orders: number; ltv: number }

export default function TopCustomersTable({ data, fmt }: { data: TopCustomer[]; fmt: (n: number) => string }) {
  if (!data.length) {
    return <p className="text-sm text-muted-foreground py-10 text-center">No customer orders yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide border-b border-border">
            <th className="py-2 pr-4 font-medium">Customer</th>
            <th className="py-2 pr-4 font-medium text-right">Orders</th>
            <th className="py-2 font-medium text-right">Lifetime value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((c, i) => (
            <tr key={i}>
              <td className="py-2.5 pr-4 text-foreground font-medium">{c.name}</td>
              <td className="py-2.5 pr-4 text-right text-foreground tabular-nums">{c.orders}</td>
              <td className="py-2.5 text-right text-foreground font-semibold tabular-nums">{fmt(c.ltv)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
