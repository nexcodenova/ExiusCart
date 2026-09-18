'use client';

import { ComposableMap, Geographies, Geography } from 'react-simple-maps';

// world-atlas's TopoJSON keys each country by its numeric ISO 3166-1 code,
// not the 2-letter code the rest of this app uses — this is the mapping for
// the handful of countries app/core/country_utils.py already recognizes.
const ISO2_TO_NUMERIC: Record<string, string> = {
  AE: '784', LK: '144', US: '840', GB: '826', CA: '124',
  IN: '356', PK: '586', BD: '050', NP: '524', MM: '104',
};

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

export function WorldMap({ data }: { data: { code: string; customers: number }[] }) {
  const maxCustomers = Math.max(...data.map((d) => d.customers), 1);
  const byNumericId: Record<string, number> = {};
  for (const d of data) {
    const numericId = ISO2_TO_NUMERIC[d.code];
    if (numericId) byNumericId[numericId] = d.customers;
  }

  return (
    <ComposableMap projection="geoMercator" projectionConfig={{ scale: 100, center: [10, 20] }} width={400} height={220} style={{ width: '100%', height: '100%' }}>
      <Geographies geography={GEO_URL}>
        {({ geographies }) =>
          geographies.map((geo) => {
            const count = byNumericId[geo.id as string];
            const intensity = count ? 0.3 + (count / maxCustomers) * 0.6 : 0;
            // react-simple-maps applies these fills outside the normal React
            // style cascade, so CSS custom properties (var(--muted)) never
            // resolved here — they rendered as literal black, not the
            // intended theme color. Explicit, theme-agnostic grays instead.
            const baseFill = count ? `rgba(99, 102, 241, ${intensity})` : 'rgba(148, 163, 184, 0.3)';
            const hoverFill = count ? `rgba(99, 102, 241, ${Math.min(intensity + 0.15, 0.9)})` : 'rgba(148, 163, 184, 0.45)';
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                // @types/react-simple-maps types `style` as plain
                // CSSProperties, but the library (v5, confirmed in
                // node_modules) actually implements the documented
                // {default,hover,pressed} per-state shape at runtime —
                // the community types package just hasn't caught up.
                style={{
                  default: { outline: 'none', fill: baseFill, stroke: 'rgba(148, 163, 184, 0.5)', strokeWidth: 0.4 },
                  hover: { outline: 'none', fill: hoverFill, stroke: 'rgba(148, 163, 184, 0.5)', strokeWidth: 0.4 },
                  pressed: { outline: 'none', fill: hoverFill, stroke: 'rgba(148, 163, 184, 0.5)', strokeWidth: 0.4 },
                } as React.CSSProperties}
              />
            );
          })
        }
      </Geographies>
    </ComposableMap>
  );
}
