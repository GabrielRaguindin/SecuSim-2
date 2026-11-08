# SecuSim 2.0: Project Structure

> **Generated:** from the working tree after Patch 2.5.1 (114 files, about 8151 lines of source and styles, about 2837 lines of tests).
> **Evidence tags:** **[V]** verified by running it · **[R]** verified by reading the code · **[U]** unverified.
> Not written to GitHub by the assistant (it has no repository connection). Each patch is applied to the repository by the project owner.

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
app/(site)/learn/addressing/page.jsx
app/(site)/learn/cabling/page.jsx
app/(site)/learn/layout.jsx
app/(site)/learn/page.jsx
app/(site)/learn/policies/page.jsx
app/(site)/learn/topologies/page.jsx
app/(site)/page.jsx
app/(site)/results/page.jsx
app/(site)/simulator/edit/[id]/page.jsx
app/(site)/simulator/new/page.jsx
app/(site)/simulator/page.jsx
app/error.jsx
app/icon.svg
app/layout.js
app/manifest.js
app/not-found.jsx
components/download.js
components/home/HeroRing.jsx
components/hooks.js
components/learn/LearnTabs.jsx
components/learn/TopologyDiagram.jsx
components/learn/TopologyLesson.jsx
components/results/ResultsList.jsx
components/sandbox/PacketPanel.jsx
components/sandbox/Sandbox.jsx
components/scenarios/ScenarioBuilder.jsx
components/shell/SiteFooter.jsx
components/shell/SiteNav.jsx
components/simulator/ResultSheet.jsx
components/simulator/ScenarioArt.jsx
components/simulator/ScenarioList.jsx
components/simulator/ScenarioRunner.jsx
components/simulator/Simulator.jsx
components/simulator/TimerRing.jsx
components/ui/CheckList.jsx
components/ui/DeviceGlyph.jsx
components/ui/Icon.jsx
components/ui/Segmented.jsx
components/ui/Sheet.jsx
components/ui/Stepper.jsx
components/ui/Switch.jsx
components/ui/Toast.jsx
components/workbench/ActionBar.jsx
components/workbench/AddressPlan.jsx
components/workbench/DeviceDock.jsx
components/workbench/DeviceEditor.jsx
components/workbench/LinkPopover.jsx
components/workbench/NetworkCanvas.jsx
components/workbench/Toolbar.jsx
components/workbench/Workbench.jsx
docs/custom-scenarios.md
docs/device-editor.md
docs/devices-addressing-cabling.md
docs/hub-broadcast.md
docs/layer1-hubs.md
docs/packets.md
docs/ping-reply.md
docs/progress.md
docs/project-structure.md
docs/recommendation.md
docs/switch.md
docs/transit-filtering.md
jsconfig.json
lib/cabling.js
lib/customScenarios.js
lib/deviceEditor.js
lib/devices.js
lib/format.js
lib/hints.js
lib/ip.js
lib/layouts.js
lib/lessons.js
lib/network.js
lib/networkReducer.js
lib/overlays.js
lib/packets.js
lib/pdf.js
lib/policies.js
lib/resolveScenario.js
lib/scenarios.js
lib/spring.js
lib/storage.js
next.config.mjs
package.json
styles/builder.css
styles/pages.css
styles/tokens.css
styles/ui.css
styles/workbench.css
tests/cabling.test.js
tests/customScenarios.test.js
tests/device-editor.test.js
tests/fixtures.js
tests/helpers.js
tests/hub-broadcast.test.js
tests/ip.test.js
tests/layer1.test.js
tests/layouts.test.js
tests/network.test.js
tests/packets.test.js
tests/ping-reply.test.js
tests/reducer.test.js
tests/scenarios.test.js
tests/storage.test.js
tests/switch.test.js
tests/transit.test.js
```

## Architecture [R]

1. **`lib/` decides, components draw.** Everything with rules in it (network document, history, scenario checks, storage, geometry, spring maths, PDF text) is React-free and covered by `tests/`.
2. **One document model** (`lib/networkReducer.js`): `{ nodes, edges, policies, seq }`, with undo and redo. Policies are keyed by device id. Edges are keyed by the sorted pair, so a pair links once.
3. **One editor** (`components/workbench/Workbench.jsx`) serves both the sandbox and the simulator. Nothing is configured in its sidebar: a device is edited in a modal and a link in a popover. The simulator wraps it with a brief, a countdown, a requirements panel and result sheets.
4. **Scenarios are data plus checks** (`lib/scenarios.js`). Server components pass only ids to client components, because scenarios contain functions.
5. **Route groups:** `(site)` pages have the footer; `(bench)` pages are the full-height workbench.
6. **One packet engine** (`lib/packets.js`): `traceRoute` is a pure function of the document. It finds the route, then meets the devices on it in order (hubs copy, other devices filter), and answers a ping with a reply. The sandbox's packet panel only draws its result.

## Feature to file map [R]

| Feature | Files |
|---|---|
| Canvas gestures (drag, momentum, link, keyboard) | `components/workbench/NetworkCanvas.jsx`, `lib/spring.js` |
| Device dock (drag or tap to add) | `components/workbench/DeviceDock.jsx`, `lib/network.js` (`nextFreeSpot`) |
| Device editor (name, address, policies, several devices at once) | `components/workbench/DeviceEditor.jsx`, `lib/deviceEditor.js`, `lib/networkReducer.js`, `lib/policies.js`, `lib/ip.js` |
| Link popover, action bar, first-use hints | `components/workbench/LinkPopover.jsx`, `components/workbench/ActionBar.jsx`, `lib/overlays.js`, `lib/hints.js` |
| Scenario grading | `lib/scenarios.js`, `components/simulator/*` |
| Save and open topologies | `components/sandbox/Sandbox.jsx`, `lib/storage.js` |
| Results and PDF | `components/results/ResultsList.jsx`, `lib/storage.js`, `lib/pdf.js` |
| Lessons | `components/learn/*`, `lib/lessons.js`, `lib/layouts.js` |
| Custom scenarios | `lib/customScenarios.js`, `components/scenarios/ScenarioBuilder.jsx`, `lib/storage.js` |
| Devices (router, switch, hub, PC, server, modem) and the Layer 1 hub rule | `lib/devices.js`, `components/ui/DeviceGlyph.jsx` |
| IP classes and cabling | `lib/ip.js`, `lib/cabling.js`, `components/workbench/AddressPlan.jsx` |
| Sending a packet: route, hub copies, storms, filtering on the way, ping replies | `lib/packets.js`, `components/sandbox/PacketPanel.jsx`, `components/workbench/NetworkCanvas.jsx` |
| Design system | `styles/tokens.css`, `styles/ui.css`, `styles/workbench.css`, `styles/builder.css` |

## Testing [V]

- `npm test` runs **217** tests, all passing at generation time.
- Covered: graph helpers, renaming, the editor's policy counts, where overlays sit, first-use hints, IP validation and classes, cabling, spring maths, the reducer and history, every built-in scenario (reference solutions plus a regression for each 1.x bug), custom scenarios, the Layer 1 hub rule, the Switch, packet tracing (routes, hub copies, broadcast storms, filtering on the way, ping replies, with seeded randomized checks against independent statements of the rules), storage (with a fake store), diagram layouts, PDF text.
- Not covered in the repository: components and end-to-end flows. They were exercised in a headless Chromium harness during development (see `progress.md`) but that harness is not shipped.
