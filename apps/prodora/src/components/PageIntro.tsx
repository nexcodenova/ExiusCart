'use client';

import { useState } from 'react';
import { useEffect } from 'react';
import { Info, Trophy, Lightbulb, Zap, X, UserRound, MessageCircle, PlayCircle } from 'lucide-react';

const RESEARCHER_WHATSAPP = 'https://wa.me/971562393573';

// The tutorial video in the "How it works" popup. To change it, paste any
// YouTube link here (watch, youtu.be or embed all work).
const HOW_IT_WORKS_VIDEO = 'https://www.youtube.com/watch?v=DNdBJ5tgyjI';

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? m[1] : null;
}
const VIDEO_ID = youtubeId(HOW_IT_WORKS_VIDEO);

// Title block shared by the browse views: heading with a "How it works"
// link, the subtitle, and the researcher help card on the right. The
// support photo is /public/support/support_2.jpg — if it ever fails to load
// the card shows a neutral avatar.
export default function PageIntro({ title, subtitle }: { title: string; subtitle: string }) {
  const [showHow, setShowHow] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  // The popup's cover image is /public/how-it-works.png (hidden until the file
  // exists); the tutorial is the YouTube video above, played inline.
  const [imageFailed, setImageFailed] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => { if (!showHow) setPlaying(false); }, [showHow]);

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-xl font-bold leading-tight text-gray-900 sm:text-[22px]">{title}</h1>
            <button
              type="button"
              onClick={() => setShowHow(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
            >
              <Info className="h-4 w-4" /> How it works
            </button>
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-gray-500 sm:mt-0.5 sm:line-clamp-none sm:text-sm">{subtitle}</p>
        </div>

        <a
          href={RESEARCHER_WHATSAPP}
          target="_blank" rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-3 rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-gray-200/70 transition hover:shadow-md sm:px-4 sm:py-2.5"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-blue-600 sm:h-10 sm:w-10">
            {photoFailed ? (
              <UserRound className="h-5 w-5" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/support/support_2.jpg" alt="" className="h-full w-full object-cover" onError={() => setPhotoFailed(true)} />
            )}
          </span>
          <span className="min-w-0 text-[13px] leading-tight sm:text-sm">
            <span className="block font-semibold text-gray-900">Need help choosing products?</span>
            <span className="inline-flex items-center gap-1 text-blue-600">
              <MessageCircle className="h-3.5 w-3.5" /> Contact our ecommerce researcher
            </span>
          </span>
        </a>
      </div>

      {showHow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowHow(false)}>
          <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setShowHow(false)} aria-label="Close" className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-500 shadow hover:text-gray-800">
              <X className="h-5 w-5" />
            </button>

            {!playing && !imageFailed && (
              <div className="border-b border-gray-100 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/how-it-works.png" alt="" className="aspect-video w-full object-cover" onError={() => setImageFailed(true)} />
              </div>
            )}

            <div className="p-5 sm:p-6">
              <h2 className="text-xl font-bold text-gray-900">Prodora</h2>
              {playing ? (
                // Same width as the box, right under the title; the list makes room.
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0`}
                  title="How Prodora works" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen
                  className="mt-4 aspect-video w-full rounded-xl bg-black"
                />
              ) : (
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
              )}
              <div className="mt-6 flex gap-3">
                {VIDEO_ID && !playing && (
                  <button type="button" onClick={() => setPlaying(true)} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-800 transition hover:bg-gray-50">
                    <PlayCircle className="h-4 w-4" /> Watch Tutorial
                  </button>
                )}
                {playing && (
                  <button type="button" onClick={() => setPlaying(false)} className="flex h-11 flex-1 items-center justify-center rounded-lg border border-gray-200 text-sm font-semibold text-gray-800 transition hover:bg-gray-50">
                    Back
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
