# SecuSim 2.0: Project Structure

> **Generated:** 2026-10-14 from the 2.0 working tree (71 files, about 4504 lines of source and styles, about 590 lines of tests).
> **Evidence tags:** **[V]** verified by running it · **[R]** verified by reading the code · **[U]** unverified.
> Not written to GitHub. No repository connection was available, so this is a deliverable to commit.

## Stack [R]

| Area | Choice |
|---|---|
| Framework | Next.js 14.2.5, App Router only, React 18, plain JavaScript (JSX) with ES modules (`"type": "module"`) |
| Styling | Hand-written CSS in `styles/` (design tokens, no CSS framework) |
| Graph and canvas | Own SVG canvas with pointer events (no vis-network) |
| PDF | jsPDF, loaded on demand |
| Tests | Node's built-in test runner, no extra packages |
| Persistence | Browser `localStorage`, namespaced `secusim:v2:`. No API routes |

## Tree [V]

```
.eslintrc.json
.gitignore
MIGRATION.md
README.md
app/(bench)/sandbox/page.jsx
app/(bench)/simulator/[id]/page.jsx
app/(site)/about/page.jsx
app/(site)/layout.jsx
app/(site)/learn/layout.jsx
app/(site)/learn/page.jsx
app/(site)/learn/policies/page.jsx
app/(site)/learn/topologies/page.jsx
app/(site)/page.jsx
app/(site)/results/page.jsx
app/(site)/simulator/page.jsx
app/error.jsx
app/icon.svg
app/layout.js
app/manifest.js
app/not-found.jsx
components/home/HeroRing.jsx
components/hooks.js
components/learn/LearnTabs.jsx
components/learn/TopologyDiagram.jsx
components/learn/TopologyLesson.jsx
components/results/ResultsList.jsx
components/sandbox/Sandbox.jsx
components/shell/SiteFooter.jsx
components/shell/SiteNav.jsx
components/simulator/ResultSheet.jsx
components/simulator/ScenarioList.jsx
components/simulator/Simulator.jsx
components/simulator/TimerRing.jsx
components/ui/CheckList.jsx
components/ui/DeviceGlyph.jsx
components/ui/Icon.jsx
components/ui/Segmented.jsx
components/ui/Sheet.jsx
components/ui/Switch.jsx
components/ui/Toast.jsx
components/workbench/DeviceDock.jsx
components/workbench/Inspector.jsx
components/workbench/NetworkCanvas.jsx
components/workbench/Toolbar.jsx
components/workbench/Workbench.jsx
jsconfig.json
lib/devices.js
lib/format.js
lib/ip.js
lib/layouts.js
lib/lessons.js
lib/network.js
lib/networkReducer.js
lib/pdf.js
lib/policies.js
lib/scenarios.js
lib/spring.js
lib/storage.js
next.config.mjs
package.json
styles/pages.css
styles/tokens.css
styles/ui.css
styles/workbench.css
tests/fixtures.js
tests/helpers.js
tests/layouts.test.js
tests/network.test.js
tests/reducer.test.js
tests/scenarios.test.js
tests/storage.test.js
```

## Architecture [R]

1. **`lib/` decides, components draw.** Everything with rules in it (network document, history, scenario checks, storage, geometry, spring maths, PDF text) is React-free and covered by `tests/`.
2. **One document model** (`lib/networkReducer.js`): `{ nodes, edges, policies, seq }`, with undo and redo. Policies are keyed by device id. Edges are keyed by the sorted pair, so a pair links once.
3. **One editor** (`components/workbench/Workbench.jsx`) serves both the sandbox and the simulator. The simulator wraps it with a brief, a countdown, a requirements panel and result sheets.
4. **Scenarios are data plus checks** (`lib/scenarios.js`). Server components pass only ids to client components, because scenarios contain functions.
5. **Route groups:** `(site)` pages have the footer; `(bench)` pages are the full-height workbench.

## Feature to file map [R]

| Feature | Files |
|---|---|
| Canvas gestures (drag, momentum, link, keyboard) | `components/workbench/NetworkCanvas.jsx`, `lib/spring.js` |
| Device dock (drag or tap to add) | `components/workbench/DeviceDock.jsx`, `lib/network.js` (`nextFreeSpot`) |
| IP and policy editing | `components/workbench/Inspector.jsx`, `lib/networkReducer.js`, `lib/policies.js`, `lib/ip.js` |
| Scenario grading | `lib/scenarios.js`, `components/simulator/*` |
| Save and open topologies | `components/sandbox/Sandbox.jsx`, `lib/storage.js` |
| Results and PDF | `components/results/ResultsList.jsx`, `lib/storage.js`, `lib/pdf.js` |
| Lessons | `components/learn/*`, `lib/lessons.js`, `lib/layouts.js` |
| Design system | `styles/tokens.css`, `styles/ui.css` |

## Testing [V]

- `npm test` runs **46** tests, all passing at generation time.
- Covered: graph helpers, IP validation, spring maths, the reducer and history, every scenario (reference solutions plus a regression for each 1.x bug), storage (with a fake store), diagram layouts, PDF text.
- Not covered in the repository: components and end-to-end flows. They were exercised in a browser harness during development (see `progress.md`) but that harness is not shipped.
