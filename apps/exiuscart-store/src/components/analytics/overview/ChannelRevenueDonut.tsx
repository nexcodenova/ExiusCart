'use client';

import { DonutChart } from '@/components/charts/DonutChart';

export default function ChannelRevenueDonut({ data, fmt }: { data: { channel: string; revenue: number }[]; fmt: (n: number) => string }) {
  if (!data.length) {
    return <p className="text-sm text-muted-foreground py-10 text-center">No orders in the last 30 days.</p>;
  }
  return <DonutChart data={data} category="revenue" index="channel" valueFormatter={fmt} label="30-day revenue" />;
}
