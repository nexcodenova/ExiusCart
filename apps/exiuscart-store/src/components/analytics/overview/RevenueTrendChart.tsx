'use client';

import { AreaChart } from '@/components/charts/AreaChart';

export default function RevenueTrendChart({ data, fmt }: { data: { month: string; Revenue: number; Orders: number }[]; fmt: (n: number) => string }) {
  return (
    <AreaChart
      data={data}
      index="month"
      categories={['Revenue']}
      colors={['blue']}
      valueFormatter={fmt}
      showLegend={false}
    />
  );
}
