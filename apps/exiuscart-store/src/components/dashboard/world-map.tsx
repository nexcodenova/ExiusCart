'use client';

import { useState } from 'react';
import enLocale from 'i18n-iso-countries/langs/en.json';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import isoCountries from 'i18n-iso-countries';
import { CountryFlag } from '@/components/country-flag';

// world-atlas's TopoJSON keys each country by its numeric ISO 3166-1 code,
// not the 2-letter code the rest of this app uses — i18n-iso-countries maps
// between the two for every country, so any visitor/customer country lights
// up, not just a hand-picked handful.
// Served from this app's own /public (copied from the world-atlas npm
// package, which stays in package.json purely to document provenance) —
// not fetched from a CDN. The flag icons in this same widget used to hit
// cdn.jsdelivr.net at runtime and silently render as broken images for
// anyone whose ad-blocker/DNS filter blocks that host; the map used the
// same CDN for its TopoJSON and would have failed the exact same way.
const GEO_URL = '/maps/world-110m.json';

const numericToIso2 = (id: string): string | undefined => isoCountries.numericToAlpha2(id);

isoCountries.registerLocale(enLocale);

interface CountryRow { code: string; country: string; customers: number; percentage: number }

export function WorldMap({
  data, metricLabel = 'Customers', selectedCode, onSelectCountry,
}: {
  data: CountryRow[];
  metricLabel?: string;
  selectedCode?: string | null;
  onSelectCountry?: (code: string | null) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const maxCustomers = Math.max(...data.map((d) => d.customers), 1);
  const byIso2: Record<string, CountryRow> = {};
  for (const d of data) byIso2[d.code] = d;
  const hovered = hoveredId ? byIso2[numericToIso2(hoveredId) ?? ''] : undefined;

  return (
    <div
      className="relative h-full w-full"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
    >
      <ComposableMap projection="geoMercator" projectionConfig={{ scale: 100, center: [10, 20] }} width={400} height={220} style={{ width: '100%', height: '100%' }}>
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const id = geo.id as string;
              const iso2 = numericToIso2(id);
              const row = iso2 ? byIso2[iso2] : undefined;
              const count = row?.customers;
              const isHovered = hoveredId === id;
              const isSelected = !!selectedCode && iso2 === selectedCode;
              const intensity = count ? 0.3 + (count / maxCustomers) * 0.6 + (isHovered || isSelected ? 0.15 : 0) : isHovered ? 0.2 : 0;
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
              const fill = count ? `rgba(59, 130, 246, ${intensity})` : `rgba(148, 163, 184, ${0.3 + (isHovered ? 0.15 : 0)})`;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke={isSelected ? 'rgba(37, 99, 235, 0.9)' : 'rgba(148, 163, 184, 0.5)'}
                  strokeWidth={isSelected ? 1.1 : 0.4}
                  onMouseEnter={() => setHoveredId(id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => {
                    if (!count || !onSelectCountry || !iso2) return;
                    onSelectCountry(selectedCode === iso2 ? null : iso2);
                  }}
                  style={{ outline: 'none', cursor: count ? 'pointer' : 'default' }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
      {hovered && mousePos && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: mousePos.x, top: mousePos.y - 8 }}
        >
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <CountryFlag code={hovered.code} className="h-3 w-4" />
            {hovered.country}
          </div>
          <div className="text-muted-foreground">
            {metricLabel} <span className="font-medium text-foreground">{hovered.customers}</span> · {hovered.percentage}%
          </div>
        </div>
      )}
    </div>
  );
}
