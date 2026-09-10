import { Card, CardContent } from '@/components/ui/card';
import { ShoppingBag, Tag, Music2, ShoppingCart, Package, Truck, Boxes } from 'lucide-react';
import { channelMeta } from '@/components/channel-listings/channelMeta';
import ChannelLogo from '@/components/channel-listings/ChannelLogo';

// Real brand logo when one exists in /public/channel-logos (see ChannelLogo),
// otherwise the brand-coloured icon chip — same treatment as each channel's
// own card.
const SOURCE_NODES = [
  { label: 'Shopify', channelType: 'shopify', icon: ShoppingBag, className: 'bg-[#96BF48]/10 text-[#96BF48]' },
  { label: 'Amazon', channelType: 'amazon', icon: Package, className: 'bg-orange-400/10 text-orange-500' },
  { label: 'eBay', channelType: 'ebay', icon: Tag, className: 'bg-[#E53238]/10 text-[#E53238]' },
  { label: 'Etsy', channelType: 'etsy', icon: ShoppingBag, className: 'bg-orange-600/10 text-orange-600' },
  { label: 'TikTok Shop', channelType: 'tiktok', icon: Music2, className: 'bg-foreground/10 text-foreground' },
  { label: 'Noon', channelType: 'noon', icon: ShoppingBag, className: 'bg-yellow-500/10 text-yellow-600' },
  { label: 'Daraz', channelType: 'daraz', icon: ShoppingBag, className: 'bg-orange-500/10 text-orange-500' },
];

const OUTPUT_NODES = [
  { label: 'Unified Orders', icon: ShoppingCart },
  { label: 'Suppliers', icon: Boxes },
  { label: 'Fulfillment', icon: Truck },
];

// Purely illustrative, full-width, sits at the very end of the page — the
// "one platform, every channel" idea from the design brief, moved out of
// the right rail per feedback so it has room to breathe.
export default function FlowDiagram() {
  return (
    <Card>
      <CardContent className="p-6 sm:p-8">
        <div className="text-center mb-8">
          <h3 className="text-base font-bold text-foreground">The ExiusCart Advantage</h3>
          <p className="text-sm text-muted-foreground mt-1">Multiple channels. One platform. Total control.</p>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-6">
          {/* Sources */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:flex md:flex-col gap-2.5">
            {SOURCE_NODES.map((node) => (
              <div key={node.label} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card">
                <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 overflow-hidden ${node.className}`}>
                  {channelMeta(node.channelType).logo
                    ? <ChannelLogo channelType={node.channelType} size={14} />
                    : <node.icon className="w-3.5 h-3.5" />}
                </span>
                <span className="text-xs font-medium text-foreground whitespace-nowrap">{node.label}</span>
              </div>
            ))}
          </div>

          {/* Connector */}
          <div className="hidden md:block flex-1 max-w-[80px] h-px bg-gradient-to-r from-border via-primary/40 to-primary/40" />

          <div className="shrink-0 flex flex-col items-center gap-1.5 mx-2">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
              <Package className="w-7 h-7 text-primary" />
            </div>
            <span className="text-xs font-bold text-foreground">EXIUSCART</span>
          </div>

          <div className="hidden md:block flex-1 max-w-[80px] h-px bg-gradient-to-r from-primary/40 via-primary/40 to-border" />

          {/* Outputs */}
          <div className="flex flex-col gap-2.5">
            {OUTPUT_NODES.map((node) => (
              <div key={node.label} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/20 bg-primary/[0.04]">
                <span className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <node.icon className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-semibold text-foreground whitespace-nowrap">{node.label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
