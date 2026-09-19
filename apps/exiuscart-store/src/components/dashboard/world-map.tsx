'use client';

import { useState } from 'react';
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);
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
            const id = geo.id as string;
            const count = byNumericId[id];
            const isHovered = hoveredId === id;
            const intensity = count ? 0.3 + (count / maxCustomers) * 0.6 + (isHovered ? 0.15 : 0) : isHovered ? 0.2 : 0;
            // react-simple-maps v5's Geography is a plain <path> that
            // spreads props straight onto the element (confirmed by reading
            // the installed package's own source) -- fill/stroke need to be
            // real top-level props here, not nested in a style object. An
            // earlier version of this file passed a {default,hover,pressed}
            // style shape (the OLD react-simple-maps API, pre-v4) which v5
            // silently ignores since `default`/`hover` aren't real CSS
            // properties -- that's why every country rendered as plain
            // black (the browser's SVG fill default) instead of any color
            // set here at all.
            const fill = count ? `rgba(99, 102, 241, ${intensity})` : `rgba(148, 163, 184, ${0.3 + (isHovered ? 0.15 : 0)})`;
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={fill}
                stroke="rgba(148, 163, 184, 0.5)"
                strokeWidth={0.4}
                onMouseEnter={() => setHoveredId(id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ outline: 'none' }}
              />
            );
          })
        }
      </Geographies>
    </ComposableMap>
  );
}
