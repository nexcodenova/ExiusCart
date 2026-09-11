import { CheckCircle2, Clock, XCircle, RotateCcw } from 'lucide-react';

const PAYMENT_META: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  paid: { label: 'Paid', className: 'bg-green-500/10 text-green-600 dark:text-green-400', icon: CheckCircle2 },
  pending: { label: 'Pending', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', icon: Clock },
  failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive', icon: XCircle },
  refunded: { label: 'Refunded', className: 'bg-muted text-muted-foreground', icon: RotateCcw },
};

export function PaymentBadge({ status }: { status: string }) {
  const m = PAYMENT_META[status] ?? { label: status, className: 'bg-muted text-muted-foreground', icon: Clock };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full ${m.className}`}>
      <m.icon className="w-3 h-3" /> {m.label}
    </span>
  );
}

// Colours map to the real fulfillment_key from the backend (awaiting/
// processing/shipped/delivered/cancelled/failed) — no fabricated "On hold"
// state exists here; a payment failure surfaces via needs_attention instead.
const FULFILLMENT_CLASS: Record<string, string> = {
  awaiting: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  processing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  shipped: 'bg-primary/10 text-primary',
  delivered: 'bg-green-500/10 text-green-600 dark:text-green-400',
  cancelled: 'bg-muted text-muted-foreground',
  failed: 'bg-destructive/10 text-destructive',
};

export function FulfillmentBadge({ fulfillmentKey, label }: { fulfillmentKey: string; label: string }) {
  const className = FULFILLMENT_CLASS[fulfillmentKey] ?? 'bg-muted text-muted-foreground';
  return <span className={`inline-flex items-center text-xs font-semibold px-2 py-1 rounded-full ${className}`}>{label}</span>;
}
