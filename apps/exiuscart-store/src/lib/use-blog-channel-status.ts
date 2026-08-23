import { useState, useEffect } from 'react';
import { channelsApi, shopifyApi } from '@/lib/api';

// Blog only publishes to the Custom Website and Shopify — the only two
// channels with any concept of a "blog" to receive it. Shared by the blog
// list page and the editor, since a seller can land on either directly.
export function useBlogChannelStatus(shopId: string) {
  const [checking, setChecking] = useState(true);
  const [isTheDersiUser, setIsTheDersiUser] = useState(false);
  const [hasAnyChannel, setHasAnyChannel] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    setChecking(true);
    Promise.all([
      channelsApi.getConnections(shopId),
      shopifyApi.getStatus(shopId).catch(() => ({ data: { connected: false } })),
    ]).then(([connRes, shopifyRes]) => {
      const conns: any[] = connRes.data ?? [];
      setIsTheDersiUser(conns.some((c) => c.channel_type === 'thedersi'));
      const hasCustom = conns.some((c) => c.channel_type === 'custom');
      setHasAnyChannel(hasCustom || !!shopifyRes.data?.connected);
    }).catch(() => {}).finally(() => setChecking(false));
  }, [shopId]);

  return { checking, isTheDersiUser, hasAnyChannel };
}
