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
    <div className="w-[26rem] shrink-0 bg-[#151F32] rounded-2xl border border-gray-800 p-6 relative">
      <Quote className="absolute top-6 right-6 w-8 h-8 text-[#6B3FD9]/20" />
      <div className="flex gap-1 mb-4">
        {[...Array(t.rating)].map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-[#6B3FD9] text-[#6B3FD9]" />
        ))}
      </div>
      <p className="text-gray-300 leading-relaxed mb-6 text-sm">{t.quote_text}</p>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#6B3FD9]/20 flex items-center justify-center shrink-0">
          <span className="text-[#6B3FD9] font-semibold text-sm">{initials}</span>
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
      <Marquee pauseOnHover className="[--duration:32s]">
        {row1.map((t) => <TestimonialCard key={t.id} t={t} />)}
      </Marquee>
      {row2.length > 0 && (
        <Marquee reverse pauseOnHover className="[--duration:32s]">
          {row2.map((t) => <TestimonialCard key={t.id} t={t} />)}
        </Marquee>
      )}
    </div>
  );
}
