'use client';

import { AreaChart } from '@/components/charts/AreaChart';

export default function CustomerGrowthChart({ data }: { data: { month: string; 'New customers': number }[] }) {
  return (
    <AreaChart
      data={data}
      index="month"
      categories={['New customers']}
      colors={['emerald']}
      valueFormatter={(v) => v.toLocaleString()}
      showLegend={false}
    />
  );
}
