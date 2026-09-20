'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';

interface Review {
  id: number;
  company_name: string;
  subtitle: string | null;
  quote_text: string;
  rating: number;
  reviewer_name: string | null;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';

// Approved reviews only, fetched live from the ExiusCart public API — the
// same feed exiuscart.com shows. Renders nothing until there is at least one
// approved review, so the section never shows an empty shell.
export default function SellerReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    fetch(`${API}/api/v1/public/testimonials`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setReviews((d?.testimonials ?? []).slice(0, 6)))
      .catch(() => {});
  }, []);

  if (reviews.length === 0) return null;

  return (
    <section className="border-t border-border bg-background">
      <div className="container py-20">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl">What sellers say</h2>
          <p className="mt-3 text-muted-foreground">Real feedback from ExiusCart sellers.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <figure key={r.id} className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                ))}
              </div>
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-foreground/90">&ldquo;{r.quote_text}&rdquo;</blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-semibold text-foreground">{r.reviewer_name || r.company_name}</span>
                {r.subtitle && <span className="text-muted-foreground"> · {r.subtitle}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
