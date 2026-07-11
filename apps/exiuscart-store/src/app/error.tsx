'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
      </div>
      <h2 className="mb-2 text-xl font-bold">Something went wrong</h2>
      <p className="mb-6 max-w-md text-sm text-gray-500">
        The page hit an unexpected error. Try refreshing.
      </p>
      <button
        onClick={() => reset()}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        <RefreshCcw className="h-4 w-4" /> Retry
      </button>
    </div>
  );
}
