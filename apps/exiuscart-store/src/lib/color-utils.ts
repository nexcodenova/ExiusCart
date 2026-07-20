// Common color names a seller might type, mapped to a real swatch color.
// Covers ordinary English color words — anything fancier ("Rose Gold",
// "Ash Grey") won't match, and the seller can pick an exact shade manually
// instead (stored as color_hex on the variant, which always wins over this
// guess).
const COLOR_NAME_MAP: Record<string, string> = {
  red: '#DC2626', maroon: '#7F1D1D', crimson: '#B91C1C', burgundy: '#800020',
  pink: '#EC4899', magenta: '#D946EF', fuchsia: '#C026D3', rose: '#FB7185',
  orange: '#EA580C', peach: '#FFCBA4', coral: '#FF7F50',
  yellow: '#EAB308', gold: '#D4AF37', mustard: '#C9A227', cream: '#FFFDD0', beige: '#E8DCC4',
  green: '#16A34A', olive: '#6B8E23', khaki: '#C3B091', mint: '#98FF98', teal: '#0D9488', emerald: '#10B981',
  blue: '#2563EB', navy: '#1E3A8A', 'navy blue': '#1E3A8A', sky: '#0EA5E9', 'sky blue': '#0EA5E9',
  cyan: '#06B6D4', turquoise: '#40E0D0',
  purple: '#9333EA', violet: '#8B5CF6', lavender: '#B57EDC', indigo: '#4F46E5', plum: '#8E4585',
  brown: '#78350F', tan: '#D2B48C', chocolate: '#7B3F00', coffee: '#6F4E37', camel: '#C19A6B',
  grey: '#6B7280', gray: '#6B7280', charcoal: '#36454F', silver: '#C0C0C0',
  black: '#111827', white: '#F9FAFB', ivory: '#FFFFF0',
  multi: '#9CA3AF', 'multi color': '#9CA3AF', 'multicolor': '#9CA3AF',
};

export function colorNameToHex(name: string | null | undefined): string | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  return COLOR_NAME_MAP[key] ?? null;
}
