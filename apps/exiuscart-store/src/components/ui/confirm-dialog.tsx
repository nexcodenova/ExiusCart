'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog';
import { AlertTriangle, HelpCircle } from 'lucide-react';

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** 'destructive' for anything that deletes/disconnects/cancels — red accent, red confirm button. */
  variant?: 'default' | 'destructive';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Drop-in replacement for window.confirm() — same "await confirm(...)"
 * call shape, but a real styled dialog instead of the browser's native
 * "site says" popup. One instance mounted at the dashboard layout root;
 * every page/component just calls useConfirm(), no local modal state to
 * wire up per call site.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({});
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = (result: boolean) => {
    setOpen(false);
    resolverRef.current?.(result);
    resolverRef.current = null;
  };

  const isDestructive = options.variant === 'destructive';
  const Icon = isDestructive ? AlertTriangle : HelpCircle;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={open} onOpenChange={(o) => { if (!o) settle(false); }}>
        <DialogContent showCloseButton={false} className="max-w-sm">
          <div className="p-5 flex items-start gap-3.5">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isDestructive ? 'bg-destructive/10' : 'bg-primary/10'}`}>
              <Icon className={`w-5 h-5 ${isDestructive ? 'text-destructive' : 'text-primary'}`} />
            </div>
            <div className="pt-0.5">
              <DialogTitle className="text-base">{options.title ?? 'Are you sure?'}</DialogTitle>
              {options.description && (
                <DialogDescription className="mt-1.5 text-sm leading-relaxed">{options.description}</DialogDescription>
              )}
            </div>
          </div>
          <div className="flex gap-3 px-5 pb-5">
            <button
              type="button"
              onClick={() => settle(false)}
              className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition"
            >
              {options.cancelText ?? 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => settle(true)}
              autoFocus
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
                isDestructive
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {options.confirmText ?? 'Confirm'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}
