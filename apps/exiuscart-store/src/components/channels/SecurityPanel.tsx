import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, Check } from 'lucide-react';

const ITEMS = [
  'Secure authentication',
  'Encrypted API connections',
  'Permission-based access',
  'Automatic sync monitoring',
];

export default function SecurityPanel() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Your connections stay secure</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              We use industry-standard security practices to keep your data and transactions safe.
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
