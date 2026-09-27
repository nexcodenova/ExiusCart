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
const GEO_URL = '/maps/world-110m.json';

const numericToIso2 = (id: string): string | undefined => isoCountries.numericToAlpha2(id);

isoCountries.registerLocale(enLocale);

interface CountryRow { code: string; country: string; customers: number; percentage: number }

// The 110m world map leaves out very small countries, so an active country with no shape on the map still gets its
// marker here (longitude, latitude).
const SMALL_COUNTRY_POINTS: Record<string, [number, number]> = {
  SG: [103.82, 1.35], HK: [114.17, 22.32], MO: [113.54, 22.2], BH: [50.55, 26.07], MT: [14.4, 35.9], MU: [57.55, -20.2],
  MV: [73.5, 3.2], BB: [-59.55, 13.19], AD: [1.6, 42.5], MC: [7.42, 43.73], LI: [9.55, 47.16], SM: [12.46, 43.94],
  KM: [43.87, -11.7], SC: [55.45, -4.68], ST: [6.61, 0.19], CV: [-23.6, 15.1], AG: [-61.8, 17.06], DM: [-61.37, 15.41],
  LC: [-60.98, 13.9], VC: [-61.2, 13.25], GD: [-61.68, 12.12], KN: [-62.75, 17.35], TO: [-175.2, -21.2], WS: [-172.1, -13.76],
  FM: [158.2, 6.9], MH: [171.2, 7.1], KI: [173.0, 1.87], NR: [166.93, -0.53], TV: [179.2, -8.5], PW: [134.5, 7.5],
  BN: [114.7, 4.5], QA: [51.2, 25.3], KW: [47.6, 29.3], LU: [6.13, 49.8], XK: [20.9, 42.6], PS: [35.2, 31.9],
};

// Middle of the bounding box of a country's largest polygon: a good enough place for a pulse marker
// (a true centroid would pull in d3-geo, and a marker only needs to sit on the right country).
function markerPoint(geometry: any): [number, number] | null {
  const polys: number[][][][] = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
  let best: { area: number; point: [number, number] } | null = null;
  for (const poly of polys) {
    const ring = poly[0];
    if (!ring?.length) continue;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of ring) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const area = (maxX - minX) * (maxY - minY);
    if (!best || area > best.area) best = { area, point: [(minX + maxX) / 2, (minY + maxY) / 2] };
  }
  return best ? best.point : null;
}

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
            for (const geo of geographies) {
              const id = geo.id as string;
              const iso2 = numericToIso2(id);
              const row = iso2 ? byIso2[iso2] : undefined;
              const count = row?.customers;
              const isHovered = hoveredId === id;
              const isSelected = !!selectedCode && iso2 === selectedCode;
              const intensity = count ? 0.3 + (count / maxCustomers) * 0.6 + (isHovered || isSelected ? 0.15 : 0) : isHovered ? 0.2 : 0;
              // react-simple-maps v5's Geography is a plain <path> that spreads props straight onto the element,
              // so fill/stroke are real top-level props here (the old {default,hover,pressed} style shape is ignored).
              const fill = count ? `rgba(59, 130, 246, ${intensity})` : `rgba(148, 163, 184, ${0.3 + (isHovered ? 0.15 : 0)})`;
              paths.push(
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
                  style={{ outline: 'none', cursor: count ? 'pointer' : 'default', transition: 'fill 250ms ease, stroke 250ms ease' }}
                />
              );
              if (count) {
                const point = markerPoint(geo.geometry);
                if (point) {
                  const r = 2.5 + (count / maxCustomers) * 3.5;
                  markers.push(
                    <Marker key={`m-${geo.rsmKey}`} coordinates={point} style={{ pointerEvents: 'none' }}>
                      <circle r={r} fill="rgb(37, 99, 235)" stroke="white" strokeWidth={1} />
                    </Marker>
                  );
                }
              }
            }
            // Active countries that have no shape on this map still get a marker at a known point.
            const drawn = new Set(geographies.map((g) => numericToIso2(g.id as string)).filter(Boolean) as string[]);
            for (const row of data) {
              const fallback = SMALL_COUNTRY_POINTS[row.code];
              if (drawn.has(row.code) || !fallback || !row.customers) continue;
              const r = 2.5 + (row.customers / maxCustomers) * 3.5;
              markers.push(
                <Marker key={`s-${row.code}`} coordinates={fallback} style={{ pointerEvents: 'none' }}>
                  <circle r={r} fill="rgb(37, 99, 235)" stroke="white" strokeWidth={1} />
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
