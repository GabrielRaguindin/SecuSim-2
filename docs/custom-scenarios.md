# Custom scenarios

People can write their own scenarios, keep them in the browser, and simulate them like the built-in three.

## How it works

A custom scenario is **data, not code**: a "spec" in `lib/customScenarios.js`.

```js
{ id, title, story, goal, timeLimit,            // timeLimit in seconds, 60 to 3600
  devices: { router, hub, pc, modem },          // exact counts, at most 12 each and 20 in total
  layout:  { kind, center },                    // kind: any | connected | ring | star | mesh
  requireIps: true,
  rules: [{ id, policy, kind, types, count, requires }] }   // at most 12
```

`compileScenario(spec)` turns a spec into the same shape as the built-ins (`checks: [{ id, label, run }]`), so `Simulator`, `ResultSheet`, results and PDFs work unchanged. Requirement text is written from the spec, so the brief, the live checklist and the grading can never disagree.

### Rule kinds

| Kind | Means | Example sentence |
|---|---|---|
| `all` | every device has it | Turn on VoIP for every device. |
| `ofTypes` | every device of these types has it | Turn on VoIP for all 3 PCs. |
| `only` | those types have it, and nothing else does | Turn on SSH access for every router and hub only. |
| `exactly` | exactly N of those types have it, nothing else does | Turn on File transfer access for exactly 5 PCs. |
| `off` | those types must not have it | Keep Block ping requests off for all 2 hubs. |
| `dependent` | every device with policy A must also have policy B | Turn on Block untrusted IP for every device that has File transfer access. |

## Every saved scenario can be completed

`validateSpec` checks the obvious things (title, device counts, layout needs, rule inputs), then **builds a reference network that follows the spec and grades it with the compiled checks**. If any check fails, the scenario contradicts itself and cannot be saved. The message says which requirement failed and why. The builder's preview shows a green "A network exists that meets every requirement" once that proof passes.

## Storage, sharing, safety

- Saved under one namespaced `localStorage` key, `secusim:v2:scenarios`. At most 50. Damaged entries are cleaned or dropped on load.
- **Export** writes `{ format: "secusim-scenario", version: 1, scenario }` (no ids or timestamps). **Import** cleans the file, re-validates it (including the completability proof) and gives it a new id.
- A file is never executed. Strings are collapsed, trimmed and length-limited, unknown policies and kinds are dropped, and text is rendered as React text.

## Files

| Area | File |
|---|---|
| Spec, validation, compiler, solver, file format | `lib/customScenarios.js` |
| Saving and loading | `lib/storage.js` (custom scenario section) |
| Find a scenario by id (built-in or custom) | `lib/resolveScenario.js` |
| Two new reusable checks (`connected`, `offOnTypes`), `scenarioLabel` | `lib/scenarios.js` |
| Builder form with live preview | `components/scenarios/ScenarioBuilder.jsx` |
| Runs a scenario found by id | `components/simulator/ScenarioRunner.jsx` |
| List with Your scenarios, import, export | `components/simulator/ScenarioList.jsx`, `ScenarioArt.jsx` |
| Routes | `app/(site)/simulator/new`, `app/(site)/simulator/edit/[id]`, `app/(bench)/simulator/[id]` |
| Styles | `styles/builder.css` |
| Tests | `tests/customScenarios.test.js` (18 tests) |

## Limits to know about

- Custom scenarios live in one browser, like results. Sharing is by exported file.
- `/simulator/[id]` renders built-in ids ahead of time and any other id on demand, so a fully static export (`output: 'export'`) would need the custom route moved to a client-side lookup.
- The builder expresses device counts, one layout rule and per-policy rules. It cannot say "at least N", relate two device types ("each PC linked to a router"), or require specific link counts. Add a rule kind in `RULE_KINDS`, a branch in `ruleCheck`, `ruleLabel` and `buildReferenceSolution`, and a test.
