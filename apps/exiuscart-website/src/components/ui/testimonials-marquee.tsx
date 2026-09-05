'use client';

import { useEffect, useState } from 'react';
import { Star, Quote } from 'lucide-react';
import { Marquee } from '@/components/ui/marquee';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';

interface Testimonial {
  id: number;
  company_name: string;
  subtitle: string | null;
  quote_text: string;
  rating: number;
  reviewer_name: string | null;
}

function TestimonialCard({ t }: { t: Testimonial }) {
  const initials = (t.reviewer_name || t.company_name)
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="w-[26rem] shrink-0 rounded-2xl border border-white/10 p-6 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-[#6B3FD9]/40"
      style={{ background: 'linear-gradient(160deg, #171F36 0%, #11172A 100%)' }}
    >
      {/* Same gradient top-border accent used on the "What is Prodora"
          and Custom Website sections — ties this card into the same
          visual language instead of a flat, identical-everywhere box. */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, #7B4FE9 30%, #06B6D4 70%, transparent 100%)' }} />
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, #6B3FD9 0%, transparent 70%)' }} />

      <Quote className="absolute top-6 right-6 w-8 h-8 text-[#6B3FD9]/25" />
      <div className="flex gap-1 mb-4 relative">
        {[...Array(t.rating)].map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-[#F5B942] text-[#F5B942]" />
        ))}
      </div>
      <p className="text-gray-300 leading-relaxed mb-6 text-sm relative">{t.quote_text}</p>
      <div className="flex items-center gap-3 relative">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #7B4FE9, #6B3FD9)' }}>
          <span className="text-white font-semibold text-sm">{initials}</span>
        </div>
        <div className="min-w-0">
          <p className="text-white font-medium text-sm truncate">{t.company_name}</p>
          {t.subtitle && <p className="text-gray-500 text-xs truncate">{t.subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

/** Same 2-row opposite-direction auto-scroll pattern as the supplier
 * network section — approved reviews only, fetched live from the public
 * API, so anything an admin approves (or adds directly) shows up here
 * automatically with no code change or redeploy. Falls back to a plain
 * "coming soon" message if the fetch fails or nothing's approved yet,
 * rather than showing an empty marquee or a loading flash. */
export function TestimonialsMarquee() {
  const [testimonials, setTestimonials] = useState<Testimonial[] | null>(null);

  useEffect(() => {
    fetch(`${API}/api/v1/public/testimonials`)
      .then((r) => r.json())
      .then((d) => setTestimonials(d?.testimonials ?? []))
      .catch(() => setTestimonials([]));
  }, []);

  if (testimonials === null) return null; // avoid a loading flash — renders once the real data arrives

  if (testimonials.length === 0) {
    return (
      <p className="text-gray-500 text-center">More success stories coming soon.</p>
    );
  }

  const mid = Math.ceil(testimonials.length / 2);
  const row1 = testimonials.slice(0, mid);
  const row2 = testimonials.length > 1 ? testimonials.slice(mid) : row1;

  return (
    <div className="flex flex-col gap-4">
      <Marquee pauseOnHover className="[--duration:20s]">
        {row1.map((t) => <TestimonialCard key={t.id} t={t} />)}
      </Marquee>
      {row2.length > 0 && (
        <Marquee reverse pauseOnHover className="[--duration:20s]">
          {row2.map((t) => <TestimonialCard key={t.id} t={t} />)}
        </Marquee>
      )}
    </div>
  );
}
