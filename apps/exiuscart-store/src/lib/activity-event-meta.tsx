import {
  Bell, PackagePlus, CreditCard as CreditCardIcon, PackageX, Truck, CheckCircle2, XCircle,
} from 'lucide-react';

export interface ActivityEvent {
  id: number;
  event_type: string;
  title: string;
  description: string | null;
  created_at: string | null;
  is_read: boolean;
}

// Shared between the header's notification dropdown and the full
// notifications page so their icon/color mapping never drifts apart.
export const ACTIVITY_EVENT_META: Record<string, { icon: React.ElementType; className: string }> = {
  order_created: { icon: PackagePlus, className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  payment_received: { icon: CreditCardIcon, className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  stock_low: { icon: PackageX, className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  order_shipped: { icon: Truck, className: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' },
  order_delivered: { icon: CheckCircle2, className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  order_cancelled: { icon: XCircle, className: 'bg-red-500/10 text-red-500' },
};

export const DEFAULT_ACTIVITY_EVENT_META = { icon: Bell, className: 'bg-muted text-muted-foreground' };

export function activityTimeAgo(iso: string | null): string {
  if (!iso) return '';
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
