import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMITS, emptySpec, normalizeSpec, validateSpec, compileScenario, buildReferenceSolution, ruleLabel,
  serializeScenario, parseScenarioFile, scenarioFileName, FILE_FORMAT,
} from '../lib/customScenarios.js';
import { evaluateScenario, scenarioLabel } from '../lib/scenarios.js';
import {
  loadCustomScenarios, saveCustomScenario, deleteCustomScenario, duplicateCustomScenario, getCustomScenario, CUSTOM_SCENARIOS_KEY,
} from '../lib/storage.js';
import { resolveScenario } from '../lib/resolveScenario.js';
import { createState } from '../lib/networkReducer.js';
import { solveFileSharing, solveVideoStreaming, solveVoipMesh } from './fixtures.js';
import { run, fakeStore } from './helpers.js';

const spec = (over = {}) => ({
  ...emptySpec(),
  title: 'Test scenario',
  devices: { router: 1, hub: 0, pc: 3, modem: 0 },
  layout: { kind: 'star', center: 'router' },
  rules: [{ id: 'a', policy: 'allowWeb', kind: 'all', types: [], count: 1, requires: '' }],
  ...over,
});
const rule = (over) => ({ id: 'r', policy: 'voip', kind: 'all', types: [], count: 1, requires: '', ...over });
const grade = (s, doc) => evaluateScenario(compileScenario(s), doc);
const failing = (r) => r.checks.filter((c) => !c.ok).map((c) => c.id);

/* The three built-in scenarios, written as custom specs. If these grade the existing reference
   solutions the same way, the custom system can express everything the built-ins do. */
const AS_SPEC = {
  ring: spec({
    title: 'File sharing in a secure ring network',
    devices: { router: 2, hub: 0, pc: 10, modem: 0 },
    layout: { kind: 'ring', center: 'router' },
    rules: [
      rule({ id: 'ft', policy: 'fileTransfer', kind: 'exactly', types: ['pc'], count: 5 }),
      rule({ id: 'bu', policy: 'blockUntrusted', kind: 'dependent', requires: 'fileTransfer' }),
      rule({ id: 'aw', policy: 'allowWeb', kind: 'all' }),
    ],
  }),
  star: spec({
    title: 'Optimized video streaming in a star network',
    devices: { router: 1, hub: 2, pc: 6, modem: 0 },
    layout: { kind: 'star', center: 'router' },
    rules: [
      rule({ id: 'ps', policy: 'prioritizeStreaming', kind: 'ofTypes', types: ['pc'] }),
      rule({ id: 'tb', policy: 'throttleBulk', kind: 'exactly', types: ['pc'], count: 3 }),
      rule({ id: 'aw', policy: 'allowWeb', kind: 'all' }),
      rule({ id: 'ro', policy: 'restrictOutbound', kind: 'all' }),
    ],
  }),
  mesh: spec({
    title: 'VoIP communication in a mesh network',
    devices: { router: 1, hub: 2, pc: 3, modem: 0 },
    layout: { kind: 'mesh', center: 'router' },
    rules: [
      rule({ id: 'v', policy: 'voip', kind: 'all' }),
      rule({ id: 'aw', policy: 'allowWeb', kind: 'all' }),
      rule({ id: 'p2', policy: 'limitP2P', kind: 'all' }),
      rule({ id: 'rd', policy: 'remoteDesktop', kind: 'only', types: ['router', 'hub'] }),
    ],
  }),
};

test('the built-in scenarios can be written as custom scenarios, and grade the same reference solutions', () => {
  for (const [key, solve] of [['ring', solveFileSharing], ['star', solveVideoStreaming], ['mesh', solveVoipMesh]]) {
    assert.equal(validateSpec(AS_SPEC[key]).ok, true, `${key} validates`);
    const result = grade(AS_SPEC[key], solve().state.doc);
    assert.deepEqual(failing(result), [], key);
    assert.equal(result.passed, true);
  }
});

test('and they fail the same wrong answers', () => {
  const { state } = solveVoipMesh();
  const noLinks = run(state, ...state.doc.edges.map((e) => ({ type: 'removeEdge', id: e.id })));
  assert.ok(failing(grade(AS_SPEC.mesh, noLinks.doc)).includes('layout'));
  assert.equal(grade(AS_SPEC.mesh, createState().doc).met, 0, 'an empty canvas passes nothing');
  const wrongRemote = run(state, { type: 'togglePolicy', ids: state.doc.nodes.slice(3).map((n) => n.id), policy: 'remoteDesktop', on: true });
  assert.ok(failing(grade(AS_SPEC.mesh, wrongRemote.doc)).includes('rule-rd'));
});

test('every layout kind has a reference solution that passes', () => {
  for (const kind of ['any', 'connected', 'ring', 'star', 'mesh']) {
    const s = spec({ layout: { kind, center: 'router' }, rules: [] });
    const result = grade(s, buildReferenceSolution(s));
    assert.equal(result.passed, true, kind);
  }
});

test('the connected layout accepts any route but not an island', () => {
  const s = spec({ devices: { router: 0, hub: 0, pc: 4, modem: 0 }, layout: { kind: 'connected', center: 'router' }, rules: [] });
  const ok = buildReferenceSolution(s);
  assert.equal(grade(s, ok).passed, true);
  const ids = ok.nodes.map((n) => n.id);
  const cut = run(createState(ok), { type: 'removeEdge', id: ok.edges[1].id });
  const r = grade(s, cut.doc);
  assert.equal(r.checks.find((c) => c.id === 'layout').ok, false);
  assert.match(r.checks.find((c) => c.id === 'layout').detail, /can’t reach the rest/);
  assert.ok(ids.length === 4);
});

test('validation: title, devices and time are enforced', () => {
  assert.ok(validateSpec(spec({ title: 'ab' })).errors.title);
  assert.ok(validateSpec(spec({ devices: { router: 1, hub: 0, pc: 0, modem: 0 }, layout: { kind: 'any' }, rules: [] })).errors.devices);
  assert.equal(normalizeSpec({ timeLimit: 5 }).timeLimit, LIMITS.timeMin);
  assert.equal(normalizeSpec({ timeLimit: 99999 }).timeLimit, LIMITS.timeMax);
  assert.equal(normalizeSpec({ devices: { pc: 500 } }).devices.pc, LIMITS.perType);
});

test('validation: layouts name what is wrong', () => {
  const tiny = { router: 0, hub: 0, pc: 2, modem: 0 };
  assert.match(validateSpec(spec({ devices: tiny, layout: { kind: 'ring' }, rules: [] })).errors.layout, /ring needs at least three/);
  assert.match(validateSpec(spec({ devices: { router: 2, hub: 0, pc: 3, modem: 0 }, layout: { kind: 'star', center: 'router' }, rules: [] })).errors.layout, /exactly one router/);
  assert.match(validateSpec(spec({ devices: { router: 0, hub: 0, pc: 9, modem: 0 }, layout: { kind: 'mesh' }, rules: [] })).errors.layout, /36 links/);
});

test('validation: rules name what is wrong', () => {
  const s = (r) => validateSpec(spec({ rules: [rule({ id: 'x', ...r })] })).errors.rules.x;
  assert.match(s({ kind: 'ofTypes', types: [] }), /at least one device type/);
  assert.match(s({ kind: 'ofTypes', types: ['hub'] }), /no hubs/);
  assert.match(s({ kind: 'exactly', types: ['pc'], count: 9 }), /Only 3 PCs/);
  assert.match(s({ kind: 'dependent', requires: '' }), /Choose the policy/);
  assert.match(s({ kind: 'dependent', requires: 'voip' }), /can’t depend on itself/);
});

test('contradictory scenarios are caught before they can be saved', () => {
  // "Only PCs have it" and "keep it off for PCs" can never both be true.
  const clash = spec({ rules: [rule({ id: 'a', policy: 'ssh', kind: 'only', types: ['pc'] }), rule({ id: 'b', policy: 'ssh', kind: 'off', types: ['pc'] })] });
  const v = validateSpec(clash);
  assert.equal(v.ok, false);
  assert.match(v.errors.solvable, /can’t be completed/);

  // "Every device" and "exactly two PCs" clash when there are three PCs.
  const clash2 = spec({ rules: [rule({ id: 'a', policy: 'ssh', kind: 'all' }), rule({ id: 'b', policy: 'ssh', kind: 'exactly', types: ['pc'], count: 2 })] });
  assert.equal(validateSpec(clash2).ok, false);

  // A dependent rule that nothing ever satisfies.
  const orphan = spec({ rules: [rule({ id: 'a', policy: 'voip', kind: 'dependent', requires: 'ssh' })] });
  assert.equal(validateSpec(orphan).ok, false);
});

test('a consistent, interesting scenario is accepted', () => {
  const s = spec({
    rules: [
      rule({ id: 'a', policy: 'fileTransfer', kind: 'exactly', types: ['pc'], count: 2 }),
      rule({ id: 'b', policy: 'dataEncryption', kind: 'dependent', requires: 'fileTransfer' }),
      rule({ id: 'c', policy: 'blockPing', kind: 'off', types: ['router'] }),
      rule({ id: 'd', policy: 'adminPrivilege', kind: 'only', types: ['router'] }),
    ],
  });
  const v = validateSpec(s);
  assert.deepEqual(v.list, []);
  assert.equal(grade(s, buildReferenceSolution(s)).passed, true);
});

test('requirement wording reads naturally', () => {
  const s = spec({ devices: { router: 1, hub: 2, pc: 3, modem: 0 } });
  assert.equal(ruleLabel(s, rule({ policy: 'voip', kind: 'all' })), 'Turn on VoIP for every device.');
  assert.equal(ruleLabel(s, rule({ policy: 'voip', kind: 'ofTypes', types: ['pc'] })), 'Turn on VoIP for all 3 PCs.');
  assert.equal(ruleLabel(s, rule({ policy: 'ssh', kind: 'ofTypes', types: ['router'] })), 'Turn on SSH access for the router.');
  assert.equal(ruleLabel(s, rule({ policy: 'ssh', kind: 'only', types: ['router', 'hub'] })), 'Turn on SSH access for every router and hub only. No other device should have it.');
  assert.equal(ruleLabel(s, rule({ policy: 'ssh', kind: 'exactly', types: ['pc'], count: 2 })), 'Turn on SSH access for exactly 2 PCs. No other device should have it.');
  assert.equal(ruleLabel(s, rule({ policy: 'blockPing', kind: 'off', types: ['hub'] })), 'Keep Block ping requests off for all 2 hubs.');
  assert.equal(ruleLabel(s, rule({ policy: 'dataEncryption', kind: 'dependent', requires: 'fileTransfer' })), 'Turn on Enable data encryption for every device that has File transfer access.');
});

test('compiled scenarios look like the built-in ones', () => {
  const c = compileScenario(AS_SPEC.mesh);
  assert.equal(c.custom, true);
  assert.equal(c.number, null);
  assert.equal(scenarioLabel(c), 'Custom scenario');
  assert.equal(scenarioLabel({ number: 2 }), 'Scenario 2');
  assert.equal(c.timeLimit, 480);
  assert.ok(c.story && c.goal, 'story and goal are filled in when left blank');
  assert.match(c.goal, /full mesh of 6 devices/);
  assert.deepEqual(c.checks.map((x) => x.id), ['devices', 'ips', 'layout', 'rule-v', 'rule-aw', 'rule-p2', 'rule-rd']);
  const noIps = compileScenario({ ...AS_SPEC.mesh, requireIps: false });
  assert.ok(!noIps.checks.some((x) => x.id === 'ips'));
});

test('normalizeSpec cleans damaged or hostile input', () => {
  const dirty = normalizeSpec({
    title: '  <b>Hi</b>\n\n  there  '.repeat(20),
    story: 5,
    devices: { pc: '3', router: -4, toaster: 9 },
    layout: { kind: 'spiral', center: 'toaster' },
    rules: [
      { id: 'x', policy: 'nonsense', kind: 'all' },
      { id: 'y', policy: 'voip', kind: 'explode' },
      { id: 'z', policy: 'voip', kind: 'ofTypes', types: ['pc', 'pc', 'toaster'], count: 'lots', requires: 'nope' },
      { id: 'z', policy: 'ssh', kind: 'all' },
    ],
  });
  assert.ok(dirty.title.length <= LIMITS.titleMax);
  assert.equal(dirty.devices.pc, 3);
  assert.equal(dirty.devices.router, 0);
  assert.equal(dirty.layout.kind, 'any');
  assert.equal(dirty.layout.center, 'router');
  assert.equal(dirty.rules.length, 2, 'unknown policies and kinds are dropped');
  assert.deepEqual(dirty.rules[0].types, ['pc']);
  assert.equal(dirty.rules[0].requires, '');
  assert.notEqual(dirty.rules[0].id, dirty.rules[1].id, 'rule ids stay unique');
  assert.equal(normalizeSpec(null).rules.length, 0);
});

test('files: export then import gives the same scenario, with a new identity', () => {
  const text = serializeScenario({ ...AS_SPEC.star, id: 'c1', createdAt: 1, updatedAt: 2 });
  const data = JSON.parse(text);
  assert.equal(data.format, FILE_FORMAT);
  assert.equal(data.scenario.id, undefined, 'ids are not exported');
  const back = parseScenarioFile(text);
  assert.equal(back.ok, true);
  assert.equal(back.spec.id, null);
  assert.deepEqual(back.spec.rules, normalizeSpec(AS_SPEC.star).rules);
  assert.equal(scenarioFileName(AS_SPEC.star), 'secusim-optimized-video-streaming-in-a-star-network.json');
  assert.equal(scenarioFileName({ title: '???' }), 'secusim-scenario.json');
});

test('files: bad, oversized and contradictory files are refused with a reason', () => {
  assert.match(parseScenarioFile('{nope').error, /valid JSON/);
  assert.match(parseScenarioFile('{"format":"other"}').error, /doesn’t look like/);
  assert.match(parseScenarioFile('x'.repeat(LIMITS.fileChars + 1)).error, /too large/);
  assert.match(parseScenarioFile(null).error, /too large/);
  const clash = JSON.stringify({ format: FILE_FORMAT, version: 1, scenario: spec({ rules: [rule({ policy: 'ssh', kind: 'only', types: ['pc'] }), rule({ id: 'q', policy: 'ssh', kind: 'off', types: ['pc'] })] }) });
  assert.match(parseScenarioFile(clash).error, /can’t be completed/);
  const tooShort = JSON.stringify({ format: FILE_FORMAT, version: 1, scenario: spec({ title: 'x' }) });
  assert.match(parseScenarioFile(tooShort).error, /title/);
});

test('storage: save, edit in place, list newest first, duplicate, delete', () => {
  const store = fakeStore();
  const a = saveCustomScenario(spec({ title: 'First one' }), store, 1000);
  const b = saveCustomScenario(spec({ title: 'Second one' }), store, 2000);
  assert.ok(a.ok && b.ok && a.spec.id !== b.spec.id);
  assert.deepEqual(loadCustomScenarios(store).map((s) => s.title), ['Second one', 'First one']);

  const edited = saveCustomScenario({ ...a.spec, title: 'First one, edited' }, store, 3000);
  assert.equal(edited.spec.id, a.spec.id, 'same id: edited in place');
  assert.equal(edited.spec.createdAt, 1000, 'creation time is kept');
  assert.equal(loadCustomScenarios(store).length, 2);
  assert.equal(loadCustomScenarios(store)[0].title, 'First one, edited');

  const copy = duplicateCustomScenario(a.spec.id, store, 4000);
  assert.ok(copy.ok && copy.spec.id !== a.spec.id);
  assert.equal(copy.spec.title, 'First one, edited copy');
  assert.equal(loadCustomScenarios(store).length, 3);

  assert.equal(deleteCustomScenario(a.spec.id, store), true);
  assert.equal(deleteCustomScenario(a.spec.id, store), false);
  assert.equal(getCustomScenario(a.spec.id, store), null);
  assert.equal(duplicateCustomScenario('missing', store).ok, false);
});

test('storage: invalid scenarios are refused, the limit holds, nothing else in storage is touched', () => {
  const store = fakeStore();
  store.setItem('unrelated', 'keep me');
  const bad = saveCustomScenario(spec({ title: '' }), store);
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.title);
  assert.equal(loadCustomScenarios(store).length, 0, 'nothing was written');

  for (let i = 0; i < LIMITS.saved; i += 1) assert.ok(saveCustomScenario(spec({ title: `Scenario ${i}` }), store, 1000 + i).ok);
  const over = saveCustomScenario(spec({ title: 'One too many' }), store);
  assert.equal(over.ok, false);
  assert.match(over.error, /up to 50/);
  assert.equal(store.getItem('unrelated'), 'keep me');
});

test('storage: damaged data and blocked storage never throw', () => {
  const corrupt = fakeStore();
  corrupt.setItem(CUSTOM_SCENARIOS_KEY, '{not json');
  assert.deepEqual(loadCustomScenarios(corrupt), []);
  const junk = fakeStore();
  junk.setItem(CUSTOM_SCENARIOS_KEY, JSON.stringify([null, 5, { title: 'no id' }, { id: 'c1', title: 'Fine one', devices: { pc: 2 } }]));
  assert.deepEqual(loadCustomScenarios(junk).map((s) => s.id), ['c1']);
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); } };
  assert.deepEqual(loadCustomScenarios(broken), []);
  assert.match(saveCustomScenario(spec(), broken).error, /blocked saving/);
});

test('resolveScenario finds built-in and custom scenarios, and nothing else', () => {
  const store = fakeStore();
  const saved = saveCustomScenario(spec({ title: 'Mine' }), store);
  assert.equal(resolveScenario('voip-mesh', store).number, 3);
  const mine = resolveScenario(saved.spec.id, store);
  assert.equal(mine.custom, true);
  assert.equal(mine.title, 'Mine');
  assert.equal(mine.id, saved.spec.id);
  assert.equal(resolveScenario('nope', store), null);
});
