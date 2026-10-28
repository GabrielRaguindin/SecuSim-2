'use client';

import { usePathname } from 'next/navigation';
import Segmented from '@/components/ui/Segmented';

const OPTIONS = [
  { value: 'topologies', label: 'Topologies', href: '/learn/topologies' },
  { value: 'policies', label: 'Policies', href: '/learn/policies' },
];

export default function LearnTabs() {
  const pathname = usePathname() ?? '';
  const value = pathname.endsWith('/policies') ? 'policies' : 'topologies';
  return <Segmented options={OPTIONS} value={value} label="Learn sections" />;
}
