'use client';

import { useEffect, useRef, useState } from 'react';
import { Archivo_Black } from 'next/font/google';

const archivoBlack = Archivo_Black({ weight: '400', subsets: ['latin'] });

interface IntegrationCard {
  id: string;
  name: string;
  image: string;          // middle illustration/screenshot — placeholder until real art is supplied
  imageSize: string;      // exact px size this box was designed at, documented for whoever creates the art
  status?: 'live' | 'soon' | 'rolling-out';
  desc: string;
  core?: boolean;         // ExiusCart + Prodora — grouped in their own boxed pair, matching the heading copy ("at the center")
}

// 12 cards now — added WooCommerce (live, no third-party approval blocks
// it). Etsy is 'live' — Etsy approved full production API access
// 2026-08-31, so it's real and unblocked now, not just code-complete.
// TikTok Shop and Amazon stay 'rolling-out'/in-progress — see their own
// comments below.
const CARDS: IntegrationCard[] = [
  {
    id: 'exiuscart', name: 'ExiusCart', status: 'live', core: true,
    image: '/integration/ExiusCart.png', imageSize: '480×600',
    desc: 'One platform for your entire business — POS, inventory, invoicing, HR and every sales channel, together.',
  },
  {
    id: 'prodora', name: 'Prodora', status: 'live', core: true,
    image: '/integration/Prodora.png', imageSize: '480×600',
    desc: 'Thousands of winning products to sell, complete with ready-made marketing videos, images and real reviews.',
  },
  {
    id: 'shopify', name: 'Shopify', status: 'live',
    image: '/integration/shopify.jpg', imageSize: '480×600',
    desc: 'Sync products, inventory and orders between Shopify and ExiusCart automatically.',
  },
  {
    id: 'woocommerce', name: 'WooCommerce', status: 'live',
    image: '/integration/woocommerce.jpg', imageSize: '480×600',
    desc: 'Sync your WooCommerce store — products, orders and stock managed directly from ExiusCart.',
  },
  {
    id: 'etsy', name: 'Etsy', status: 'live',
    image: '/integration/etsy.jpg', imageSize: '480×600',
    desc: 'List products on Etsy and manage orders from ExiusCart.',
  },
  {
    id: 'custom-website', name: 'Custom Website', status: 'live',
    image: '/integration/custom-website.jpg', imageSize: '480×600',
    desc: 'Already have your own store? Connect it as a channel — orders, inventory and invoicing handled automatically.',
  },
  {
    id: 'tiktok', name: 'TikTok Shop', status: 'rolling-out',
    image: '/integration/tiktok.jpg', imageSize: '480×600',
    desc: 'Sync products and orders with TikTok Shop directly from ExiusCart. Rolling out.',
  },
  {
    id: 'ebay', name: 'eBay', status: 'live',
    image: '/integration/ebay-card.jpg', imageSize: '480×600',
    desc: 'List your products on eBay and manage orders from ExiusCart — one dashboard for your global reach.',
  },
  {
    id: 'noon', name: 'Noon', status: 'live',
    image: '/integration/noon.jpg', imageSize: '480×600',
    desc: 'Sell across the Gulf on Noon — list products and manage orders directly from ExiusCart.',
  },
  {
    id: 'amazon', name: 'Amazon', status: 'rolling-out',
    image: '/integration/amazon.jpg', imageSize: '480×600',
    desc: 'Connect your Amazon seller account — orders, stock and fulfilment in one place. Rolling out.',
  },
  {
    id: 'daraz', name: 'Daraz', status: 'live',
    image: '/integration/Daraz-card.png', imageSize: '480×600',
    desc: "South Asia's largest marketplace — Pakistan, Bangladesh, Sri Lanka, Nepal and Myanmar. List products and manage Daraz orders directly from ExiusCart.",
  },
  {
    id: 'thedersi', name: 'TheDersi', status: 'live',
    image: '/integration/TheDersi.jpg', imageSize: '480×600',
    desc: "Sri Lanka's #1 fashion marketplace. ExiusCart is the official seller backend — orders and stock sync automatically.",
  },
];

function Card({ card, className, square }: { card: IntegrationCard; className?: string; square?: boolean }) {
  return (
    <div
      className={`shrink-0 w-[90vw] sm:w-[330px] lg:w-[360px] rounded-3xl p-6 lg:p-7 flex flex-col transition-transform duration-300 hover:-translate-y-1.5 ${className ?? ''}`}
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
        {card.status === 'rolling-out' && (
          <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-[#6B3FD9] bg-white/70 border border-[#6B3FD9]/30 px-2 py-1 rounded-full">
            Rolling out
          </span>
        )}
      </div>

      {/* Middle — illustration. `square` swaps the tall 4:5 portrait crop
          for a squarer one on mobile only — at the narrow width the
          ExiusCart/Prodora pair renders on phones, 4:5 made the card look
          gangly and overly tall; reverts to the normal 4:5 at sm+ where
          there's room for it. */}
      <div className={`relative rounded-2xl overflow-hidden bg-white/60 mb-5 flex items-center justify-center ${square ? 'aspect-square sm:aspect-[4/5]' : 'aspect-[4/5]'}`}>
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
    <>
      {/* Mobile-only heading, moved here (ahead of Row 1) so it still
          introduces the section before any cards on phone screens — it used
          to sit inside the sticky wrapper right before what was the only
          row of cards; now that Row 1 renders before the sticky wrapper,
          leaving the heading in its old spot would print it after
          ExiusCart/Prodora instead of before them. Hidden from sm up —
          desktop/tablet keep the original heading back in page.tsx as
          normal-flow content above this section. */}
      <div className="sm:hidden shrink-0 pt-24 pb-4 px-6 text-center max-w-2xl mx-auto">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#6B3FD9] mb-2">
          Connected everywhere
        </p>
        <h2 className="text-4xl font-black text-gray-900 leading-[1.05] tracking-tight">
          Every channel,<br />one hub.
        </h2>
      </div>

      {/* Row 1 — ExiusCart + Prodora. On mobile, stacked vertically at
          full card width/normal 4:5 ratio (was two tilted cards squeezed
          to 40vw each side by side — too small to actually read). The
          tilted "leaning pair" only kicks in from sm+, where there's
          enough width for two side by side to still read comfortably.
          Plain static content, deliberately outside the sticky scroll-jack
          below — it's only two cards and never needs to scroll, and
          stacking it inside the pinned h-screen container made the total
          content taller than the viewport, clipping it. Found by id (not
          array position) so this survives future reordering. */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 lg:gap-24 px-6 pb-8 lg:pb-14">
        {(() => {
          const exiuscart = CARDS.find(c => c.id === 'exiuscart');
          const prodora = CARDS.find(c => c.id === 'prodora');
          // Below sm: no override, Card's own w-[90vw] default applies —
          // same size as every other card in the strip. At sm/lg: fixed
          // width for the side-by-side pair.
          const pairWidth = 'sm:!w-[330px] lg:!w-[360px]';
          return (
            <>
              {/* Tilt/drift only from sm+ — stacked full-width cards on
                  mobile don't need to lean into each other. */}
              {exiuscart && <Card card={exiuscart} className={`sm:rotate-[6deg] sm:hover:rotate-0 sm:hover:-translate-x-4 sm:origin-bottom-left ${pairWidth}`} />}
              {prodora && <Card card={prodora} className={`sm:rotate-[-6deg] sm:hover:rotate-0 sm:active:translate-x-4 sm:origin-bottom-right ${pairWidth}`} />}
            </>
          );
        })()}
      </div>

      {/* Row 2 — Shopify onward, the same horizontally scroll-jacked strip
          as before this whole change, just starting one card later now
          that ExiusCart/Prodora moved to their own row above. */}
      <div ref={wrapperRef} style={{ height: `calc(100vh + ${maxTranslate}px)` }}>
        <div ref={trackRef} className="sticky top-0 h-screen flex flex-col overflow-hidden">
          <div className="flex-1 flex items-center sm:items-start sm:pt-16 lg:pt-10 overflow-hidden">
            <div
              ref={rowRef}
              className="flex gap-4 lg:gap-6 px-6 will-change-transform"
              style={{ transform: `translateX(-${translate}px)` }}
            >
              {CARDS.filter(card => !card.core).map(card => <Card key={card.id} card={card} />)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
