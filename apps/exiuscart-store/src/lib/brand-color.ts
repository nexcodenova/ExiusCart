/**
 * Converts a hex color string to HSL components.
 * Returns null if the hex is invalid or missing.
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Inject brand/accent colors as CSS custom properties on <html>.
 * Falls back to default Indigo (#6366f1) if no color is set.
 */
export function applyBrandColor(primaryHex?: string | null, accentHex?: string | null): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  const primary = primaryHex || null;
  const accent = accentHex || (primary ? lighten(primary) : null);

  if (primary) {
    const hsl = hexToHsl(primary);
    if (hsl) {
      root.style.setProperty('--primary', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
      root.style.setProperty('--primary-foreground', hsl.l > 50 ? '0 0% 0%' : '0 0% 100%');
      root.style.setProperty('--ring', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
    }
  }

  if (accent) {
    const hsl = hexToHsl(accent);
    if (hsl) {
      root.style.setProperty('--accent', `${hsl.h} ${hsl.s}% ${Math.min(hsl.l + 10, 95)}%`);
    }
  }
}

/** Lighten a hex color by 15% lightness for use as accent. */
function lighten(hex: string): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  const l = Math.min(hsl.l + 15, 90);
  return hslToHex(hsl.h, hsl.s, l);
}

function hslToHex(h: number, s: number, l: number): string {
  const sl = s / 100, ll = l / 100;
  const a = sl * Math.min(ll, 1 - ll);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
