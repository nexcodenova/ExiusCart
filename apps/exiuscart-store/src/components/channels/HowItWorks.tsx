import { Card, CardContent } from '@/components/ui/card';
import { Store, Activity, Layers3 } from 'lucide-react';

const STEPS = [
  { number: '1', icon: Store, title: 'Connect', description: 'Connect your store or marketplace securely.' },
  { number: '2', icon: Activity, title: 'Synchronize', description: 'Products, inventory and orders synchronize automatically.' },
  { number: '3', icon: Layers3, title: 'Manage', description: 'Manage your entire ecommerce operation from ExiusCart.' },
];

export default function HowItWorks() {
  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="text-sm font-bold text-foreground">How synchronization works</h3>
        <p className="text-xs text-muted-foreground mt-0.5">One connection. One operating system.</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number}>
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <step.icon className="w-4 h-4" />
              </div>
              <p className="mt-2.5 text-xs font-bold text-foreground">{step.number}. {step.title}</p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
