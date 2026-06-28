'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';

interface Stats {
  orders_processed: number;
  emails_generated: number;
  products_added: number;
}

function fmt(n: number | null): string {
  if (n === null) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k+`;
  return `${n}+`;
}

export function LiveStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch(`${API}/api/v1/public/stats`)
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {});
  }, []);

  return (
    <div className="mt-16 pt-12 border-t border-gray-800">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6 md:gap-8">
        <StatItem value={fmt(stats?.orders_processed ?? null)} label="Orders Processed" live />
        <StatItem value={fmt(stats?.emails_generated ?? null)} label="Emails Generated" live />
        <StatItem value={fmt(stats?.products_added ?? null)} label="Products Added" live />
        <StatItem value="99.9%" label="Uptime" />
        <StatItem value="14-day" label="Free Trial" />
      </div>
    </div>
  );
}

function StatItem({ value, label, live }: { value: string; label: string; live?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-3xl md:text-4xl font-bold text-[#6B3FD9] mb-1 flex items-center justify-center gap-2">
        {value}
        {live && value !== '—' && (
          <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" title="Live count" />
        )}
      </p>
      <p className="text-gray-400 text-sm">{label}</p>
    </div>
  );
}
