/** Geometry for the teaching diagrams (ring, star, mesh). Pure, so it can be tested. */

export const TOPOLOGY_KINDS = ['ring', 'star', 'mesh'];

const COUNTS = { ring: 6, star: 7, mesh: 5 };

// Rounded so the server and the browser always produce identical SVG attributes.
const round = (n) => Math.round(n * 100) / 100;

export function layoutTopology(kind, width = 360, height = 300) {
  const count = COUNTS[kind] ?? 6;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - 44;
  const onCircle = (i, total) => {
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    return { x: round(cx + Math.cos(angle) * radius), y: round(cy + Math.sin(angle) * radius) };
  };

  const nodes = [];
  const edges = [];

  if (kind === 'star') {
    nodes.push({ id: 0, type: 'router', x: cx, y: cy });
    for (let i = 1; i < count; i += 1) nodes.push({ id: i, type: 'pc', ...onCircle(i - 1, count - 1) });
    for (let i = 1; i < count; i += 1) edges.push({ a: 0, b: i });
  } else {
    for (let i = 0; i < count; i += 1) nodes.push({ id: i, type: 'pc', ...onCircle(i, count) });
    if (kind === 'ring') {
      for (let i = 0; i < count; i += 1) edges.push({ a: i, b: (i + 1) % count });
    } else {
      for (let i = 0; i < count; i += 1) for (let j = i + 1; j < count; j += 1) edges.push({ a: i, b: j });
    }
  }
  return { nodes, edges };
}

/** The path a demo packet takes, as node ids. */
export function packetRoute(kind) {
  const { nodes } = layoutTopology(kind);
  if (kind === 'ring') return Array.from({ length: Math.floor(nodes.length / 2) + 1 }, (_, i) => i);
  if (kind === 'star') return [1, 0, 1 + Math.floor((nodes.length - 1) / 2)];
  return [0, Math.floor(nodes.length / 2)];
}
