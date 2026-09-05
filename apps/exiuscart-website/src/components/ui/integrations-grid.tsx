'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
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

// 17 cards now — added WooCommerce (live, no third-party approval blocks
// it). Etsy is 'live' — Etsy approved full production API access
// 2026-08-31, so it's real and unblocked now, not just code-complete.
// TikTok Shop and Amazon stay 'rolling-out'/in-progress — see their own
// comments below. BigCommerce/Wix/Walmart/Jumia/Trendyol added later —
// see their own comment further down.
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
  // Image files below don't exist yet — real "Partner with X" art to be
  // supplied and dropped into /public/integration/ later, same filename
  // convention as the cards above. Card's own onError hides a broken
  // image cleanly rather than showing a blank alt icon, so this ships
  // safely today and picks up the real art with zero code changes once
  // the file lands.
  {
    id: 'bigcommerce', name: 'BigCommerce', status: 'live',
    image: '/integration/bigcommerce.jpg', imageSize: '480×600',
    desc: 'Sync your BigCommerce store — products, orders and inventory managed directly from ExiusCart.',
  },
  {
    id: 'wix', name: 'Wix Stores', status: 'soon',
    image: '/integration/wix.jpg', imageSize: '480×600',
    desc: 'Connect your Wix store — products, orders and inventory stay in sync automatically. Rolling out.',
  },
  {
    id: 'walmart', name: 'Walmart', status: 'soon',
    image: '/integration/walmart.jpg', imageSize: '480×600',
    desc: 'Reach US shoppers on Walmart Marketplace — list products and manage orders through ExiusCart. Rolling out.',
  },
  {
    // Already live on the dashboard's own Channels page (Social Commerce
    // section, alongside TikTok Shop) — this card was just missing from
    // the marketing site's own marketplace line.
    id: 'instagram', name: 'Instagram Shopping', status: 'soon',
    image: '/integration/instagram.jpg', imageSize: '480×600',
    desc: 'Tag products in your Instagram posts and stories — orders sync straight to ExiusCart. Rolling out.',
  },
  {
    id: 'jumia', name: 'Jumia', status: 'soon',
    image: '/integration/jumia.jpg', imageSize: '480×600',
    desc: "Africa's leading marketplace — list products and manage orders through ExiusCart. Rolling out.",
  },
  {
    id: 'trendyol', name: 'Trendyol', status: 'soon',
    image: '/integration/trendyol.jpg', imageSize: '480×600',
    desc: "Turkey's largest online marketplace — list products and manage orders through ExiusCart. Rolling out.",
  },
];

// Two separate lines, each its own independent stick-and-scroll section
// (not one shared track) — Own Store first, then Marketplaces, TheDersi
// last since it's a managed-seller model with its own rules. Same
// grouping already used on the dashboard's Channels page. ExiusCart/
// Prodora stay in their own static pair above both, untouched.
const OWN_STORE_IDS = ['shopify', 'custom-website', 'woocommerce', 'bigcommerce', 'wix'];
const MARKETPLACE_IDS = ['etsy', 'ebay', 'noon', 'amazon', 'daraz', 'tiktok', 'walmart', 'instagram', 'jumia', 'trendyol', 'thedersi'];

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
 * is needed. Extracted into its own hook so two independent lines can each
 * run this without duplicating the effect logic — each line gets its own
 * refs/state, so they pin and scroll on their own, one after the other as
 * the page scrolls, not sharing one track (that's what caused the
 * previous overflow-clip bug: two full rows stacked in one shared h-screen
 * track are taller than the viewport). */
function useScrollJack() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [maxTranslate, setMaxTranslate] = useState(0);
  const [translate, setTranslate] = useState(0);
  // Real, measured track height — NOT assumed to equal window.innerHeight.
  // The track's own CSS caps at ~800px (see ScrollLine below) instead of a
  // bare h-screen, because on a tall/narrow viewport (tablet portrait
  // especially — 1180px tall is common) a ~560px card row centered inside
  // a full h-screen track left a huge, ugly empty gap above and below —
  // visually indistinguishable from "something's cut/broken" mid-scroll.
  // Capping the track's own height fixes that, but the pin-duration math
  // below has to track the track's REAL height to match, or the reveal
  // finishes before/after the element actually unsticks.
  const [trackHeight, setTrackHeight] = useState(0);

  useEffect(() => {
    function measure() {
      if (!rowRef.current || !trackRef.current) return;
      const rowWidth = rowRef.current.scrollWidth;
      const viewportWidth = trackRef.current.offsetWidth;
      setMaxTranslate(Math.max(0, rowWidth - viewportWidth + 48));
      setTrackHeight(trackRef.current.offsetHeight);
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    function onScroll() {
      const el = wrapperRef.current;
      if (!el || maxTranslate <= 0 || trackHeight <= 0) return;
      const rect = el.getBoundingClientRect();
      const scrollable = el.offsetHeight - trackHeight;
      if (scrollable <= 0) return;
      const progress = Math.min(1, Math.max(0, -rect.top / scrollable));
      setTranslate(progress * maxTranslate);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [maxTranslate, trackHeight]);

  return { wrapperRef, trackRef, rowRef, maxTranslate, trackHeight, translate };
}

/** One independent stick-and-scroll line — its own heading, its own pin,
 * its own horizontal reveal. Two of these stacked on the page (Own Store,
 * then Marketplaces) instead of one shared track. Track height caps at
 * ~800px (min(100vh, 800px)) rather than a bare h-screen/100vh — content
 * (heading + one card row) naturally needs ~750-800px, so anything taller
 * than that was pure dead space, not anything the design intended. */
function ScrollLine({ heading, kicker, ids }: { heading: string; kicker: string; ids: string[] }) {
  const { wrapperRef, trackRef, rowRef, maxTranslate, trackHeight, translate } = useScrollJack();
  const cards = ids.map(id => CARDS.find(c => c.id === id)).filter(Boolean) as IntegrationCard[];

  return (
    <div ref={wrapperRef} style={{ height: `calc(${trackHeight || 100}px + ${maxTranslate}px)` }}>
      <div ref={trackRef} className="sticky top-0 h-[min(100vh,800px)] flex flex-col overflow-hidden">
        <div className="shrink-0 pt-10 sm:pt-16 lg:pt-10 pb-4 px-6 text-center max-w-2xl mx-auto">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#6B3FD9] mb-2">{kicker}</p>
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 leading-[1.05] tracking-tight">{heading}</h2>
        </div>
        <div className="flex-1 flex items-center overflow-hidden">
          <div
            ref={rowRef}
            className="flex gap-4 lg:gap-6 px-6 will-change-transform"
            style={{ transform: `translateX(-${translate}px)` }}
          >
            {cards.map(card => <Card key={card.id} card={card} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function IntegrationsGrid() {
  return (
    <>
      {/* Mobile-only heading, ahead of the ExiusCart/Prodora pair — each
          ScrollLine below carries its own heading now, this one just
          introduces the section as a whole before any cards. Hidden from
          sm up — desktop/tablet keep the original heading as normal-flow
          content above this section in page.tsx. */}
      <div className="sm:hidden shrink-0 pt-24 pb-4 px-6 text-center max-w-2xl mx-auto">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#6B3FD9] mb-2">
          Connected everywhere
        </p>
        <h2 className="text-4xl font-black text-gray-900 leading-[1.05] tracking-tight">
          Every channel,<br />one hub.
        </h2>
      </div>

      {/* Row 1 — ExiusCart + Prodora, tilted toward each other like a
          leaning pair of cards. On mobile, stacked vertically at full card
          width/normal 4:5 ratio (was two tilted cards squeezed to 40vw
          each side by side — too small to actually read). The tilted
          "leaning pair" only kicks in from sm+, where there's enough width
          for two side by side to still read comfortably. Plain static
          content, deliberately outside the sticky scroll-jack lines below —
          it's only two cards and never needs to scroll. Found by id (not
          array position) so this survives future reordering. */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 lg:gap-24 px-6 pb-8 lg:pb-14">
        {(() => {
          const exiuscart = CARDS.find(c => c.id === 'exiuscart');
          const prodora = CARDS.find(c => c.id === 'prodora');
          const pairWidth = 'sm:!w-[330px] lg:!w-[360px]';
          return (
            <>
              {exiuscart && <Card card={exiuscart} className={`sm:rotate-[6deg] sm:hover:rotate-0 sm:hover:-translate-x-4 sm:origin-bottom-left ${pairWidth}`} />}
              {prodora && <Card card={prodora} className={`sm:rotate-[-6deg] sm:hover:rotate-0 sm:active:translate-x-4 sm:origin-bottom-right ${pairWidth}`} />}
            </>
          );
        })()}
      </div>

      {/* "What is Prodora" explainer — sits between the ExiusCart/Prodora
          leaning pair (which only names it) and the two channel lines
          below. Plain normal-flow content, not part of any sticky track.
          Gradient top border + glow behind the logo match the same purple
          -> cyan accent motif already established on this page's Custom
          Website section, so this doesn't feel like a one-off style. */}
      <div className="px-6 py-16 sm:py-20">
        <div className="relative max-w-6xl mx-auto rounded-[2rem] overflow-hidden border border-white/10" style={{ background: '#0B1121' }}>
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, #7B4FE9 30%, #06B6D4 70%, transparent 100%)' }} />
          <div className="relative p-8 sm:p-12 lg:p-14 flex flex-col sm:flex-row items-center gap-8 sm:gap-12">
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 shrink-0">
              <div className="absolute inset-0 rounded-3xl blur-2xl opacity-40" style={{ background: 'radial-gradient(circle, #6B3FD9 0%, transparent 70%)' }} />
              <div className="relative w-full h-full rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Image src="/prodora-logo.png" alt="Prodora" width={80} height={80} className="w-16 h-16 sm:w-20 sm:h-20 object-contain" />
              </div>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#6B3FD9] mb-2">What is Prodora?</p>
              <h3 className={`${archivoBlack.className} text-2xl sm:text-3xl lg:text-4xl text-white leading-[1.1] tracking-tight mb-4`}>
                Your product research engine, built into ExiusCart.
              </h3>
              <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-7 max-w-2xl">
                Prodora finds winning products for you — sourced from CJ Dropshipping, private China suppliers, HyperSku, Zendrop, AliExpress, Alibaba and 1688 — complete with ready-made photos, videos and real reviews. Browse the catalog, pick what you want to sell, and one click adds it straight into your ExiusCart store, priced and ready to go.
              </p>
              <a
                href="https://prodora.exiuscart.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#6B3FD9] hover:bg-[#7B4FE9] text-white font-semibold text-sm px-6 py-3.5 rounded-full transition shadow-[0_0_24px_rgba(107,63,217,0.45)] hover:shadow-[0_0_32px_rgba(107,63,217,0.6)]"
              >
                Explore Prodora
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Line 1 — Own Store. Independent stick-and-scroll section. */}
      <ScrollLine heading="Your Own Store" kicker="Own the customer" ids={OWN_STORE_IDS} />

      {/* Line 2 — Marketplaces, TheDersi last. Independent stick-and-scroll
          section, same treatment as Line 1, pins and scrolls after it. */}
      <ScrollLine heading="Sell on Every Marketplace" kicker="Reach every shopper" ids={MARKETPLACE_IDS} />
    </>
  );
}
