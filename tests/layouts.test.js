import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutTopology, packetRoute, TOPOLOGY_KINDS } from '../lib/layouts.js';

test('diagram layouts have the right shape', () => {
  const ring = layoutTopology('ring');
  assert.equal(ring.edges.length, ring.nodes.length);
  const star = layoutTopology('star');
  assert.equal(star.edges.length, star.nodes.length - 1);
  assert.ok(star.edges.every((e) => e.a === 0));
  assert.equal(star.nodes[0].type, 'router');
  const mesh = layoutTopology('mesh');
  const n = mesh.nodes.length;
  assert.equal(mesh.edges.length, (n * (n - 1)) / 2);
});

test('demo packet routes follow real edges', () => {
  for (const kind of TOPOLOGY_KINDS) {
    const { edges } = layoutTopology(kind);
    const route = packetRoute(kind);
    for (let i = 0; i < route.length - 1; i += 1) {
      const [a, b] = [route[i], route[i + 1]];
      assert.ok(edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a)), `${kind}: ${a} to ${b}`);
    }
  }
});

import { toPdfText } from '../lib/pdf.js';

test('pdf text is reduced to characters the built-in fonts can draw', () => {
  assert.equal(toPdfText('It’s “fine” – really…'), 'It\'s "fine" - really...');
  assert.equal(toPdfText('Router 1 \u2192 PC 2'), 'Router 1  PC 2');
  assert.equal(toPdfText(null), '');
});
