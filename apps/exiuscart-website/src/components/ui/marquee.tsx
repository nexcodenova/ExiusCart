import { cn } from '@/lib/utils';

// CSS-only recreation of MagicUI's Marquee — same API (reverse,
// pauseOnHover, repeat), built with plain @keyframes instead of
// framer-motion since that isn't a dependency in this app. See
// globals.css's .animate-marquee for the actual animation.
interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  children?: React.ReactNode;
  repeat?: number;
}

export function Marquee({
  className,
  reverse,
  pauseOnHover = false,
  children,
  repeat = 4,
  ...props
}: MarqueeProps) {
  return (
    <div
      {...props}
      // Fade-mask at both edges — MagicUI's real Marquee ships with this by
      // default; this CSS-only recreation never had it, so cards scrolling
      // in/out looked like they were getting hard-sliced at the edge
      // rather than fading in/out smoothly. More noticeable on mobile,
      // where a card's full width is a much bigger share of the viewport,
      // so there's proportionally more "edge" and less "safe middle."
      // Both mask-image and the -webkit- prefixed version are set since
      // Safari still needs the prefix for this property.
      style={{
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
        maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
      }}
      className={cn('group flex overflow-hidden [--gap:1.5rem] gap-[var(--gap)]', className)}
    >
      {Array.from({ length: repeat }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex shrink-0 justify-around gap-[var(--gap)] animate-marquee',
            pauseOnHover && 'group-hover:[animation-play-state:paused]',
            reverse && '[animation-direction:reverse]'
          )}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
