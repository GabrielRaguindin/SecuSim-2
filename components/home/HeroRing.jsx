const CX = 180;
const CY = 180;
const R = 118;
const COUNT = 6;
const PERIOD = 9; // seconds per lap

const points = Array.from({ length: COUNT }, (_, i) => {
  const angle = (i / COUNT) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.round((CX + Math.cos(angle) * R) * 100) / 100, y: Math.round((CY + Math.sin(angle) * R) * 100) / 100 };
});

/**
 * One orchestrated moment: a packet circles the ring and each device lights up
 * at the instant it passes. The delays are derived from the lap time so the two stay in step.
 */
export default function HeroRing() {
  return (
    <svg className="sx-hero__art" viewBox="0 0 360 360" role="img" aria-label="A packet travelling around a ring of six devices" style={{ '--lap': `${PERIOD}s` }}>
      <circle cx={CX} cy={CY} r={R} className="sx-hero__ring" />
      {points.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y})`}>
          <g className="sx-hero__node" style={{ animationDelay: `${(i / COUNT) * PERIOD}s` }}>
            <rect x="-24" y="-24" width="48" height="48" rx="14" />
            <rect x="-9" y="-8" width="18" height="12" rx="2.5" className="sx-hero__glyph" />
            <path d="M-5 9h10M0 4v5" className="sx-hero__glyph" />
          </g>
        </g>
      ))}
      <g className="sx-hero__orbit">
        <circle cx={CX} cy={CY - R} r="14" className="sx-hero__halo" />
        <circle cx={CX} cy={CY - R} r="6.5" className="sx-hero__packet" />
      </g>
    </svg>
  );
}
