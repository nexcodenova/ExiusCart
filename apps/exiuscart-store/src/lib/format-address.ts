/** An order's shipping address as readable lines. Orders from a website that sends the address as separate
 *  fields keep it as JSON; older or plain-text ones are just a string, shown as they are. */
export function addressLines(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const d = JSON.parse(raw);
    if (d && typeof d === 'object' && !Array.isArray(d)) {
      const s = (...keys: string[]) => { for (const k of keys) if (d[k] && String(d[k]).trim()) return String(d[k]).trim(); return ''; };
      const cityLine = [s('city'), [s('province', 'state', 'region'), s('zip', 'postal_code', 'postcode')].filter(Boolean).join(' ')].filter(Boolean).join(', ');
      const lines = [s('name', 'full_name'), [s('address', 'address1', 'street'), s('address2')].filter(Boolean).join(', '), cityLine, s('country', 'country_code'), s('phone')].filter(Boolean);
      if (lines.length) return lines;
    }
  } catch { /* plain text */ }
  return [raw];
}

export const addressText = (raw: string | null | undefined) => addressLines(raw).join(', ');
