import test from 'node:test';
import assert from 'node:assert/strict';
import { loadResults, saveResult, deleteResult, restoreResult, listTopologies, saveTopology, loadTopology, deleteTopology, topologyExists, RESULT_TTL_MS, MAX_NAME_LENGTH, cleanName, readJSON } from '../lib/storage.js';
import { fakeStore, addNodes } from './helpers.js';
import { createState } from '../lib/networkReducer.js';

const sample = (over = {}) => ({ scenarioId: 'voip-mesh', scenarioTitle: 'VoIP', scenarioNumber: 3, passed: true, met: 7, total: 7, checks: [], secondsUsed: 100, timeLimit: 360, finishedBy: 'manual', ...over });

test('results: save, list newest first, delete, restore', () => {
  const store = fakeStore();
  const a = saveResult(sample({ scenarioId: 'a' }), store, 1000);
  const b = saveResult(sample({ scenarioId: 'b' }), store, 2000);
  assert.ok(a.id && b.id && a.id !== b.id);
  assert.deepEqual(loadResults(store, 3000).map((r) => r.scenarioId), ['b', 'a']);
  assert.equal(deleteResult(b.id, store, 3000), true);
  assert.deepEqual(loadResults(store, 3000).map((r) => r.scenarioId), ['a']);
  restoreResult(b, store, 3000);
  assert.deepEqual(loadResults(store, 3000).map((r) => r.scenarioId), ['b', 'a']);
});

test('results carry their scenario (was B-20) and expire after 30 days', () => {
  const store = fakeStore();
  saveResult(sample({ scenarioId: 'old' }), store, 0);
  saveResult(sample({ scenarioId: 'new' }), store, RESULT_TTL_MS + 5);
  const list = loadResults(store, RESULT_TTL_MS + 10);
  assert.deepEqual(list.map((r) => r.scenarioId), ['new']);
  assert.equal(list[0].scenarioNumber, 3);
});

test('storage failures never throw', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); } };
  assert.deepEqual(loadResults(broken), []);
  assert.equal(saveResult(sample(), broken), null);
  assert.equal(readJSON('x', 7, null), 7);
  const corrupt = fakeStore();
  corrupt.setItem('secusim:v2:results', '{not json');
  assert.deepEqual(loadResults(corrupt), []);
});

test('topologies: only our own key is read, unrelated keys never appear (was B-12)', () => {
  const store = fakeStore();
  store.setItem('some-other-app', 'hello');
  store.setItem('theme', 'dark');
  const { state } = addNodes(createState(), ['pc', 'router']);
  assert.deepEqual(saveTopology('Office', state.doc, store, 5), { ok: true, name: 'Office' });
  assert.deepEqual(listTopologies(store).map((t) => t.name), ['Office']);
  assert.equal(listTopologies(store)[0].devices, 2);
  assert.equal(loadTopology('Office', store).nodes.length, 2);
  assert.equal(loadTopology('theme', store), null, 'loading a foreign key returns null instead of throwing');
  assert.equal(topologyExists('  Office ', store), true);
});

test('topologies: names are validated and saving again replaces', () => {
  const store = fakeStore();
  const { state } = addNodes(createState(), ['pc']);
  assert.equal(saveTopology('   ', state.doc, store).ok, false);
  assert.equal(cleanName('a'.repeat(100)).length, MAX_NAME_LENGTH);
  saveTopology('Lab', state.doc, store, 1);
  const bigger = addNodes(state, ['hub', 'hub']).state;
  saveTopology('Lab', bigger.doc, store, 2);
  assert.equal(listTopologies(store).length, 1);
  assert.equal(loadTopology('Lab', store).nodes.length, 3);
  assert.equal(deleteTopology('Lab', store), true);
  assert.equal(deleteTopology('Lab', store), false);
  assert.deepEqual(listTopologies(store), []);
});
