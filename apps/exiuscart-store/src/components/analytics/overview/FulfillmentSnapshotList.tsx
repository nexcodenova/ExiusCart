const STATUS_LABEL: Record<string, string> = {
  unfulfilled: 'Unfulfilled', sent: 'Sent to supplier', processing: 'Processing',
  shipped: 'Shipped', delivered: 'Delivered', failed: 'Failed',
};

const STATUS_COLOR: Record<string, string> = {
  unfulfilled: 'bg-gray-400', sent: 'bg-blue-500', processing: 'bg-amber-500',
  shipped: 'bg-violet-500', delivered: 'bg-emerald-500', failed: 'bg-destructive',
};

export default function FulfillmentSnapshotList({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (!total) {
    return <p className="text-sm text-muted-foreground py-10 text-center">No orders in the last 30 days.</p>;
  }
  return (
    <div className="space-y-3">
      {entries.map(([status, count]) => (
        <div key={status} className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLOR[status] ?? 'bg-gray-400'}`} />
          <span className="text-sm text-foreground flex-1">{STATUS_LABEL[status] ?? status}</span>
          <span className="text-sm font-semibold text-foreground tabular-nums">{count}</span>
          <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{Math.round((count / total) * 100)}%</span>
        </div>
      ))}
    </div>
  );
}
