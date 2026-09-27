import { ArrowRight, PawPrint, Rocket, Sparkles } from 'lucide-react';

// A picture of what a Prodora AI answer looks like, in the real card layout. It is an EXAMPLE and says so: the numbers are
// illustrative, and real results always come from live data (and show "Not measured" for anything we cannot measure).
function Tile({ label, value, bar }: { label: string; value?: string; bar?: number }) {
  return (
    <div className="rounded-lg bg-muted/60 p-2.5">
      <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
      {value ? (
        <>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">{value}</p>
          {bar !== undefined && <div className="mt-1.5 h-1 rounded-full bg-border"><div className="h-full rounded-full bg-primary" style={{ width: `${bar}%` }} /></div>}
        </>
      ) : (
        <p className="mt-0.5 text-xs font-medium text-muted-foreground/70">Not measured</p>
      )}
    </div>
  );
}

export default function AiHeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[34rem]" aria-label="Example of a Prodora AI answer">
      <div aria-hidden className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/15 via-sky-200/20 to-transparent blur-2xl" />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xl sm:p-5">
        {/* the ask */}
        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3.5 py-3">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <p className="min-w-0 flex-1 truncate text-sm text-foreground">Find me products for US pet owners under $30</p>
          <span className="hidden shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground sm:inline">Find</span>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span className="rounded-full bg-muted px-2.5 py-1">About: pet, dog, cat</span>
          <span className="rounded-full bg-muted px-2.5 py-1">Selling under $30</span>
          <span className="rounded-full bg-muted px-2.5 py-1">Market: US</span>
        </div>

        {/* the answer */}
        <div className="mt-3.5 rounded-xl border border-border p-3.5">
          <div className="flex items-start gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><PawPrint className="h-7 w-7" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[15px] font-bold leading-snug text-foreground">Automatic Pet Water Fountain</p>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Example</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="rounded bg-green-600 px-2 py-0.5 text-xs font-bold text-white">Test candidate</span>
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Saturation: Medium</span>
              </div>
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg bg-primary/10 p-2"><dt className="text-[11px] text-muted-foreground">Selling</dt><dd className="font-bold text-primary">$39.99</dd></div>
            <div className="rounded-lg bg-muted/60 p-2"><dt className="text-[11px] text-muted-foreground">Supplier cost</dt><dd className="font-bold text-foreground">$12.40</dd></div>
            <div className="rounded-lg bg-muted/60 p-2"><dt className="text-[11px] text-muted-foreground">Est. margin</dt><dd className="font-bold text-foreground">38%</dd></div>
          </dl>

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Tile label="Demand" value="87/100" bar={87} />
            <Tile label="Competition" value="62/100" bar={62} />
            <Tile label="Shipping" value="8/10" bar={80} />
            <Tile label="Supplier reliability" value="84/100" bar={84} />
            <Tile label="Content potential" />
            <Tile label="TikTok potential" />
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
            <Rocket className="h-4 w-4" /> Launch with ExiusCart <ArrowRight className="ml-auto h-4 w-4" />
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">Example for illustration. Real results use live data and say Not measured when we cannot measure something.</p>
    </div>
  );
}
