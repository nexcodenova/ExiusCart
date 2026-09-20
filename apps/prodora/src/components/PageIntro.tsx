'use client';

import { useState } from 'react';
import { useEffect } from 'react';
import { Info, Trophy, Lightbulb, Zap, X, UserRound, MessageCircle, PlayCircle } from 'lucide-react';

const RESEARCHER_WHATSAPP = 'https://wa.me/971562393573';

// Title block shared by the browse views: heading with a "How it works"
// link, the subtitle, and the researcher help card on the right. The
// researcher's photo is /public/researcher.png — until that file exists the
// card shows a neutral avatar.
export default function PageIntro({ title, subtitle }: { title: string; subtitle: string }) {
  const [showHow, setShowHow] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  // The popup's media is /public/how-it-works.png (cover image) and
  // /public/how-it-works.mp4 (tutorial). Each only appears once the file
  // exists; the "Watch Tutorial" button is hidden until there is a video.
  const [hasVideo, setHasVideo] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!showHow) { setPlaying(false); return; }
    fetch('/how-it-works.mp4', { method: 'HEAD' }).then((r) => setHasVideo(r.ok)).catch(() => setHasVideo(false));
  }, [showHow]);

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-[22px] font-bold leading-tight text-gray-900">{title}</h1>
            <button
              type="button"
              onClick={() => setShowHow(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
            >
              <Info className="h-4 w-4" /> How it works
            </button>
          </div>
          <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
        </div>

        <a
          href={RESEARCHER_WHATSAPP}
          target="_blank" rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-3 rounded-lg bg-white px-4 py-2.5 shadow-sm ring-1 ring-gray-200/70 transition hover:shadow-md"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-blue-600">
            {photoFailed ? (
              <UserRound className="h-5 w-5" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/researcher.png" alt="" className="h-full w-full object-cover" onError={() => setPhotoFailed(true)} />
            )}
          </span>
          <span className="text-sm leading-tight">
            <span className="block font-semibold text-gray-900">Need help choosing products?</span>
            <span className="inline-flex items-center gap-1 text-blue-600">
              <MessageCircle className="h-3.5 w-3.5" /> Contact our ecommerce researcher
            </span>
          </span>
        </a>
      </div>

      {showHow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowHow(false)}>
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setShowHow(false)} aria-label="Close" className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-500 shadow hover:text-gray-800">
              <X className="h-5 w-5" />
            </button>

            {playing ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src="/how-it-works.mp4" controls autoPlay className="aspect-video w-full bg-black" />
            ) : !imageFailed ? (
              <div className="border-b border-gray-100 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/how-it-works.png" alt="" className="aspect-video w-full object-cover" onError={() => setImageFailed(true)} />
              </div>
            ) : null}

            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900">Prodora</h2>
              <ul className="mt-4 space-y-4">
                <li className="flex gap-3">
                  <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-gray-700" />
                  <div>
                    <p className="font-semibold text-gray-900">Discover proven winning products</p>
                    <p className="text-sm text-gray-500">Products picked by researchers and Prodora AI, with the supplier cost and your profit shown up front.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-gray-700" />
                  <div>
                    <p className="font-semibold text-gray-900">See the research behind each pick</p>
                    <p className="text-sm text-gray-500">Open a product to see its demand, competition and shipping estimate before you decide.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Zap className="mt-0.5 h-5 w-5 shrink-0 text-gray-700" />
                  <div>
                    <p className="font-semibold text-gray-900">Import and start selling</p>
                    <p className="text-sm text-gray-500">Import to your ExiusCart store in one click, and it is live on your store right away.</p>
                  </div>
                </li>
              </ul>
              <div className="mt-6 flex gap-3">
                {hasVideo && !playing && (
                  <button type="button" onClick={() => setPlaying(true)} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-800 transition hover:bg-gray-50">
                    <PlayCircle className="h-4 w-4" /> Watch Tutorial
                  </button>
                )}
                <button type="button" onClick={() => setShowHow(false)} className="h-11 flex-1 rounded-lg bg-[#2563EB] text-sm font-semibold text-white transition hover:bg-[#1E4FC2]">
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
