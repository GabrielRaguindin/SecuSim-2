'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/learn', label: 'Learn' },
  { href: '/sandbox', label: 'Sandbox' },
  { href: '/simulator', label: 'Simulator' },
  { href: '/results', label: 'Results' },
  { href: '/about', label: 'About' },
];

export function LogoMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="8" fill="var(--accent)" />
      <path d="M14 8 L20.4 18.4 H7.6 Z" fill="none" stroke="var(--on-accent)" strokeWidth="1.6" strokeLinejoin="round" />
      <g fill="var(--on-accent)">
        <circle cx="14" cy="8" r="2.5" />
        <circle cx="20.4" cy="18.4" r="2.5" />
        <circle cx="7.6" cy="18.4" r="2.5" />
      </g>
    </svg>
  );
}

export default function SiteNav() {
  const pathname = usePathname() ?? '';
  return (
    <header className="sx-nav">
      <Link href="/" className="sx-nav__brand" aria-label="SecuSim home">
        <LogoMark />
        <span>SecuSim</span>
      </Link>
      <nav className="sx-nav__links" aria-label="Main">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="sx-nav__link"
            aria-current={pathname === l.href || pathname.startsWith(`${l.href}/`) ? 'page' : undefined}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
