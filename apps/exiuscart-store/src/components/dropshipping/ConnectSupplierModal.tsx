'use client';

// "Connect Supplier" picker, same pattern as the sales-channel one: pick a
// supplier and its own card opens its real connect flow (key window, or the
// AliExpress sign-in), so plan locks and checks stay in one place.

import { Lock, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import SupplierBadge from './SupplierBadge';
import type { Supplier } from './SupplierCard';

export const OPEN_SUPPLIER_CONNECT = 'open-supplier-connect';

export default function ConnectSupplierModal({ open, onClose, suppliers }: {
  open: boolean;
  onClose: () => void;
  suppliers: Supplier[];
}) {
  const connectable = suppliers.filter((s) => !s.connected);
  const label = (s: Supplier) => (s.category === 'pod' ? 'Print on demand' : 'Dropshipping supplier');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Connect a supplier</DialogTitle>
          <DialogDescription>Pick a supplier below and its connection screen opens.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 p-5 pt-0">
          {connectable.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Every supplier is already connected.</p>
          )}
          {connectable.map((s) => (
            <button key={s.supplier_type} type="button"
              onClick={() => { window.dispatchEvent(new CustomEvent(OPEN_SUPPLIER_CONNECT, { detail: s.supplier_type })); onClose(); }}
              className="flex w-full items-center gap-3 rounded-xl border border-border px-3.5 py-3 text-left transition hover:border-primary/30 hover:bg-muted">
              <SupplierBadge supplier={s.supplier_type} label={false} size={36} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{s.name}</p>
                <p className="truncate text-xs text-muted-foreground">{label(s)}</p>
              </div>
              {s.locked ? <Lock className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
