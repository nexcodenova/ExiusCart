import { CheckCircle2, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';

export type ListingStatus = 'success' | 'failed' | 'processing' | 'warning';

const META: Record<ListingStatus, { label: string; icon: React.ElementType; className: string }> = {
  success: { label: 'Success', icon: CheckCircle2, className: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  failed: { label: 'Failed', icon: XCircle, className: 'bg-destructive/10 text-destructive' },
  processing: { label: 'Processing', icon: RefreshCw, className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  warning: { label: 'Warning', icon: AlertTriangle, className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
};

export default function StatusBadge({ status }: { status: ListingStatus }) {
  const m = META[status] ?? META.success;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full ${m.className}`}>
      <m.icon className="w-3 h-3" /> {m.label}
    </span>
  );
}
