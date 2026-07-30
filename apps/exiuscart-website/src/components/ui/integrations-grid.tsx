'use client';

import { useEffect, useRef, useState } from 'react';
import { Archivo_Black } from 'next/font/google';

const archivoBlack = Archivo_Black({ weight: '400', subsets: ['latin'] });

interface IntegrationCard {
  id: string;
  name: string;
  image: string;          // middle illustration/screenshot — placeholder until real art is supplied
  imageSize: string;      // exact px size this box was designed at, documented for whoever creates the art
  status?: 'live' | 'soon';
  desc: string;
}

// All 8 cards in one row now, reading as one continuous strip like the
// reference. Amazon and TikTok Shop are marked status:'soon' — no backend
// integration exists for either yet, so they're shown honestly as upcoming
// rather than claimed as live, unlike TheDersi/Daraz/eBay/Custom Website
// which ship.
const CARDS: IntegrationCard[] = [
  {
    id: 'exiuscart', name: 'ExiusCart', status: 'live',
    image: '/integration/ExiusCart.png', imageSize: '480×600',
    desc: 'One platform for your entire business — POS, inventory, invoicing, HR and every sales channel, together.',
  },
  {
    id: 'prodora', name: 'Prodora', status: 'live',
    image: '/integration/Prodora.png', imageSize: '480×600',
    desc: 'Thousands of winning products to sell, complete with ready-made marketing videos, images and real reviews.',
  },
  {
    id: 'ebay', name: 'eBay', status: 'live',
    image: '/integration/ebay.png', imageSize: '480×600',
    desc: 'List your products on eBay and manage orders from ExiusCart — one dashboard for your global reach.',
  },
  {
    id: 'thedersi', name: 'TheDersi', status: 'live',
    image: '/integration/TheDersi.jpg', imageSize: '480×600',
    desc: "Sri Lanka's #1 fashion marketplace. ExiusCart is the official seller backend — orders and stock sync automatically.",
  },
  {
    id: 'daraz', name: 'Daraz', status: 'live',
    image: '/integration/daraz.jpg', imageSize: '480×600',
    desc: "South Asia's largest marketplace — Pakistan, Bangladesh, Sri Lanka, Nepal and Myanmar. List products and manage Daraz orders directly from ExiusCart.",
  },
  {
    id: 'custom-website', name: 'Custom Website', status: 'live',
    image: '/integration/custom-website.jpg', imageSize: '480×600',
    desc: 'Already have your own store? Connect it as a channel — orders, inventory and invoicing handled automatically.',
  },
  {
    id: 'amazon', name: 'Amazon', status: 'soon',
    image: '/integration/amazon.jpg', imageSize: '480×600',
    desc: 'Connect your Amazon seller account — orders, stock and fulfilment in one place. In development.',
  },
  {
    id: 'tiktok', name: 'TikTok Shop', status: 'soon',
    image: '/integration/tiktok.jpg', imageSize: '480×600',
    desc: 'Sync products and orders with TikTok Shop directly from ExiusCart. In development.',
  },
];

function Card({ card }: { card: IntegrationCard }) {
  return (
    <div
      className="shrink-0 w-[280px] sm:w-[320px] lg:w-[360px] rounded-3xl p-6 lg:p-7 flex flex-col transition-transform duration-300 hover:-translate-y-1.5"
      style={{ background: '#EDEBE6', border: '1px solid #DDD6C7' }}
    >
      {/* Top — big headline, same color across every card */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className={`${archivoBlack.className} text-2xl lg:text-[1.75rem] leading-[0.95] text-gray-900`}>
          {card.name}
        </h3>
        {card.status === 'soon' && (
          <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-gray-500 bg-white/70 border border-gray-300 px-2 py-1 rounded-full">
            Soon
          </span>
        )}
      </div>

      {/* Middle — illustration */}
      <div className="relative rounded-2xl overflow-hidden bg-white/60 mb-5 aspect-[4/5] flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={card.image} alt={card.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </div>

      {/* Bottom — small description */}
      <p className="text-gray-600 text-[13px] leading-relaxed">{card.desc}</p>
    </div>
  );
}

/** Maps vertical scroll progress through a tall wrapper into horizontal
 * translateX on the card row — the wrapper is sticky-pinned for exactly as
 * long as there's row left to reveal, then normal page scroll resumes.
 * Vanilla scroll-position math instead of a library so no new dependency
 * is needed for one section. */
export function IntegrationsGrid() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [maxTranslate, setMaxTranslate] = useState(0);
  const [translate, setTranslate] = useState(0);

  useEffect(() => {
    function measure() {
      if (!rowRef.current || !trackRef.current) return;
      const rowWidth = rowRef.current.scrollWidth;
      const viewportWidth = trackRef.current.offsetWidth;
      setMaxTranslate(Math.max(0, rowWidth - viewportWidth + 48));
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    function onScroll() {
      const el = wrapperRef.current;
      if (!el || maxTranslate <= 0) return;
      const rect = el.getBoundingClientRect();
      const scrollable = el.offsetHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const progress = Math.min(1, Math.max(0, -rect.top / scrollable));
      setTranslate(progress * maxTranslate);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [maxTranslate]);

  return (
    <div ref={wrapperRef} style={{ height: `calc(100vh + ${maxTranslate}px)` }}>
      <div ref={trackRef} className="sticky top-0 h-screen flex items-start pt-6 lg:pt-10 overflow-hidden">
        <div
          ref={rowRef}
          className="flex gap-4 lg:gap-6 px-6 will-change-transform"
          style={{ transform: `translateX(-${translate}px)` }}
        >
          {CARDS.map(card => <Card key={card.id} card={card} />)}
        </div>
      </div>
    </div>
  );
}
