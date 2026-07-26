'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { LayoutGrid, Flame, Tag } from 'lucide-react';
import { shoppingApi, Category } from '@/lib/api';

// Persistent left nav — same on every authenticated page (browse, product
// detail, etc.), sticky/fixed so it never scrolls away. Links are real
// <Link>s to /browse?view=... so the active item highlights correctly
// from any page, not just when local component state happens to match.
export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    shoppingApi.getCategories().then(setCategories).catch(() => {});
  }, []);

  const currentView = pathname === '/browse' ? (searchParams.get('view') || 'all') : null;

  return (
    <aside className="hidden lg:flex flex-col w-60 fixed inset-y-0 left-0 bg-white border-r border-[#E5E7EB] z-20">
      <Link href="/browse" className="flex items-center gap-2 px-4 h-16 border-b border-[#E5E7EB] shrink-0">
        <Image src="/prodora-logo.png" alt="Prodora" width={26} height={26} />
        <span className="font-extrabold text-[#111827] text-lg tracking-tight">Prodora</span>
      </Link>

      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        <div className="space-y-0.5">
          <SidebarNavItem href="/browse" label="All Products" icon={LayoutGrid} active={currentView === 'all'} />
          <SidebarNavItem href="/browse?view=trending" label="Trending" icon={Flame} active={currentView === 'trending'} />
        </div>

        <div>
          <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Categories</p>
          <div className="space-y-0.5">
            {categories.map(cat => (
              <SidebarNavItem key={cat.id} href={`/browse?view=${cat.slug}`} label={cat.name} icon={Tag} active={currentView === cat.slug} />
            ))}
            {categories.length === 0 && (
              <p className="text-xs text-gray-400 px-3 py-2">No categories yet</p>
            )}
          </div>
        </div>
      </nav>

      <div className="p-3 border-t border-[#E5E7EB] shrink-0">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Tag className="w-3.5 h-3.5 text-[#2563EB]" />
            <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">How it works</span>
          </div>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>✓ Browse winning products</li>
            <li>✓ Copy supplier links</li>
            <li>✓ List on your ExiusCart store</li>
            <li>✓ Start selling today</li>
          </ul>
          <a href="https://store.exiuscart.com" target="_blank" rel="noopener noreferrer"
            className="mt-2.5 block text-center text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1E4FC2] px-3 py-2 rounded-lg transition">
            Open My Store →
          </a>
        </div>
      </div>
    </aside>
  );
}

function SidebarNavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ElementType; active: boolean }) {
  return (
    <Link
      href={href}
      className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
        active ? 'bg-blue-50 text-[#2563EB] font-semibold' : 'text-gray-600 hover:bg-gray-50'
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
