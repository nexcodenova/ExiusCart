import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  iconClassName?: string;
}

// Deliberately no fake "+12% since last week" trend line — that number
// doesn't exist anywhere in the backend yet, and a fabricated trend next to
// otherwise-real counts (see channels.py's /channels/stats) would be worse
// than no trend at all.
export default function StatCard({ icon, title, value, iconClassName }: StatCardProps) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconClassName ?? 'bg-primary/10 text-primary'}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
          <p className="text-2xl font-bold text-foreground tracking-tight mt-0.5">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
