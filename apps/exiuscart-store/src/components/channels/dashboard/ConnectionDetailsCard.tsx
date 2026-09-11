'use client';

import { useState } from 'react';
import { ExternalLink, KeyRound, Trash2, Copy, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { channelsApi } from '@/lib/api';
import { timeAgo, type ChannelDashboardConnection } from './types';

const SELLER_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  approved: { label: 'Running smoothly', className: 'text-green-600 dark:text-green-400' },
  suspended: { label: 'Suspended', className: 'text-red-600 dark:text-red-400' },
  rejected: { label: 'Not approved', className: 'text-red-600 dark:text-red-400' },
};

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className="text-xs font-semibold text-foreground">{children}</div>
    </div>
  );
}

export default function ConnectionDetailsCard({
  shopId, channelLabel, siteUrl, connection, onDisconnected, onWebhookRotated,
}: {
  shopId: string;
  channelLabel: string;
  siteUrl?: string | null;
  connection: ChannelDashboardConnection;
  onDisconnected: () => void;
  onWebhookRotated: (webhookUrl: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const copyWebhook = () => {
    navigator.clipboard.writeText(connection.webhook_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const r = await channelsApi.regenerateWebhook(shopId, connection.id);
      onWebhookRotated(r.data?.webhook_url ?? connection.webhook_url);
    } finally {
      setRegenerating(false);
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      await channelsApi.disconnectChannel(shopId, connection.id);
      onDisconnected();
    } finally {
      setDisconnecting(false);
    }
  };

  const status = connection.seller_status ? SELLER_STATUS_LABEL[connection.seller_status] : SELLER_STATUS_LABEL.approved;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="text-sm font-bold text-foreground">Connection Details</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Your active connection between ExiusCart and {channelLabel}.</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoRow label="Store Name">{channelLabel}</InfoRow>
          {siteUrl ? (
            <InfoRow label="Store URL">
              <a href={siteUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{siteUrl.replace(/^https?:\/\//, '')}</a>
            </InfoRow>
          ) : (
            <InfoRow label="Seller ID">{connection.channel_seller_id || '—'}</InfoRow>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">Webhook URL</label>
          <div className="flex gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-muted px-3 py-2.5 font-mono text-[10px] text-muted-foreground">
              {connection.webhook_url}
            </code>
            <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={copyWebhook} title="Copy">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <InfoRow label="Connected On">
            {connection.created_at ? new Date(connection.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
          </InfoRow>
          <InfoRow label="Last Sync">{timeAgo(connection.last_synced_at)}</InfoRow>
          <InfoRow label="Connection Method">API + Webhook</InfoRow>
          <div>
            <div className="mb-1 text-[11px] font-semibold text-muted-foreground">Sync Status</div>
            <div className={`flex items-center gap-2 text-xs font-semibold ${status.className}`}>
              <span className={`h-2 w-2 rounded-full ${connection.seller_status && connection.seller_status !== 'approved' ? 'bg-red-500' : 'bg-green-500'}`} />
              {status.label}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
          {siteUrl && (
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <a href={siteUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="w-3.5 h-3.5" /> View site
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" className="flex-1" onClick={regenerate} disabled={regenerating}>
            <KeyRound className="w-3.5 h-3.5" /> {regenerating ? 'Regenerating…' : 'Regenerate Webhook'}
          </Button>
          {confirming ? (
            <div className="flex items-center gap-2">
              <Button variant="destructive" size="sm" onClick={disconnect} disabled={disconnecting}>
                {disconnecting ? 'Disconnecting…' : 'Confirm'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={disconnecting}>Cancel</Button>
            </div>
          ) : (
            <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
              <Trash2 className="w-3.5 h-3.5" /> Disconnect
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
