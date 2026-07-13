'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Star, Loader2, CheckCircle2, AlertCircle, Camera, X } from 'lucide-react';
import { publicReviewApi } from '@/lib/api';

interface ReviewInfo {
  product_name: string;
  product_image: string | null;
  shop_name: string;
  customer_name: string | null;
  already_submitted: boolean;
  rating: number | null;
  comment: string | null;
}

export default function PublicReviewPage() {
  const { token } = useParams() as { token: string };
  const [info, setInfo] = useState<ReviewInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    publicReviewApi.get(token)
      .then((r) => setInfo(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (rating === 0) { setError('Please select a star rating.'); return; }
    setSubmitting(true);
    setError('');
    try {
      let photo_url: string | undefined;
      if (photoFile) {
        const res = await publicReviewApi.uploadPhoto(token, photoFile);
        photo_url = res.data?.url;
      }
      await publicReviewApi.submit(token, { rating, comment: comment.trim() || undefined, photo_url });
      setSubmitted(true);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to submit your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-semibold text-foreground">Review link not found</p>
          <p className="text-sm text-muted-foreground mt-1">This link may have expired or already been used.</p>
        </div>
      </div>
    );
  }

  if (submitted || info.already_submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-green-500" />
          </div>
          <p className="font-semibold text-foreground text-lg">Thanks for your review!</p>
          <p className="text-sm text-muted-foreground mt-2">Your feedback helps other shoppers at {info.shop_name}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-sm space-y-5">
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{info.shop_name}</p>
          <div className="flex items-center gap-3 justify-center mt-3">
            {info.product_image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={info.product_image} alt={info.product_name} className="w-14 h-14 rounded-lg object-cover border border-border" />
            )}
            <p className="font-semibold text-foreground text-left">{info.product_name}</p>
          </div>
        </div>

        <div>
          <p className="text-sm text-center text-muted-foreground mb-2">How would you rate this product?</p>
          <div className="flex items-center justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" onClick={() => setRating(i)}
                onMouseEnter={() => setHoverRating(i)} onMouseLeave={() => setHoverRating(0)}
                className="p-1">
                <Star className={`w-8 h-8 transition ${
                  i <= (hoverRating || rating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/25'
                }`} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="Tell others what you thought (optional)"
            rows={4}
            className="w-full px-4 py-3 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary resize-none" />
        </div>

        <div>
          {photoPreview ? (
            <div className="relative w-20 h-20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPreview} alt="Preview" className="w-20 h-20 rounded-lg object-cover border border-border" />
              <button onClick={() => { setPhotoFile(null); setPhotoPreview(''); }}
                className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-3 cursor-pointer hover:bg-muted/50 transition w-fit">
              <Camera className="w-4 h-4" /> Add a photo (optional)
              <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            </label>
          )}
        </div>

        {error && <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

        <button onClick={handleSubmit} disabled={submitting}
          className="w-full py-3 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? 'Submitting...' : 'Submit Review'}
        </button>
      </div>
    </div>
  );
}
