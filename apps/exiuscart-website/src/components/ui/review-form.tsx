'use client';

import { useState } from 'react';
import { Star, CheckCircle2 } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';

export function ReviewForm() {
  const [form, setForm] = useState({
    company_name: '', subtitle: '', quote_text: '', rating: 5,
    reviewer_name: '', submitter_email: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim() || !form.quote_text.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/v1/public/testimonials/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          submitter_email: form.submitter_email.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail?.message ?? data?.detail ?? 'Could not submit your review — please try again.');
      }
      setDone(true);
    } catch (err: any) {
      setError(err?.message ?? 'Could not submit your review — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Thank you!</h2>
        <p className="text-gray-400">Your review has been submitted and will appear on our homepage once approved.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>
      )}
      <div>
        <label className="text-sm text-gray-400 mb-1.5 block">Your company / store name *</label>
        <input
          type="text" required value={form.company_name}
          onChange={(e) => setForm({ ...form, company_name: e.target.value })}
          placeholder="e.g. Acme Fashion Co."
          className="w-full px-4 py-3 bg-[#151F32] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition"
        />
      </div>
      <div>
        <label className="text-sm text-gray-400 mb-1.5 block">Where you're based / what you do</label>
        <input
          type="text" value={form.subtitle}
          onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
          placeholder="e.g. Multi-vendor fashion marketplace · Sri Lanka"
          className="w-full px-4 py-3 bg-[#151F32] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition"
        />
      </div>
      <div>
        <label className="text-sm text-gray-400 mb-1.5 block">Your review *</label>
        <textarea
          required rows={5} value={form.quote_text}
          onChange={(e) => setForm({ ...form, quote_text: e.target.value })}
          placeholder="Tell us about your experience with ExiusCart"
          className="w-full px-4 py-3 bg-[#151F32] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition resize-none"
        />
      </div>
      <div>
        <label className="text-sm text-gray-400 mb-2 block">Rating</label>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n} type="button" onClick={() => setForm({ ...form, rating: n })}
              className="p-1"
            >
              <Star className={`w-7 h-7 transition ${n <= form.rating ? 'fill-[#6B3FD9] text-[#6B3FD9]' : 'text-gray-700'}`} />
            </button>
          ))}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-gray-400 mb-1.5 block">Your name (optional)</label>
          <input
            type="text" value={form.reviewer_name}
            onChange={(e) => setForm({ ...form, reviewer_name: e.target.value })}
            className="w-full px-4 py-3 bg-[#151F32] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition"
          />
        </div>
        <div>
          <label className="text-sm text-gray-400 mb-1.5 block">Email (optional, not shown publicly)</label>
          <input
            type="email" value={form.submitter_email}
            onChange={(e) => setForm({ ...form, submitter_email: e.target.value })}
            className="w-full px-4 py-3 bg-[#151F32] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition"
          />
        </div>
      </div>
      <button
        type="submit" disabled={submitting}
        className="w-full py-3.5 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold rounded-lg transition disabled:opacity-60"
      >
        {submitting ? 'Submitting…' : 'Submit review'}
      </button>
      <p className="text-xs text-gray-500 text-center">Reviews are checked before appearing on our homepage.</p>
    </form>
  );
}
