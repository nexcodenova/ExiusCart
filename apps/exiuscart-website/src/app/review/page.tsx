import type { Metadata } from 'next';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { ReviewForm } from '@/components/ui/review-form';

export const metadata: Metadata = {
  title: 'Share Your Review | ExiusCart',
  description: 'Tell us about your experience running your business on ExiusCart.',
  robots: { index: false, follow: false },
};

export default function ReviewPage() {
  return (
    <div className="min-h-screen bg-[#0B1121]">
      <Navbar />
      <div className="max-w-xl mx-auto px-6 pt-32 pb-24">
        <div className="text-center mb-10">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6B3FD9] mb-4">Share your story</p>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-[1.1] tracking-tight mb-4">
            Tell us about your experience.
          </h1>
          <p className="text-gray-400 leading-relaxed">
            Real reviews from real sellers help other businesses trust ExiusCart. Thank you for taking a minute to share yours.
          </p>
        </div>
        <ReviewForm />
      </div>
      <Footer />
    </div>
  );
}
