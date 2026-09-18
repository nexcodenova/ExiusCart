// Regional-indicator flag emoji, computed from a 2-letter ISO code rather
// than a hardcoded per-country image/lookup — works for any real code the
// backend sends without keeping a separate flag list in sync.
export function flagEmoji(code: string): string {
  if (code.length !== 2) return '🏳️';
  const points = [...code.toUpperCase()].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...points);
}
