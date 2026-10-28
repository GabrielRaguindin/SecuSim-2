import test from 'node:test';
import assert from 'node:assert/strict';
import { adjacency, isConnected, nextName, nextFreeSpot, fitToBounds, edgeId, countByType, usableRect } from '../lib/network.js';
import { isValidIPv4 } from '../lib/ip.js';
import { joinList, formatClock, formatDuration } from '../lib/format.js';
import { projectRelease, stepSpring, isSettled, velocityFromSamples } from '../lib/spring.js';

const n = (id, type = 'pc', x = 0, y = 0) => ({ id, type, name: id, x, y, ip: '' });

test('edgeId is order independent', () => {
  assert.equal(edgeId('a', 'b'), edgeId('b', 'a'));
});

test('adjacency ignores self-links and links to missing nodes', () => {
  const adj = adjacency([n('a'), n('b')], [{ a: 'a', b: 'a' }, { a: 'a', b: 'zzz' }, { a: 'a', b: 'b' }]);
  assert.deepEqual([...adj.get('a')], ['b']);
  assert.deepEqual([...adj.get('b')], ['a']);
});

test('isConnected', () => {
  const nodes = [n('a'), n('b'), n('c')];
  assert.equal(isConnected([], []), false);
  assert.equal(isConnected(nodes, []), false);
  assert.equal(isConnected(nodes, [{ a: 'a', b: 'b' }]), false);
  assert.equal(isConnected(nodes, [{ a: 'a', b: 'b' }, { a: 'b', b: 'c' }]), true);
  assert.equal(isConnected([n('a')], []), true);
});

test('nextName fills the smallest gap', () => {
  const nodes = [{ ...n('x'), name: 'PC 1' }, { ...n('y'), name: 'PC 3' }];
  assert.equal(nextName(nodes, 'pc'), 'PC 2');
  assert.equal(nextName(nodes, 'router'), 'Router 1');
});

test('countByType', () => {
  assert.deepEqual(countByType([n('a'), n('b'), n('c', 'hub')]), { pc: 2, hub: 1 });
});

test('nextFreeSpot avoids existing devices and stays inside the usable area', () => {
  const bounds = { width: 900, height: 600 };
  const r = usableRect(bounds);
  const nodes = [];
  for (let i = 0; i < 12; i += 1) {
    const p = nextFreeSpot(nodes, bounds);
    assert.ok(p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom, `spot ${i} in bounds`);
    for (const other of nodes) assert.ok(Math.hypot(other.x - p.x, other.y - p.y) >= 100, `spot ${i} clear of others`);
    nodes.push(n(`n${i}`, 'pc', p.x, p.y));
  }
});

test('fitToBounds leaves a fitting layout alone and shrinks an oversized one', () => {
  const bounds = { width: 600, height: 500 };
  const small = { nodes: [n('a', 'pc', 200, 200), n('b', 'pc', 300, 250)], edges: [], policies: {}, seq: 3 };
  assert.equal(fitToBounds(small, bounds), small);

  const big = { ...small, nodes: [n('a', 'pc', 50, 50), n('b', 'pc', 2000, 1500)] };
  const fitted = fitToBounds(big, bounds);
  const r = usableRect(bounds);
  for (const node of fitted.nodes) {
    assert.ok(node.x >= r.left - 0.001 && node.x <= r.right + 0.001);
    assert.ok(node.y >= r.top - 0.001 && node.y <= r.bottom + 0.001);
  }
});

test('IPv4 validation', () => {
  for (const ok of ['192.168.0.1', '0.0.0.0', '255.255.255.255', ' 10.0.0.1 ']) assert.equal(isValidIPv4(ok), true, ok);
  for (const bad of ['', '1.2.3', '1.2.3.4.5', '256.1.1.1', '01.2.3.4', 'a.b.c.d', '1.2.3.-4', '1..2.3']) assert.equal(isValidIPv4(bad), false, bad);
});

test('format helpers', () => {
  assert.equal(joinList(['a']), 'a');
  assert.equal(joinList(['a', 'b']), 'a and b');
  assert.equal(joinList(['a', 'b', 'c']), 'a, b and c');
  assert.equal(joinList(['a', 'b', 'c', 'd', 'e']), 'a, b, c and 2 more');
  assert.equal(formatClock(480), '8:00');
  assert.equal(formatClock(61), '1:01');
  assert.equal(formatClock(-4), '0:00');
  assert.equal(formatDuration(45), '45 sec');
  assert.equal(formatDuration(120), '2 min');
  assert.equal(formatDuration(125), '2 min 5 sec');
});

test('spring settles on its target without drifting', () => {
  let s = { x: 0, v: 800 };
  for (let i = 0; i < 400 && !isSettled(s, 100); i += 1) s = stepSpring(s, 100, 1 / 60);
  assert.ok(isSettled(s, 100), 'spring settled');
  assert.ok(Math.abs(s.x - 100) < 0.5);
});

test('projectRelease keeps direction and scales with speed', () => {
  assert.equal(projectRelease(100, 0), 100);
  assert.ok(projectRelease(100, 1000) > 100);
  assert.ok(projectRelease(100, -1000) < 100);
  assert.ok(projectRelease(100, 2000) - 100 > projectRelease(100, 1000) - 100);
});

test('velocityFromSamples averages the recent window', () => {
  const samples = [{ t: 0, x: 0, y: 0 }, { t: 50, x: 25, y: 0 }, { t: 100, x: 100, y: 0 }];
  const v = velocityFromSamples(samples, 60);
  assert.ok(Math.abs(v.x - 1500) < 1);
  assert.deepEqual(velocityFromSamples([{ t: 0, x: 0, y: 0 }]), { x: 0, y: 0 });
});
