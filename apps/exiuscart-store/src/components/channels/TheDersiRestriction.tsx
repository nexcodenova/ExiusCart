'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { channelsApi } from '@/lib/api';
import ChannelLogo from './ChannelLogo';
import { channelMeta } from './channelMeta';

// The real gate lives server-side (connect_channel in channels.py 403s
// anything but thedersi/daraz for a TheDersi-managed shop) — this is just
// the UI catching up so a TheDersi seller doesn't fill in an API key and
// hit "Connect" only to get a raw 403. Every restricted integration page's
// own URL was always directly reachable (typed, bookmarked, or linked from
// the Documentation page's channel cards) with no client-side check at
// all — this closes that gap consistently instead of only where a user
// happened to run into it.
export function useIsTheDersiUser(shopId: string): boolean | null {
  const [isTheDersiUser, setIsTheDersiUser] = useState<boolean | null>(null); // null = still checking
  useEffect(() => {
    if (!shopId) return;
    channelsApi.getConnections(shopId).then((r) => {
      setIsTheDersiUser((r.data ?? []).some((c: any) => c.channel_type === 'thedersi'));
    }).catch(() => setIsTheDersiUser(false));
  }, [shopId]);
  return isTheDersiUser;
}

export default function TheDersiRestrictionNotice({ channelKey }: { channelKey: string }) {
  const meta = channelMeta(channelKey);
  return (
    <div className="bg-card border border-border rounded-xl p-6 text-center max-w-md mx-auto">
      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
        <ChannelLogo channelType={channelKey} size={28} />
      </div>
      <p className="font-semibold text-foreground">{meta.label}</p>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
        {meta.label} is only available for direct ExiusCart sellers. Your store is managed by TheDersi — you can sell on <strong className="text-foreground">TheDersi</strong>, and on <strong className="text-foreground">Daraz</strong> with TheDersi Pro.
      </p>
      <Link href="/dashboard/channels" className="mt-4 inline-flex items-center justify-center w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">
        Back to Sales Channels
      </Link>
    </div>
  );
}
