// Bundled via the `flag-icons` package (imported once in app/layout.tsx),
// not fetched from a CDN at runtime — an earlier version used
// react-country-flag's `svg` mode, which pulls each flag from
// cdn.jsdelivr.net/gh/lipis/flag-icons/... on every render. That GitHub-raw
// proxy path is a common false-positive target for ad-blockers and DNS
// filters, so the flag silently never rendered for some users. Same icon
// set, same author, just shipped in the app's own bundle instead.
export function CountryFlag({ code, className = 'h-4 w-5' }: { code: string; className?: string }) {
  if (code.length !== 2) return <span className={`inline-block ${className}`} aria-hidden="true" />;
  return (
    <span
      className={`fi fi-${code.toLowerCase()} inline-block shrink-0 rounded-sm ${className}`}
      role="img"
      aria-label={code}
    />
  );
}
