/**
 * Browser storage for saved results and sandbox topologies.
 *
 * Everything lives under one namespaced key per collection, so nothing here ever
 * touches (or lists) unrelated localStorage keys. Every function takes an optional
 * `store` so it can be tested with a fake.
 */

import { normalizeDoc } from './networkReducer.js';
import { LIMITS, normalizeSpec, validateSpec } from './customScenarios.js';

const NS = 'secusim:v2:';
export const RESULTS_KEY = `${NS}results`;
export const TOPOLOGIES_KEY = `${NS}topologies`;
export const CUSTOM_SCENARIOS_KEY = `${NS}scenarios`;

export const RESULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_RESULTS = 200;
export const MAX_NAME_LENGTH = 40;

function defaultStore() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readJSON(key, fallback, store = defaultStore()) {
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value, store = defaultStore()) {
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/* ---------- Results ---------- */

function freshResults(list, now) {
  return (Array.isArray(list) ? list : [])
    .filter((r) => r && typeof r.id === 'string' && Number.isFinite(r.createdAt) && now - r.createdAt < RESULT_TTL_MS)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function loadResults(store = defaultStore(), now = Date.now()) {
  return freshResults(readJSON(RESULTS_KEY, [], store), now);
}

/**
 * Save one attempt. Returns the stored record, or null when storage is unavailable.
 * A record is: { id, scenarioId, scenarioTitle, scenarioNumber, passed, met, total,
 *                checks, secondsUsed, timeLimit, finishedBy, createdAt }
 */
export function saveResult(result, store = defaultStore(), now = Date.now()) {
  const record = {
    ...result,
    id: result.id ?? `r${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    createdAt: result.createdAt ?? now,
  };
  const next = freshResults([record, ...loadResults(store, now)], now).slice(0, MAX_RESULTS);
  return writeJSON(RESULTS_KEY, next, store) ? record : null;
}

export function deleteResult(id, store = defaultStore(), now = Date.now()) {
  const next = loadResults(store, now).filter((r) => r.id !== id);
  return writeJSON(RESULTS_KEY, next, store);
}

export function restoreResult(record, store = defaultStore(), now = Date.now()) {
  const next = freshResults([record, ...loadResults(store, now)], now).slice(0, MAX_RESULTS);
  return writeJSON(RESULTS_KEY, next, store);
}

/* ---------- Sandbox topologies ---------- */

export function cleanName(name) {
  return String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

function loadTopologyMap(store) {
  const map = readJSON(TOPOLOGIES_KEY, {}, store);
  return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
}

/** [{ name, updatedAt, devices }] newest first. */
export function listTopologies(store = defaultStore()) {
  return Object.entries(loadTopologyMap(store))
    .map(([name, entry]) => ({
      name,
      updatedAt: Number.isFinite(entry?.updatedAt) ? entry.updatedAt : 0,
      devices: Array.isArray(entry?.doc?.nodes) ? entry.doc.nodes.length : 0,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function topologyExists(name, store = defaultStore()) {
  return Object.prototype.hasOwnProperty.call(loadTopologyMap(store), cleanName(name));
}

export function saveTopology(name, doc, store = defaultStore(), now = Date.now()) {
  const clean = cleanName(name);
  if (!clean) return { ok: false, error: 'Give the topology a name first.' };
  const map = loadTopologyMap(store);
  map[clean] = { doc: normalizeDoc(doc), updatedAt: now };
  if (!writeJSON(TOPOLOGIES_KEY, map, store)) {
    return { ok: false, error: 'Your browser blocked saving. Check that storage is allowed for this site.' };
  }
  return { ok: true, name: clean };
}

export function loadTopology(name, store = defaultStore()) {
  const entry = loadTopologyMap(store)[name];
  return entry?.doc ? normalizeDoc(entry.doc) : null;
}

export function deleteTopology(name, store = defaultStore()) {
  const map = loadTopologyMap(store);
  if (!Object.prototype.hasOwnProperty.call(map, name)) return false;
  delete map[name];
  return writeJSON(TOPOLOGIES_KEY, map, store);
}

/* ---------- Custom scenarios ---------- */

/** Newest edit first. Each entry is cleaned on the way in, so a damaged entry can't break the page. */
export function loadCustomScenarios(store = defaultStore()) {
  const raw = readJSON(CUSTOM_SCENARIOS_KEY, [], store);
  return (Array.isArray(raw) ? raw : [])
    .map(normalizeSpec)
    .filter((s) => s.id)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export function getCustomScenario(id, store = defaultStore()) {
  return loadCustomScenarios(store).find((s) => s.id === id) ?? null;
}

/**
 * Validate and save a scenario. A spec with an `id` that already exists replaces it.
 * Returns { ok: true, spec } or { ok: false, error, errors }.
 */
export function saveCustomScenario(spec, store = defaultStore(), now = Date.now()) {
  const check = validateSpec(spec);
  if (!check.ok) return { ok: false, error: check.list[0], errors: check.errors };

  const list = loadCustomScenarios(store);
  const existing = check.spec.id ? list.find((s) => s.id === check.spec.id) : null;
  if (!existing && list.length >= LIMITS.saved) {
    return { ok: false, error: `You can keep up to ${LIMITS.saved} custom scenarios. Delete one to make room.` };
  }

  const record = {
    ...check.spec,
    id: existing ? existing.id : `c${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const next = [record, ...list.filter((s) => s.id !== record.id)];
  if (!writeJSON(CUSTOM_SCENARIOS_KEY, next, store)) {
    return { ok: false, error: 'Your browser blocked saving. Check that storage is allowed for this site.' };
  }
  return { ok: true, spec: record };
}

export function deleteCustomScenario(id, store = defaultStore()) {
  const list = loadCustomScenarios(store);
  if (!list.some((s) => s.id === id)) return false;
  return writeJSON(CUSTOM_SCENARIOS_KEY, list.filter((s) => s.id !== id), store);
}

export function duplicateCustomScenario(id, store = defaultStore(), now = Date.now()) {
  const original = getCustomScenario(id, store);
  if (!original) return { ok: false, error: 'That scenario no longer exists.' };
  const suffix = ' copy';
  const title = `${original.title.slice(0, LIMITS.titleMax - suffix.length)}${suffix}`;
  return saveCustomScenario({ ...original, id: null, title }, store, now);
}
