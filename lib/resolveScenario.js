/** Finds a scenario by id: a built-in one, or a custom one from this browser. */

import { getScenario } from './scenarios.js';
import { compileScenario } from './customScenarios.js';
import { getCustomScenario } from './storage.js';

export function resolveScenario(id, store) {
  const builtIn = getScenario(id);
  if (builtIn) return builtIn;
  const spec = getCustomScenario(id, store);
  return spec ? compileScenario(spec) : null;
}
