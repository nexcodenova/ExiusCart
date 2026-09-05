'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit, Trash2, X, Loader2, Star, Link2, Check, Clock,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

interface Testimonial {
  id: number;
  company_name: string;
  subtitle: string | null;
  quote_text: string;
  rating: number;
  reviewer_name: string | null;
  is_approved: boolean;
  source: string;
  sort_order: number;
  created_at: string;
}

const SUBMISSION_LINK = 'https://exiuscart.com/review';

export default function ReviewsPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const fetchTestimonials = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getTestimonials();
      setTestimonials(res.data?.testimonials ?? []);
    } catch {
      setTestimonials([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTestimonials(); }, [fetchTestimonials]);

  const handleApprove = async (id: number) => {
    await adminApi.updateTestimonial(id, { is_approved: true });
    fetchTestimonials();
  };

  const handleReject = async (id: number) => {
    await adminApi.deleteTestimonial(id);
    fetchTestimonials();
  };

  const handleDelete = async (id: number) => {
    await adminApi.deleteTestimonial(id);
    setDeleteConfirm(null);
    fetchTestimonials();
  };

  const copyLink = () => {
    navigator.clipboard.writeText(SUBMISSION_LINK).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const pending = testimonials.filter((t) => !t.is_approved);
  const approved = testimonials.filter((t) => t.is_approved);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Reviews</h1>
          <p className="text-gray-400 text-sm mt-1">
            Testimonials shown on exiuscart.com's homepage — approved ones appear there automatically, no deploy needed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center justify-center gap-2 border border-gray-700 hover:border-[#6B3FD9] text-white font-medium px-4 py-2.5 rounded-lg transition"
          >
            {linkCopied ? <Check className="w-4 h-4 text-green-400" /> : <Link2 className="w-4 h-4" />}
            {linkCopied ? 'Copied!' : 'Copy submission link'}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(null); setShowModal(true); }}
            className="inline-flex items-center justify-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-black font-semibold px-4 py-2.5 rounded-lg transition"
          >
            <Plus className="w-5 h-5" /> Add Review
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 bg-[#151F32] border border-gray-800 rounded-lg px-3 py-2.5 mb-6">
        Send <span className="text-gray-300 font-mono">{SUBMISSION_LINK}</span> to a customer to let them submit their own review — it lands here as Pending until you approve it. Reviews you add yourself with "Add Review" go live immediately.
      </p>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 text-[#6B3FD9] animate-spin" />
        </div>
      ) : testimonials.length === 0 ? (
        <div className="bg-[#151F32] rounded-xl border border-gray-800 p-16 text-center">
          <Star className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">No reviews yet</p>
          <button
            type="button"
            onClick={() => { setEditing(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-black font-semibold px-4 py-2 rounded-lg transition text-sm"
          >
            <Plus className="w-4 h-4" /> Add First Review
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {pending.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Pending approval ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map((t) => (
                  <TestimonialRow
                    key={t.id}
                    t={t}
                    onApprove={() => handleApprove(t.id)}
                    onReject={() => handleReject(t.id)}
                    onEdit={() => { setEditing(t); setShowModal(true); }}
                    onDelete={() => setDeleteConfirm(t.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            {pending.length > 0 && <h2 className="text-sm font-semibold text-gray-400 mb-3">Live on homepage ({approved.length})</h2>}
            <div className="space-y-3">
              {approved.map((t) => (
                <TestimonialRow
                  key={t.id}
                  t={t}
                  onEdit={() => { setEditing(t); setShowModal(true); }}
                  onDelete={() => setDeleteConfirm(t.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <TestimonialModal
          testimonial={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={() => { setShowModal(false); setEditing(null); fetchTestimonials(); }}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#151F32] rounded-xl border border-gray-800 p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Delete this review?</h3>
            <p className="text-sm text-gray-400 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-white hover:bg-gray-800 transition">Cancel</button>
              <button type="button" onClick={() => handleDelete(deleteConfirm)} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TestimonialRow({ t, onApprove, onReject, onEdit, onDelete }: {
  t: Testimonial;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`bg-[#151F32] rounded-xl border p-4 ${t.is_approved ? 'border-gray-800' : 'border-amber-500/30'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-medium text-white">{t.company_name}</p>
            {t.subtitle && <p className="text-sm text-gray-400">· {t.subtitle}</p>}
            <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded capitalize">{t.source}</span>
          </div>
          <div className="flex gap-0.5 mb-2">
            {[...Array(t.rating)].map((_, i) => (
              <Star key={i} className="w-3.5 h-3.5 fill-[#6B3FD9] text-[#6B3FD9]" />
            ))}
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">{t.quote_text}</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {onApprove && onReject && (
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={onApprove} title="Approve" className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/10 transition">
                <Check className="w-4 h-4" />
              </button>
              <button type="button" onClick={onReject} title="Reject" className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-1">
            <button type="button" onClick={onEdit} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition">
              <Edit className="w-4 h-4" />
            </button>
            <button type="button" onClick={onDelete} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TestimonialModal({ testimonial, onClose, onSaved }: {
  testimonial: Testimonial | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    company_name: testimonial?.company_name ?? '',
    subtitle: testimonial?.subtitle ?? '',
    quote_text: testimonial?.quote_text ?? '',
    rating: testimonial?.rating ?? 5,
    reviewer_name: testimonial?.reviewer_name ?? '',
    sort_order: testimonial?.sort_order ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim() || !form.quote_text.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (testimonial) {
        await adminApi.updateTestimonial(testimonial.id, form);
      } else {
        await adminApi.createTestimonial(form);
      }
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.response?.data?.detail ?? 'Could not save this review.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#151F32] rounded-xl border border-gray-800 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">{testimonial ? 'Edit Review' : 'Add Review'}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>
          )}
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Company Name *</label>
            <input
              type="text" required value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              placeholder="e.g. TheDersi"
              className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Subtitle</label>
            <input
              type="text" value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              placeholder="e.g. Sri Lankan Fashion Marketplace · Sri Lanka"
              className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Review Text *</label>
            <textarea
              required rows={4} value={form.quote_text}
              onChange={(e) => setForm({ ...form, quote_text: e.target.value })}
              placeholder="What they said about ExiusCart"
              className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Rating</label>
              <select
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
                className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white focus:border-[#6B3FD9] focus:outline-none transition appearance-none cursor-pointer"
              >
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n !== 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">Sort Order</label>
              <input
                type="number" value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white focus:border-[#6B3FD9] focus:outline-none transition"
              />
            </div>
          </div>
          <button
            type="submit" disabled={saving}
            className="w-full py-2.5 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-black font-semibold rounded-lg transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : testimonial ? 'Save Changes' : 'Add Review'}
          </button>
        </form>
      </div>
    </div>
  );
}
