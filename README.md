# SecuSim 2.0

A free, browser-based sandbox for learning how networks are laid out and how security policies protect them. Drag devices onto a canvas, link them, give them IP addresses and policies, and complete timed scenarios that grade your work.

SecuSim began as a capstone project by Gabriel Raguindin. 2.0 is a redesign and a rebuild of the foundations. See `MIGRATION.md` for what changed and why.

## Quick start

```sh
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests (Node's built-in runner, no extra packages)
npm run build && npm start
```

Requires Node.js 18.17 or newer (Next.js 14.2.5 needs it).

Optional: set `NEXT_PUBLIC_SITE_URL` (for example `https://secusim.example.com`) so link previews use your real address.

## What is in it

| Route | What it does |
|---|---|
| `/` | Home, with a short orientation |
| `/learn/topologies` | Ring, star and mesh lessons. Send a packet through each one |
| `/learn/policies` | What access control, QoS, firewall and encryption policies do |
| `/sandbox` | A blank canvas with no clock. Save and reopen topologies from the Library |
| `/simulator` | The three scenarios, with a badge on any you have completed |
| `/simulator/[id]` | One scenario: brief, countdown, live requirements, graded check |
| `/results` | Saved attempts, expandable, with a PDF download for each |
| `/about` | How it works, privacy, keyboard shortcuts |

Everything runs in the browser. There is no server state and no API. Saved topologies and results live in `localStorage` under the `secusim:v2:` prefix.

## How the code is organised

```
app/            Routes only. Pages are thin; (site) has the footer, (bench) is the full-height workbench
components/
  workbench/    The shared editor: canvas, dock, toolbar, inspector (used by sandbox and simulator)
  simulator/    Brief, countdown, result sheets, scenario list
  sandbox/      Library (save and open)
  learn/        Diagrams and lessons
  ui/           Sheet, Switch, Segmented, Toast, Icon, CheckList
lib/            Plain JavaScript with no React: the network model, scenario checks, storage, geometry
styles/         tokens.css (design tokens), ui.css, workbench.css, pages.css
tests/          Node tests for everything in lib/
docs/           Project structure and progress notes
```

The rule that keeps this maintainable: **anything that decides something lives in `lib/` and is tested.** Components only draw and relay events.

### The network model (`lib/networkReducer.js`)

One document: `{ nodes, edges, policies, seq }`. Policies are keyed by the device's stable id, never by its IP, so editing an IP or deleting a device cannot leave ghost entries. A pair of devices can be linked only once (the edge id is the sorted pair). History (undo and redo) is built in, and a whole drag counts as one undo step.

### Scenarios (`lib/scenarios.js`)

A scenario is data plus a list of checks. Each check is a pure function of the document that returns `{ ok, detail }`, and `detail` always says what to do next. To add a scenario, add an entry to `SCENARIOS` and write its tests in `tests/scenarios.test.js`. The reference solution fixtures live in `tests/fixtures.js`.

## Design system

Three layers, all in `styles/`:

- **Tokens** (`tokens.css`): colour, type scale, shape, depth and two spring curves. Light and dark follow the system setting.
- **Motion** is spring-based. `--spring-soft` (sheets, device pop) and `--spring-snappy` (switches, presses) are real damped-spring solutions written as CSS `linear()` curves, with an ease-out fallback for browsers without it. Dragging a device keeps its release velocity and glides to rest on a spring, and grabbing it mid-glide stops it under your finger. `prefers-reduced-motion` removes the movement and keeps every state change.
- **Materials**: navigation, toolbar, dock and sheets are translucent with a blur, and fall back to solid surfaces where `backdrop-filter` is missing.

Type uses the system font stack, which is SF Pro on Apple devices (with automatic optical sizing) and the platform's UI font elsewhere. No web fonts are loaded.

## Testing

`npm test` runs 46 tests over the logic layer, including a regression test for each bug found in the 1.x audit.

The interface was also exercised end to end in a real browser during development (drag from the dock, momentum, undo, linking, IPs, policies, library save and reopen, a complete scenario run, timeout, reduced motion, keyboard-only use, a phone-sized layout). That harness is not part of this repository; see `docs/progress.md` for what was and was not verified. Adding Playwright tests that run against `next dev` is the recommended next step.

## Browser support

Current Safari, Chrome, Edge and Firefox. Older browsers lose the spring curves and the blur but keep every feature.
"# SecuSim-2" 
