'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';

export function LiveStats() {
  const [activeShops, setActiveShops] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API}/api/v1/public/stats`)
      .then(r => r.json())
      .then(d => setActiveShops(d.active_shops))
      .catch(() => {});
  }, []);

  const display = activeShops === null ? '—' : activeShops > 0 ? `${activeShops}+` : String(activeShops);

  return (
    <div className="mt-16 pt-12 border-t border-gray-800">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatItem value={display} label="Active Shops" live />
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
