import { GlyphPaths } from '@/components/ui/DeviceGlyph';
import { layoutTopology } from '@/lib/layouts.js';

const W = 360;
const H = 300;

/** A static drawing of a ring, star or mesh. The lesson page lights up a route through it. */
export default function TopologyDiagram({ kind, active = null, litEdges = [], packet = null, compact = false, label }) {
  const { nodes, edges } = layoutTopology(kind, W, H);
  const tile = compact ? 34 : 46;
  const glyph = (tile * 0.56) / 24;
  const lit = new Set(litEdges);

  return (
    <svg className="sx-diagram" data-compact={compact} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label ?? `${kind} topology`}>
      <g>
        {edges.map((e) => {
          const a = nodes[e.a];
          const b = nodes[e.b];
          const key = `${Math.min(e.a, e.b)}-${Math.max(e.a, e.b)}`;
          return <line key={key} className="sx-diagram__edge" data-lit={lit.has(key)} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
      </g>
      <g>
        {nodes.map((n) => (
          <g key={n.id} className="sx-diagram__node" data-type={n.type} data-active={active === n.id} transform={`translate(${n.x} ${n.y})`}>
            <rect x={-tile / 2} y={-tile / 2} width={tile} height={tile} rx={tile * 0.3} />
            <g transform={`translate(${-12 * glyph} ${-12 * glyph}) scale(${glyph})`}>
              <GlyphPaths type={n.type} />
            </g>
          </g>
        ))}
      </g>
      {packet && (
        <g className="sx-diagram__packet" style={{ transform: `translate(${packet.x}px, ${packet.y}px)` }}>
          <circle r="13" className="sx-diagram__halo" />
          <circle r="6" />
        </g>
      )}
    </svg>
  );
}
