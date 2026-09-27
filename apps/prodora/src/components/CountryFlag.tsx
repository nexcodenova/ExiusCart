// Flag pictures come from the flag-icons package bundled with the app (not emoji: Windows shows emoji flags as the
// letters "US"). Any two-letter country code works.
export function CountryFlag({ code, className = 'h-3.5 w-5' }: { code?: string | null; className?: string }) {
  if (!code || code.length !== 2) return <span className={`inline-block ${className}`} aria-hidden="true" />;
  return <span className={`fi fi-${code.toLowerCase()} inline-block shrink-0 rounded-[3px] ${className}`} role="img" aria-label={code.toUpperCase()} />;
}
