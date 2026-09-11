import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Lock, ChevronRight } from 'lucide-react';
import type { ChannelDef } from './ChannelCard';
import { channelMeta } from '@/components/channels/channelMeta';
import ChannelLogo from '@/components/channels/ChannelLogo';

// Deliberately NOT a generic multi-step "enter store URL, fake OAuth"
// wizard the way a from-scratch mockup would build it — every channel here
// already has its own real connect flow (OAuth redirect, or its own
// credentials page) living at /dashboard/{channel}-integration. This modal
// is just a faster way to reach the right one: pick a channel, and it fires
// that channel's own real onAction (the exact same handler its card uses),
// so every plan-gate/TheDersi-lock/upgrade-prompt still applies identically.
export default function ConnectChannelModal({
  open,
  onClose,
  channels,
}: {
  open: boolean;
  onClose: () => void;
  channels: ChannelDef[];
}) {
  const connectable = channels.filter((c) => c.badge !== 'live');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Connect a sales channel</DialogTitle>
          <DialogDescription>Pick a channel below — you'll be taken straight to its connection screen.</DialogDescription>
        </DialogHeader>
        <div className="p-5 pt-0 grid gap-2">
          {connectable.map((channel) => (
            <button
              key={channel.id}
              onClick={() => { channel.onAction?.(); onClose(); }}
              disabled={!channel.onAction}
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border border-border hover:bg-muted hover:border-primary/30 transition text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-9 h-9 rounded-lg bg-muted/70 ring-1 ring-border flex items-center justify-center shrink-0 overflow-hidden">
                {channel.channelType && channelMeta(channel.channelType).logo
                  ? <ChannelLogo channelType={channel.channelType} size={20} />
                  : channel.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{channel.name}</p>
                <p className="text-xs text-muted-foreground truncate">{channel.category}</p>
              </div>
              {channel.badge === 'locked' ? (
                <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
