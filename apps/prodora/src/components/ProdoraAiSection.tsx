import { ArrowRight, Search, Sparkles, Rocket, CheckCircle2, Clock } from 'lucide-react';
import AiCtaButton from '@/components/AiCtaButton';

const STEPS = [
  { icon: Search, title: 'Ask in plain words', desc: 'Type what you want to sell, like "kitchen gadgets under $25 with a 40% margin". Prodora AI understands the sentence and searches for you.' },
  { icon: Sparkles, title: 'Read the real scores', desc: 'Every result shows its margin, competition, shipping and a clear verdict, worked out from real prices. Nothing is guessed.' },
  { icon: Rocket, title: 'Launch in one click', desc: 'Launch with ExiusCart brings the product into your store as a private draft, priced from the market, with a title and description written for it.' },
];

// What every result tells you, and honestly which parts are live today. Status is real: it matches the product.
const SCORES = [
  { name: 'Estimated margin', desc: 'What you really keep per sale after fees, refunds and shipping.', status: 'live' },
  { name: 'Competition', desc: 'How many sellers already sell the same product, and at what price.', status: 'live' },
  { name: 'Shipping', desc: 'How much delivery costs against the selling price, and how long it takes.', status: 'live' },
  { name: 'Verdict', desc: 'Test candidate, Watch or Low margin, with the reasons and how sure we are.', status: 'live' },
  { name: 'Demand', desc: 'Whether people are searching for it, and whether that is rising or falling.', status: 'soon' },
  { name: 'Supplier reliability', desc: 'How dependable the supplier is, from real order history.', status: 'soon' },
  { name: 'Content potential', desc: 'How well the product shows on video and in ads.', status: 'later' },
  { name: 'TikTok potential', desc: 'Whether the product is catching on there, from real TikTok data.', status: 'later' },
] as const;
const BADGE = {
  live: { label: 'Live now', cls: 'bg-green-100 text-green-800' },
  soon: { label: 'Rolling out', cls: 'bg-amber-100 text-amber-800' },
  later: { label: 'Coming later', cls: 'bg-muted text-muted-foreground' },
} as const;

export default function ProdoraAiSection() {
  return (
    <section id="prodora-ai" className="border-t border-border bg-card">
      <div className="container py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary"><Sparkles className="h-3.5 w-3.5" /> Prodora AI</p>
          <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl">Not another chatbot. A product finder built for dropshipping.</h2>
          <p className="mt-4 text-muted-foreground">
            A general AI can talk about products. Prodora AI works with real supplier costs, real market prices and your own store, so what it shows you can actually be sold.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl border border-border bg-background p-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><s.icon className="h-5 w-5" /></div>
              <h3 className="mb-1.5 font-bold text-foreground">{i + 1}. {s.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              {i < STEPS.length - 1 && <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-border sm:block" />}
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-border bg-background p-6 sm:p-8">
          <h3 className="text-xl font-bold text-foreground">What every result tells you</h3>
          <p className="mt-1 text-sm text-muted-foreground">We show what we can measure today, and say so plainly for the rest. If we cannot measure something, the card says Not measured. It never shows an invented number.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SCORES.map((s) => (
              <div key={s.name} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-foreground">{s.name}</p>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE[s.status].cls}`}>
                    {s.status === 'live' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}{BADGE[s.status].label}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <AiCtaButton size="lg">Try Prodora AI <ArrowRight className="h-4 w-4" /></AiCtaButton>
          <p className="text-sm text-muted-foreground">Included with the Growth and Scale plans. Product research is free on every ExiusCart plan.</p>
        </div>
      </div>
    </section>
  );
}
