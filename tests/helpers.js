import { createState, networkReducer } from '../lib/networkReducer.js';

/** Build a document by running real reducer actions, so tests exercise the same paths as the UI. */
export function build(steps = []) {
  let state = createState();
  const ids = {};
  for (const step of steps) state = networkReducer(state, step);
  return { state, ids };
}

export function run(state, ...actions) {
  return actions.reduce((s, a) => networkReducer(s, a), state);
}

/** Add nodes of the given types; returns { state, ids } where ids lists new node ids in order. */
export function addNodes(state, types) {
  const ids = [];
  let s = state;
  types.forEach((t, i) => {
    const before = s.doc.seq;
    s = networkReducer(s, { type: 'add', nodeType: t, x: 100 + i * 10, y: 100 + i * 10 });
    ids.push(`n${before}`);
  });
  return { state: s, ids };
}

export function fakeStore() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    key: (i) => [...data.keys()][i] ?? null,
    get length() { return data.size; },
    _data: data,
  };
}
