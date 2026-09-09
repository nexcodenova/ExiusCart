import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, Check } from 'lucide-react';

const ITEMS = [
  'Encrypted supplier credentials',
  'Verified supplier connections',
  'Real-time order synchronization',
  'Automatic fulfillment monitoring',
];

export default function TrustPanel() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Built for reliable ecommerce operations</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Every supplier credential is encrypted at rest — the same standard used across every ExiusCart integration.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
          {ITEMS.map((item) => (
            <div key={item} className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="w-4 h-4 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">
                <Check className="w-2.5 h-2.5" />
              </span>
              {item}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
