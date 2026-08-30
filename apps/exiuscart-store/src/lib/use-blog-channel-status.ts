import { useState, useEffect } from 'react';
import { channelsApi, shopifyApi } from '@/lib/api';

// Blog publishes to the Custom Website, Shopify, and now WooCommerce (via
// a real WordPress Posts API push, see blog.py's _push_to_woocommerce) —
// the only channels with any concept of a "blog" to receive it. Shared by
// the blog list page and the editor, since a seller can land on either
// directly.
export function useBlogChannelStatus(shopId: string) {
  const [checking, setChecking] = useState(true);
  const [isTheDersiUser, setIsTheDersiUser] = useState(false);
  const [hasAnyChannel, setHasAnyChannel] = useState(false);
  const [wooConnected, setWooConnected] = useState(false);

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
      const hasWoo = conns.some((c) => c.channel_type === 'woocommerce');
      setWooConnected(hasWoo);
      setHasAnyChannel(hasCustom || hasWoo || !!shopifyRes.data?.connected);
    }).catch(() => {}).finally(() => setChecking(false));
  }, [shopId]);

  return { checking, isTheDersiUser, hasAnyChannel, wooConnected };
}
