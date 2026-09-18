import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SectionCard({
  title, description, action, children,
}: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
