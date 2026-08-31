// A CSS-only recreation of MagicUI's BorderBeam — a comet of light that
// travels around a card's border on loop. The real magicui component
// (registry/magicui/border-beam) animates via framer-motion, which isn't
// a dependency in this app; @property + a rotating conic-gradient gets
// the same visual with zero new packages, matching this codebase's
// lightweight-first convention. Parent needs `relative overflow-hidden`
// and a border-radius for the mask to read correctly.
export function BorderBeam({
  className,
  colorFrom = '#6B3FD9',
  colorTo = '#A78BFA',
  duration = 6,
}: {
  className?: string;
  colorFrom?: string;
  colorTo?: string;
  duration?: number;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 rounded-[inherit] ${className ?? ''}`}
      style={{
        padding: '1.5px',
        background: `conic-gradient(from var(--border-beam-angle, 0deg), transparent 0%, transparent 74%, ${colorFrom} 84%, ${colorTo} 90%, transparent 100%)`,
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        animation: `border-beam-spin ${duration}s linear infinite`,
      }}
    />
  );
}
