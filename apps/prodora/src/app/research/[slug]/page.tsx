'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Compass, Swords } from 'lucide-react';
import ComingSoon from '@/components/ComingSoon';

const PAGES: Record<string, { icon: React.ElementType; title: string; description: string; points: string[] }> = {
  'store-explorer': {
    icon: Compass,
    title: 'Store Explorer',
    description: 'Discover which stores are selling a product and how they are doing.',
    points: ['See top stores for a product', 'Spot what they sell best', 'Find gaps you can fill'],
  },
  'competitor-research': {
    icon: Swords,
    title: 'Competitor Research',
    description: 'Look up a competitor and see what they are selling and advertising.',
    points: ['Track a competitor store', 'See their best-selling products', 'Watch their ads'],
  },
};

function Content() {
  const { slug } = useParams<{ slug: string }>();
  const page = PAGES[slug] ?? PAGES['store-explorer'];
  return <ComingSoon {...page} />;
}

export default function ResearchPage() {
  return <Suspense fallback={null}><Content /></Suspense>;
}
