// A trend chart (gradient-filled area, one or more series) built as a
// companion to BarChart.tsx — shares its color palette and tooltip
// language (chart-utils.ts) so a page mixing both chart types reads as one
// system, but this one is hand-built rather than a literal Tremor Raw port
// (Tremor's own AreaChart is considerably larger; this covers what the
// Analytics dashboards actually need — multi-series revenue/order trends
// with a gradient fill — without carrying code for features unused here).
'use client';

import React from 'react';
import {
  Area,
  CartesianGrid,
  AreaChart as RechartsAreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { AvailableChartColors, AvailableChartColorsKeys, constructCategoryColors, getColorClassName } from './chart-utils';
import { cn } from '@/lib/utils';

interface AreaChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: Record<string, any>[];
  index: string;
  categories: string[];
  colors?: AvailableChartColorsKeys[];
  valueFormatter?: (value: number) => string;
  showXAxis?: boolean;
  showYAxis?: boolean;
  showGridLines?: boolean;
  showTooltip?: boolean;
  showLegend?: boolean;
  yAxisWidth?: number;
  connectNulls?: boolean;
  curveType?: 'linear' | 'monotone';
}

const ChartTooltip = ({
  active, payload, label, valueFormatter, categoryColors,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  valueFormatter: (value: number) => string;
  categoryColors: Map<string, AvailableChartColorsKeys>;
}) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className={cn('rounded-md border text-sm shadow-md', 'border-gray-200 dark:border-gray-800', 'bg-white dark:bg-gray-950')}>
      <div className="border-b border-inherit px-4 py-2">
        <p className={cn('font-medium', 'text-gray-900 dark:text-gray-50')}>{label}</p>
      </div>
      <div className="space-y-1 px-4 py-2">
        {payload.map((item, index) => (
          <div key={`id-${index}`} className="flex items-center justify-between gap-8">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-sm', getColorClassName(categoryColors.get(item.dataKey) ?? 'gray', 'bg'))} />
              <p className={cn('whitespace-nowrap text-right', 'text-gray-700 dark:text-gray-300')}>{item.dataKey}</p>
            </div>
            <p className={cn('whitespace-nowrap text-right font-medium tabular-nums', 'text-gray-900 dark:text-gray-50')}>
              {valueFormatter(item.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

const AreaChart = React.forwardRef<HTMLDivElement, AreaChartProps>((props, forwardedRef) => {
  const {
    data = [], categories = [], index, colors = AvailableChartColors,
    valueFormatter = (value: number) => value.toString(),
    showXAxis = true, showYAxis = true, showGridLines = true, showTooltip = true, showLegend = true,
    yAxisWidth = 56, connectNulls = false, curveType = 'monotone', className, ...other
  } = props;
  const categoryColors = constructCategoryColors(categories, colors);

  return (
    <div ref={forwardedRef} className={cn('h-80 w-full', className)} {...other}>
      <ResponsiveContainer>
        <RechartsAreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            {categories.map((category) => {
              const color = categoryColors.get(category) ?? 'gray';
              return (
                <linearGradient key={category} id={`gradient-${category}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" className={getColorClassName(color, 'stroke')} stopOpacity={0.35} />
                  <stop offset="95%" className={getColorClassName(color, 'stroke')} stopOpacity={0.02} />
                </linearGradient>
              );
            })}
          </defs>
          {showGridLines && <CartesianGrid className="stroke-gray-200 stroke-1 dark:stroke-gray-800" vertical={false} />}
          <XAxis
            hide={!showXAxis} dataKey={index} tickLine={false} axisLine={false}
            tick={{ transform: 'translate(0, 6)' }} minTickGap={5}
            className="text-xs fill-gray-500 dark:fill-gray-500"
          />
          <YAxis
            hide={!showYAxis} width={yAxisWidth} tickLine={false} axisLine={false}
            tickFormatter={valueFormatter} tick={{ transform: 'translate(-3, 0)' }}
            className="text-xs fill-gray-500 dark:fill-gray-500"
          />
          {showTooltip && (
            <Tooltip
              wrapperStyle={{ outline: 'none' }}
              cursor={{ stroke: '#9ca3af', strokeDasharray: '3 3' }}
              content={({ active, payload, label }) => (
                <ChartTooltip active={active} payload={payload as any[]} label={label as string} valueFormatter={valueFormatter} categoryColors={categoryColors} />
              )}
            />
          )}
          {categories.map((category) => {
            const color = categoryColors.get(category) ?? 'gray';
            return (
              <Area
                key={category} name={category} type={curveType} dataKey={category}
                stroke="" strokeWidth={2} fill={`url(#gradient-${category})`}
                className={getColorClassName(color, 'stroke')}
                connectNulls={connectNulls} isAnimationActive animationDuration={700} animationEasing="ease-out"
                dot={false} activeDot={{ r: 4, className: getColorClassName(color, 'fill'), strokeWidth: 0 }}
              />
            );
          })}
        </RechartsAreaChart>
      </ResponsiveContainer>
      {showLegend && categories.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
          {categories.map((category) => (
            <div key={category} className="flex items-center gap-1.5">
              <span className={cn('size-2 shrink-0 rounded-sm', getColorClassName(categoryColors.get(category) ?? 'gray', 'bg'))} />
              <span className="text-xs text-gray-700 dark:text-gray-300">{category}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
AreaChart.displayName = 'AreaChart';

export { AreaChart };
