// Tremor chart color system — copied in from tremor.so (Tremor Raw, meant
// to be copied into your own project, not installed as a black-box
// package — same philosophy as shadcn/ui already used throughout this
// app). Maps a fixed palette of Tailwind color names to every class
// variant (bg/stroke/fill/text) Recharts-based components need, since
// Tailwind can't resolve a dynamically-built class string at build time —
// every className used here has to appear literally somewhere in the
// source for Tailwind's JIT compiler to generate it.
export const AvailableChartColors = [
  'blue', 'emerald', 'violet', 'amber', 'gray', 'cyan', 'pink', 'lime', 'fuchsia',
  // indigo/rose added — not in Tremor's own default palette, but they're
  // this dashboard's own established stat-tile colors (PeriodCard/
  // HealthCard on the main dashboard page), so charts sitting inside
  // those same tiles can match instead of introducing an unrelated hue.
  'indigo', 'rose',
] as const;

export type AvailableChartColorsKeys = (typeof AvailableChartColors)[number];

export const constructCategoryColors = (
  categories: string[],
  colors: readonly AvailableChartColorsKeys[],
): Map<string, AvailableChartColorsKeys> => {
  const categoryColors = new Map<string, AvailableChartColorsKeys>();
  categories.forEach((category, index) => {
    categoryColors.set(category, colors[index % colors.length]);
  });
  return categoryColors;
};

export const getYAxisDomain = (
  autoMinValue: boolean,
  minValue: number | undefined,
  maxValue: number | undefined,
): [number | string, number | string] => {
  const minDomain = autoMinValue ? 'auto' : (minValue ?? 0);
  const maxDomain = maxValue ?? 'auto';
  return [minDomain, maxDomain];
};

const chartColorsClassNames: Record<
  AvailableChartColorsKeys,
  { bg: string; stroke: string; fill: string; text: string }
> = {
  blue: { bg: 'bg-blue-500', stroke: 'stroke-blue-500', fill: 'fill-blue-500', text: 'text-blue-500' },
  emerald: { bg: 'bg-emerald-500', stroke: 'stroke-emerald-500', fill: 'fill-emerald-500', text: 'text-emerald-500' },
  violet: { bg: 'bg-violet-500', stroke: 'stroke-violet-500', fill: 'fill-violet-500', text: 'text-violet-500' },
  amber: { bg: 'bg-amber-500', stroke: 'stroke-amber-500', fill: 'fill-amber-500', text: 'text-amber-500' },
  gray: { bg: 'bg-gray-500', stroke: 'stroke-gray-500', fill: 'fill-gray-500', text: 'text-gray-500' },
  cyan: { bg: 'bg-cyan-500', stroke: 'stroke-cyan-500', fill: 'fill-cyan-500', text: 'text-cyan-500' },
  pink: { bg: 'bg-pink-500', stroke: 'stroke-pink-500', fill: 'fill-pink-500', text: 'text-pink-500' },
  lime: { bg: 'bg-lime-500', stroke: 'stroke-lime-500', fill: 'fill-lime-500', text: 'text-lime-500' },
  fuchsia: { bg: 'bg-fuchsia-500', stroke: 'stroke-fuchsia-500', fill: 'fill-fuchsia-500', text: 'text-fuchsia-500' },
  indigo: { bg: 'bg-indigo-500', stroke: 'stroke-indigo-500', fill: 'fill-indigo-500', text: 'text-indigo-500' },
  rose: { bg: 'bg-rose-500', stroke: 'stroke-rose-500', fill: 'fill-rose-500', text: 'text-rose-500' },
};

export const getColorClassName = (
  color: AvailableChartColorsKeys,
  type: 'bg' | 'stroke' | 'fill' | 'text',
): string => chartColorsClassNames[color]?.[type] ?? chartColorsClassNames.gray[type];
