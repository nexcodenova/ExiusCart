'use client';

import { useEffect, useState } from 'react';

// Shared load/lock/error pattern for all 6 Analytics pages — each one just
// passes its own analyticsApi.* call in. Locked (Growth/Scale only, per
// app/api/v1/endpoints/analytics.py) surfaces as `locked`, never a blank
// or broken page.
export function useAnalyticsData<T>(fetcher: (shopId: string) => Promise<{ data: T }>) {
  const [shopId, setShopId] = useState('');
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);

  useEffect(() => { setShopId(localStorage.getItem('shop_id') || '1'); }, []);

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    setLocked(false);
    fetcher(shopId)
      .then((r) => setData(r.data))
      .catch((e: any) => {
        if (e?.response?.data?.detail?.error === 'upgrade_required') setLocked(true);
      })
      .finally(() => setLoading(false));
    // fetcher is a stable module-level function reference passed by each page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  return { data, loading, locked };
}
