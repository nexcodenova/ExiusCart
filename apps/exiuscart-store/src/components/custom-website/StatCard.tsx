interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  iconClassName?: string;
}

export default function StatCard({ icon, title, value, iconClassName }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 transition-shadow hover:shadow-md">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconClassName ?? 'bg-primary/10 text-primary'}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
        <p className="text-2xl font-bold text-foreground tracking-tight mt-0.5">{value}</p>
      </div>
    </div>
  );
}
