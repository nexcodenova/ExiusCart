import { Card, CardContent } from '@/components/ui/card';
import { ShoppingCart, Package, Truck, Boxes } from 'lucide-react';
import { channelMeta } from '@/components/channels/channelMeta';
import ChannelLogo from '@/components/channels/ChannelLogo';

// Every channel ExiusCart can pull from — real brand logo when one exists
// in /public/channel-logos (see ChannelLogo), otherwise the brand-coloured
// icon chip. Laid out as two vertical columns.
const SOURCE_CHANNELS = [
  'shopify', 'ebay',
  'woocommerce', 'etsy',
  'bigcommerce', 'amazon',
  'wix', 'walmart',
  'custom', 'tiktok',
  'thedersi', 'instagram',
  'whop', 'noon',
  'gumroad', 'daraz',
  'trendyol', 'jumia',
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
          {/* Sources — every channel, two columns */}
          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:min-w-[320px]">
            {SOURCE_CHANNELS.map((ct) => {
              const meta = channelMeta(ct);
              const Icon = meta.icon;
              return (
                <div key={ct} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border bg-card min-w-0">
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 overflow-hidden ${meta.bg}`}>
                    {meta.logo
                      ? <ChannelLogo channelType={ct} size={14} />
                      : <Icon className={`w-3.5 h-3.5 ${meta.color}`} />}
                  </span>
                  <span className="text-xs font-medium text-foreground truncate">{meta.label}</span>
                </div>
              );
            })}
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
