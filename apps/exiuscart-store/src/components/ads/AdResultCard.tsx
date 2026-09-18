import { ExternalLink, Megaphone } from 'lucide-react';

export interface MetaAd {
  id: string;
  page_name: string;
  snapshot_url: string;
  body: string | null;
  platforms: string[];
}

// View-only — there's no field on this side to save an ad reference into
// (unlike the admin Prodora curation flow's ad_facebook_url), this is a
// "is this already being advertised" research check, not a saved record.
export default function AdResultCard({ ad }: { ad: MetaAd }) {
  return (
    <a
      href={ad.snapshot_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col border border-border rounded-xl p-4 bg-card hover:border-primary/50 hover:shadow-sm transition"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Megaphone className="w-4 h-4 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground truncate">{ad.page_name || 'Unknown advertiser'}</p>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition" />
      </div>
      {ad.body && <p className="text-xs text-muted-foreground mt-3 line-clamp-3 leading-relaxed">{ad.body}</p>}
      {ad.platforms.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {ad.platforms.map((p) => (
            <span key={p} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{p}</span>
          ))}
        </div>
      )}
    </a>
  );
}
