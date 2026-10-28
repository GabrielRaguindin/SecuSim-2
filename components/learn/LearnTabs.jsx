'use client';

import { usePathname } from 'next/navigation';
import Segmented from '@/components/ui/Segmented';

const OPTIONS = [
  { value: 'topologies', label: 'Topologies', href: '/learn/topologies' },
  { value: 'policies', label: 'Policies', href: '/learn/policies' },
  { value: 'addressing', label: 'Addressing', href: '/learn/addressing' },
  { value: 'cabling', label: 'Cabling', href: '/learn/cabling' },
];

export default function LearnTabs() {
  const pathname = usePathname() ?? '';
  const value = OPTIONS.find((o) => pathname.endsWith(`/${o.value}`))?.value ?? 'topologies';
  return <Segmented options={OPTIONS} value={value} label="Learn sections" />;
}
