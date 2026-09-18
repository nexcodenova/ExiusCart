// A composition/breakdown chart (revenue by channel, fulfillment status
// split, etc.) — companion to BarChart.tsx/AreaChart.tsx, same color
// palette and tooltip language (chart-utils.ts). Hand-built rather than a
// literal Tremor Raw port, scoped to what the Analytics dashboards need: a
// donut with a centered total and a legend that also shows each slice's
// share of the whole.
'use client';

import React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { AvailableChartColors, AvailableChartColorsKeys, constructCategoryColors, getColorClassName } from './chart-utils';
import { cn } from '@/lib/utils';

interface DonutChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: Record<string, any>[];
  category: string; // the numeric field to sum/plot
  index: string;     // the label field
  colors?: AvailableChartColorsKeys[];
  valueFormatter?: (value: number) => string;
  showLabel?: boolean;
  label?: string;
  showTooltip?: boolean;
}

const DonutTooltip = ({
  active, payload, valueFormatter, total,
}: { active?: boolean; payload?: any[]; valueFormatter: (value: number) => string; total: number }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  const value = item.value as number;
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  return (
    <div className={cn('rounded-md border text-sm shadow-md px-4 py-2.5', 'border-gray-200 dark:border-gray-800', 'bg-white dark:bg-gray-950')}>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: item.payload.fill }} />
        <p className="font-medium text-gray-900 dark:text-gray-50">{item.name}</p>
      </div>
      <p className="mt-1 text-gray-700 dark:text-gray-300 tabular-nums">{valueFormatter(value)} <span className="text-gray-400">· {pct}%</span></p>
    </div>
  );
};

const DonutChart = React.forwardRef<HTMLDivElement, DonutChartProps>((props, forwardedRef) => {
  const {
    data = [], category, index, colors = AvailableChartColors,
    valueFormatter = (value: number) => value.toString(),
    showLabel = true, label, showTooltip = true, className, ...other
  } = props;
  const categories = data.map((d) => d[index]);
  const categoryColors = constructCategoryColors(categories, colors);
  const total = data.reduce((sum, d) => sum + (Number(d[category]) || 0), 0);

  return (
    <div ref={forwardedRef} className={cn('flex flex-col items-center gap-4 sm:flex-row', className)} {...other}>
      <div className="relative h-56 w-56 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data} dataKey={category} nameKey={index}
              innerRadius="65%" outerRadius="100%" stroke="" paddingAngle={2}
              isAnimationActive animationDuration={700} animationEasing="ease-out"
            >
              {data.map((entry, i) => (
                <Cell key={`cell-${i}`} className={getColorClassName(categoryColors.get(entry[index]) ?? 'gray', 'fill')} />
              ))}
            </Pie>
            {showTooltip && (
              <Tooltip
                wrapperStyle={{ outline: 'none' }}
                content={({ active, payload }) => <DonutTooltip active={active} payload={payload as any[]} valueFormatter={valueFormatter} total={total} />}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
        {showLabel && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-xl font-bold text-gray-900 dark:text-gray-50 tabular-nums">{valueFormatter(total)}</p>
            {label && <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>}
          </div>
        )}
      </div>
      <div className="flex w-full flex-col gap-2">
        {data.map((entry) => {
          const value = Number(entry[category]) || 0;
          const pct = total > 0 ? ((value / total) * 100).toFixed(0) : '0';
          return (
            <div key={entry[index]} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn('size-2.5 shrink-0 rounded-sm', getColorClassName(categoryColors.get(entry[index]) ?? 'gray', 'bg'))} />
                <span className="truncate text-gray-700 dark:text-gray-300">{entry[index]}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-medium text-gray-900 dark:text-gray-50 tabular-nums">{valueFormatter(value)}</span>
                <span className="text-xs text-gray-400 tabular-nums w-9 text-right">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
DonutChart.displayName = 'DonutChart';

export { DonutChart };
