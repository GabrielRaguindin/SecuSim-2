'use client';

import Link from 'next/link';

/**
 * Segmented control with a thumb that slides between options on a spring.
 * Options with an `href` render as links (for tabs that are pages).
 */
export default function Segmented({ options, value, onChange, label }) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      className="sx-seg"
      role={options.some((o) => o.href) ? 'navigation' : 'tablist'}
      aria-label={label}
      style={{ '--n': options.length, '--i': index }}
    >
      <span className="sx-seg__thumb" aria-hidden="true" />
      {options.map((o) =>
        o.href ? (
          <Link key={o.value} href={o.href} className="sx-seg__item" aria-current={o.value === value ? 'page' : undefined}>
            {o.label}
          </Link>
        ) : (
          <button
            key={o.value}
            type="button"
            role="tab"
            className="sx-seg__item"
            aria-selected={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        )
      )}
    </div>
  );
}
