'use client';

import { useEffect, useRef, useState } from 'react';
import { Lightbulb, Loader2, Star, CheckCircle2 } from 'lucide-react';
import { feedbackApi } from '@/lib/api';

// Top-bar Feedback button with a small popover that drops down under it.
// Goes to the ExiusCart admin Reviews queue; nothing is published until an
// admin approves it.
export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setTimeout(() => { setSent(false); setMessage(''); setRating(5); setError(''); }, 200);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (message.trim().length < 10) { setError('Please write at least a sentence.'); return; }
    setSending(true);
    try {
      await feedbackApi.submit(message.trim(), rating);
      setSent(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Could not send feedback. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button" onClick={() => (open ? close() : setOpen(true))} aria-expanded={open}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
      >
        <Lightbulb className="h-4 w-4" /> Feedback
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 w-[34rem] max-w-[calc(100vw-2rem)] rounded-xl bg-white p-4 shadow-xl ring-1 ring-gray-200">
          <span className="absolute -top-1.5 right-10 h-3 w-3 rotate-45 bg-white ring-1 ring-gray-200 [clip-path:polygon(0_0,100%_0,0_100%)]" />
          {sent ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="mt-3 font-semibold text-gray-900">Thank you!</p>
              <p className="mt-1 text-sm text-gray-500">Your feedback was sent to our team.</p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="mb-2 flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-label={`${n} star${n > 1 ? 's' : ''}`} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)}>
                    <Star className={`h-5 w-5 transition ${(hover || rating) >= n ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                  </button>
                ))}
              </div>
              <textarea
                value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={1500} autoFocus
                placeholder="Type your feedback here..."
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
              <div className="mt-3 flex items-end justify-between gap-4">
                <p className="text-sm leading-snug text-gray-500">
                  Tell us what is working, what is missing, or what you would like to see next. A real person on our team reads every message and it shapes what we build. Need a reply?{' '}
                  <a href="https://exiuscart.com/contact" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Contact support</a>.
                </p>
                <button
                  type="submit" disabled={sending}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1E4FC2] disabled:opacity-60"
                >
                  {sending && <Loader2 className="h-4 w-4 animate-spin" />} Submit
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
