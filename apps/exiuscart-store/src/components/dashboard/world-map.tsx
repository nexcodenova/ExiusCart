'use client';

import { useEffect, useState } from 'react';
import enLocale from 'i18n-iso-countries/langs/en.json';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
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
// 50m (not 110m): at 110m resolution small-but-real countries (Singapore,
// Bahrain, Malta, ...) have no polygon at all, so they'd only ever show as a
// dot next to a big country's full light-blue shape — an inconsistent look
// for no good reason. 50m carries a real shape for every sovereign country
// except a literal handful of Pacific micro-states, so every country now
// gets the same whole-shape highlight.
const GEO_URL = '/maps/world-50m.json';

const numericToIso2 = (id: string): string | undefined => isoCountries.numericToAlpha2(id);

isoCountries.registerLocale(enLocale);

interface CountryRow { code: string; country: string; customers: number; percentage: number }

// Even at 50m resolution, a literal couple of countries still have no
// polygon at all — Tuvalu is too small for Natural Earth's 50m cut, and
// Kosovo has no standard ISO numeric code to map a polygon id back to in
// the first place. These two still get a plain point marker; everything
// else (including Singapore, Bahrain, Malta, Monaco, ...) now has a real
// shape to shade.
const SMALL_COUNTRY_POINTS: Record<string, [number, number]> = {
  TV: [179.2, -8.5], XK: [20.9, 42.6],
};

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
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(t); }, []);
  const maxCustomers = Math.max(...data.map((d) => d.customers), 1);
  const byIso2: Record<string, CountryRow> = {};
  for (const d of data) byIso2[d.code] = d;
  const hovered = hoveredId ? byIso2[numericToIso2(hoveredId) ?? ''] : undefined;

  return (
    <div
      className="relative h-full w-full transition-opacity duration-700"
      style={{ opacity: ready ? 1 : 0 }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
    >
      <ComposableMap projection="geoMercator" projectionConfig={{ scale: 125, center: [12, 28] }} width={800} height={400} style={{ width: '100%', height: '100%' }}>
        <Geographies geography={GEO_URL}>
          {({ geographies }) => {
            const paths: React.ReactNode[] = [];
            const markers: React.ReactNode[] = [];
            let i = 0;
            for (const geo of geographies) {
              i += 1;
              const id = geo.id as string;
              const iso2 = numericToIso2(id);
              const row = iso2 ? byIso2[iso2] : undefined;
              const count = row?.customers;
              const isHovered = hoveredId === id;
              const isSelected = !!selectedCode && iso2 === selectedCode;
              // A country with even one hit should read as unmistakably
              // "lit up" at a glance, not just a faint tint next to a dot —
              // the whole shape carries the signal now, so the floor here
              // is high regardless of how small that count is next to the
              // busiest country.
              const intensity = count ? 0.55 + (count / maxCustomers) * 0.4 + (isHovered || isSelected ? 0.1 : 0) : isHovered ? 0.2 : 0;
              // react-simple-maps v5's Geography is a plain <path> that spreads props straight onto the element,
              // so fill/stroke are real top-level props here (the old {default,hover,pressed} style shape is ignored).
              const fill = count ? `rgba(79, 70, 229, ${intensity})` : `rgba(148, 163, 184, ${0.22 + (isHovered ? 0.15 : 0)})`;
              paths.push(
                <Geography
                  key={`${geo.rsmKey}-${i}`}
                  geography={geo}
                  fill={fill}
                  stroke={isSelected ? 'rgba(67, 56, 202, 0.95)' : 'rgba(148, 163, 184, 0.35)'}
                  strokeWidth={isSelected ? 1.1 : 0.4}
                  onMouseEnter={() => setHoveredId(id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => {
                    if (!count || !onSelectCountry || !iso2) return;
                    onSelectCountry(selectedCode === iso2 ? null : iso2);
                  }}
                  style={{ outline: 'none', cursor: count ? 'pointer' : 'default', transition: 'fill 250ms ease, stroke 250ms ease' }}
                />
              );
            }
            // Active countries that have no shape on this map still get a marker at a known point.
            const drawn = new Set(geographies.map((g) => numericToIso2(g.id as string)).filter(Boolean) as string[]);
            for (const row of data) {
              const fallback = SMALL_COUNTRY_POINTS[row.code];
              if (drawn.has(row.code) || !fallback || !row.customers) continue;
              const r = 2.5 + (row.customers / maxCustomers) * 3.5;
              markers.push(
                <Marker key={`s-${row.code}`} coordinates={fallback} style={{ pointerEvents: 'none' }}>
                  <circle r={r} fill="rgb(79, 70, 229)" stroke="white" strokeWidth={1} />
                </Marker>
              );
            }
            return <>{paths}{markers}</>;
          }}
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
