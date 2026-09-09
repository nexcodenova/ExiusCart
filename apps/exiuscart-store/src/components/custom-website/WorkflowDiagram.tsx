import { Globe, Send, RefreshCcw, CreditCard, Boxes, ArrowLeftRight, ArrowRight } from 'lucide-react';

const STEPS = [
  { title: 'Your Website', icon: Globe, status: 'Customer checks out' },
  { title: 'Webhook URL', icon: Send, status: 'POST order + secret URL' },
  { title: 'ExiusCart', icon: RefreshCcw, status: 'Order created' },
  { title: 'Payment Gateway', icon: CreditCard, status: 'Confirms payment' },
  { title: 'Stock Updated', icon: Boxes, status: 'Inventory decremented' },
  { title: 'Pushed Back', icon: ArrowLeftRight, status: 'X-Api-Key → your site' },
];

// Real flow, not illustrative-only like Shopify's periodic sync would be —
// this is exactly what create_checkout() + the stock-push background job
// actually do, in order. No OAuth step here because there isn't one: the
// seller's own site calls ExiusCart directly, authenticated by the secret
// webhook URL, not a third-party authorization dance.
export default function WorkflowDiagram() {
  return (
    <div className="bg-card border border-border rounded-xl p-6 sm:p-8">
      <div className="text-center mb-8">
        <h3 className="text-base font-bold text-foreground">How an order actually flows</h3>
        <p className="text-sm text-muted-foreground mt-1">Your site talks to ExiusCart directly — no third-party OAuth step.</p>
      </div>

      <div className="hidden xl:flex items-start justify-between">
        {STEPS.map((step, i) => (
          <div key={step.title} className="flex flex-1 items-start">
            <div className="text-center px-1">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <step.icon className="w-5 h-5" />
              </div>
              <p className="mt-2.5 text-xs font-bold text-foreground whitespace-nowrap">{step.title}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground whitespace-nowrap">{step.status}</p>
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
    </div>
  );
}
