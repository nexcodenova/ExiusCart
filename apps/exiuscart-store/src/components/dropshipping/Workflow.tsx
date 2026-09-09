import { Card, CardContent } from '@/components/ui/card';
import { ShoppingBag, Package, RefreshCcw, Truck, CircleDot, CheckCircle2, ArrowRight } from 'lucide-react';

const STEPS = [
  { title: 'Your Store', icon: ShoppingBag, status: 'Store connected' },
  { title: 'Customer Order', icon: Package, status: 'Order received' },
  { title: 'ExiusCart', icon: RefreshCcw, status: 'Order routed' },
  { title: 'Connected Supplier', icon: Truck, status: 'Supplier notified' },
  { title: 'Supplier Fulfills', icon: Package, status: 'Processing' },
  { title: 'Tracking Number', icon: CircleDot, status: 'Synced' },
  { title: 'Customer Updated', icon: CheckCircle2, status: 'Completed' },
];

// Illustrative, matches the shape of DropshipOrder's own real states
// (pending → processing → shipped → delivered) without pretending this is
// live data — same treatment as the Sales Channels page's FlowDiagram.
export default function Workflow() {
  return (
    <Card>
      <CardContent className="p-6 sm:p-8">
        <div className="text-center mb-8">
          <h3 className="text-base font-bold text-foreground">One connection. Complete fulfillment workflow.</h3>
          <p className="text-sm text-muted-foreground mt-1">ExiusCart sits between your sales channels, customers and suppliers.</p>
        </div>

        {/* Desktop: horizontal chain */}
        <div className="hidden xl:flex items-start justify-between">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex flex-1 items-start">
              <div className="text-center px-1">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <step.icon className="w-5 h-5" />
                </div>
                <p className="mt-2.5 text-xs font-bold text-foreground whitespace-nowrap">{step.title}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{step.status}</p>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex items-center flex-1 mt-6 mx-1">
                  <div className="h-px flex-1 bg-gradient-to-r from-primary/30 to-primary/10" />
                  <ArrowRight className="w-3.5 h-3.5 text-primary/40 shrink-0" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Mobile/tablet: vertical list */}
        <div className="space-y-2.5 xl:hidden">
          {STEPS.map((step) => (
            <div key={step.title} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <step.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">{step.title}</p>
                <p className="text-[10px] text-muted-foreground">{step.status}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
