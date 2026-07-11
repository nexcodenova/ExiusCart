'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[DashboardError]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
      </div>
      <h2 className="mb-2 text-xl font-bold text-foreground">Something went wrong</h2>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        This page hit an unexpected error. Try refreshing — if the problem persists, contact support.
      </p>
      {error?.message && (
        <p className="mb-5 rounded-lg bg-muted px-4 py-2 font-mono text-xs text-muted-foreground">
          {error.message}
        </p>
      )}
      <button
        onClick={() => reset()}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
      >
        <RefreshCcw className="h-4 w-4" /> Retry
      </button>
    </div>
  );
}
