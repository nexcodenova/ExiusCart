import { Lock, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

// Ad research, Customer Segments, Marketing hub, and Campaigns are open to
// every plan EXCEPT TheDersi Free Forever specifically — Lite/Pro/Official
// all get them. This is the shared lock screen for the two page-level
// gates (Marketing Overview, Campaigns) that don't have a single backend
// endpoint of their own to enforce this on.
export default function MarketingHubLockScreen({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-2xl mx-auto">
      <Card className="border-dashed">
        <CardContent className="py-16 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-500" /> {title}
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
}
