// CSS-only recreation of MagicUI's BorderBeam — see exiuscart-store's
// version of this file for the full rationale (no framer-motion
// dependency, @property-driven conic-gradient instead).
export function BorderBeam({
  className,
  colorFrom = '#7B4FE9',
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
