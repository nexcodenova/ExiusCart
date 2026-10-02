'use client';

// AI copy review: asks the AI (via `load`) for a better title, Google title
// and description, description, highlights, FAQ and SEO keywords, shows
// NOW vs AI SUGGESTION per field, and hands the ticked ones to `onApply`.
// Used by the product editor's AI Studio, the AI Listing Generator page and
// the AI Product Creator page. Backend: app/api/v1/endpoints/ai_studio.py.

import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export interface AiCopy {
  title?: string;
  seo_title?: string;
  meta_description?: string;
  description_html?: string;
  benefits?: string[];
  faq?: { question: string; answer: string }[];
  keywords?: string[];
}

type FieldKey = keyof AiCopy;

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'title', label: 'Product title' },
  { key: 'seo_title', label: 'Google title' },
  { key: 'meta_description', label: 'Google description' },
  { key: 'description_html', label: 'Description' },
  { key: 'benefits', label: 'Highlights (5 benefits)' },
  { key: 'faq', label: 'FAQ' },
  { key: 'keywords', label: 'SEO keywords' },
];

export function aiErrorText(e: any, fallback: string): string {
  const d = e?.response?.data?.detail;
  return (typeof d === 'object' ? d?.message : d) || fallback;
}

function Preview({ k, value }: { k: FieldKey; value: any }) {
  if (value == null || (Array.isArray(value) && value.length === 0) || value === '') {
    return <p className="text-xs italic text-muted-foreground">Empty</p>;
  }
  if (k === 'description_html') {
    return <div className="text-xs text-foreground [&_p]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-4" dangerouslySetInnerHTML={{ __html: String(value) }} />;
  }
  if (k === 'faq') {
    return (
      <ul className="space-y-1.5 text-xs">
        {(value as { question: string; answer: string }[]).map((f, i) => (
          <li key={i}><span className="font-medium text-foreground">{f.question}</span><br /><span className="text-muted-foreground">{f.answer}</span></li>
        ))}
      </ul>
    );
  }
  if (Array.isArray(value)) {
    return <div className="flex flex-wrap gap-1">{value.map((v, i) => <Badge key={i} variant="muted" className="font-normal">{String(v)}</Badge>)}</div>;
  }
  return <p className="text-xs text-foreground">{String(value)}</p>;
}

export default function AiCopyStudio({ load, onApply, startLabel = 'Improve with AI', applyLabel = 'Use', appliedNote, disabled }: {
  load: () => Promise<{ current: AiCopy; suggested: AiCopy }>;
  onApply: (copy: AiCopy) => Promise<void> | void;
  startLabel?: string;
  applyLabel?: string;
  appliedNote?: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState<AiCopy | null>(null);
  const [suggested, setSuggested] = useState<AiCopy | null>(null);
  const [picked, setPicked] = useState<Set<FieldKey>>(new Set());
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const run = async () => {
    setLoading(true); setError(''); setApplied(false);
    try {
      const r = await load();
      setCurrent(r.current); setSuggested(r.suggested);
      setPicked(new Set(FIELDS.map((f) => f.key).filter((k) => {
        const v = r.suggested[k];
        return v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
      })));
    } catch (e: any) {
      setError(aiErrorText(e, 'The AI could not write this right now.'));
    } finally { setLoading(false); }
  };

  const apply = async () => {
    if (!suggested) return;
    const out: AiCopy = {};
    picked.forEach((k) => { (out as any)[k] = suggested[k]; });
    setApplying(true); setError('');
    try {
      await onApply(out);
      setApplied(true);
    } catch (e: any) {
      setError(aiErrorText(e, 'Could not save.'));
    } finally { setApplying(false); }
  };

  return (
    <div className="space-y-3">
      <Button type="button" onClick={run} disabled={loading || disabled} className="w-full sm:w-auto">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Researching keywords and writing…</> : <><Sparkles className="w-4 h-4" /> {suggested ? 'Write again' : startLabel}</>}
      </Button>
      {error && (
        <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}
      {suggested && current && (
        <div className="space-y-2">
          {FIELDS.map(({ key, label }) => (
            <div key={key} className={cn('rounded-lg border p-3 transition', picked.has(key) ? 'border-primary/50 bg-primary/5' : 'border-border')}>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <Checkbox
                  checked={picked.has(key)}
                  onCheckedChange={(v) => setPicked((prev) => { const n = new Set(prev); if (v) n.add(key); else n.delete(key); return n; })}
                />
                <span className="text-sm font-medium text-foreground">{label}</span>
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Now</p><Preview k={key} value={current[key]} /></div>
                <div><p className="text-[11px] uppercase tracking-wide text-primary mb-1">AI suggestion</p><Preview k={key} value={suggested[key]} /></div>
              </div>
            </div>
          ))}
          <Button type="button" onClick={apply} disabled={picked.size === 0 || applying} className="w-full">
            {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {applyLabel} {picked.size} selected
          </Button>
          {applied && appliedNote && <p className="text-sm text-emerald-600 dark:text-emerald-400 text-center">{appliedNote}</p>}
        </div>
      )}
    </div>
  );
}
