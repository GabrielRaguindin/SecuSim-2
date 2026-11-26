# SecuSim 2.0: Progress

> **Evidence tags:** **[V]** verified by running it · **[R]** verified by reading the code · **[U]** unverified.
> Not written to GitHub by the assistant (it has no repository connection). Each patch is applied to the repository by the project owner.

## What exists

| Area | Status | Evidence |
|---|---|---|
| Network model, history, validation | COMPLETED | Unit tests [V] (238 across the project) |
| Scenario grading (3 scenarios, reference solutions, a regression per 1.x bug) | COMPLETED | Unit tests [V] |
| Storage (results, topologies) | COMPLETED | Unit tests with a fake store [V]; real `localStorage` exercised in a browser [V] |
| Workbench: dock, canvas, link tool, device editor, link popover, undo, shortcuts | COMPLETED | Driven end to end in headless Chromium [V] |
| Sandbox with library | COMPLETED | Save, reload, reopen restored devices, links and IPs [V] |
| Simulator: brief, countdown, check, finish, save, retry, timeout | COMPLETED | A full Scenario 3 run through the UI scored 7 of 7 [V]; timeout tested with a fake clock [V] |
| Custom scenarios (build, validate, save, import, export) | COMPLETED | Unit tests, including proof that every saved scenario can be completed [V]; driven in the browser [V] |
| Server device, IP classes, Ethernet cabling | COMPLETED | Unit tests [V]; browser checks [V] |
| Sandbox packets (route, cables, networks, firewall at the ends) | COMPLETED | Unit tests, including a seeded randomized check [V]; browser [V] |
| Scenarios 1 to 3 revised; the hub as a Layer 1 device | COMPLETED | Unit tests [V]; all three built-ins completed through the UI [V] |
| 2.4.1 The Switch | COMPLETED | Unit tests [V]; browser checks, including a 360px dock [V] |
| 2.4.2 Hub as a strict broadcaster, broadcast storm detection | COMPLETED | Unit tests [V]; a three-hub loop built by hand in the browser, the storm and the fix [V] |
| 2.4.3 Expanded security enforcement (filtering on the way, default-deny permissions) | COMPLETED | Unit tests with a 2000-network randomized check [V]; browser [V] |
| 2.4.4 Ping mechanics (Answered, No reply, the reply) | COMPLETED | Unit tests with a 3000-network randomized check [V]; every outcome driven in the browser [V] |
| 2.5.1 Device editor, link popover, action bar, hints, rename; sidebar cleared | COMPLETED | Unit tests [V]; 78 browser checks, including all three built-in scenarios completed through the new editor and a packet flow [V]; touch double-tap on an emulated phone [V] |
| 2.5.2 Pan and zoom, fit, a hideable side panel, compact clock in timed scenarios | COMPLETED | Unit tests [V]; 66 browser checks against the real built app, including all three scenarios built on the new canvas and a real two-finger pinch [V]; lint and production build clean [V] |
| 2.5.3 Toolbar captions, phone toolbar no longer cut off | COMPLETED | Lint clean, production build, 238 unit tests and the new e2e spec run 42 times (7 tests x 2 projects x 3 repeats), all passed in the development environment [V]; the new spec fails against the code from before the patch [V]; **not yet run on the owner's machine or on GitHub [U]** |
| **Playwright end-to-end tests in the repository** | **IN PROGRESS** (smoke level done) | `@playwright/test` is installed and `playwright.config.js` and `e2e/smoke.spec.js` are in the repo. The three smoke tests (home to sandbox, add a device, scenario brief opens) **pass against the production build on the project owner's machine, and the GitHub Actions workflow ran green on its first push** [V, reported by the owner]. The larger flows are **not yet in the repository** (see below) |
| Results page, PDF export | IN PROGRESS | List, expand and delete verified [V]. **PDF download not exercised** (jsPDF was stubbed in the harness); text sanitiser tested [V] |
| Learn pages and packet demo | COMPLETED | Rendered and the packet animation ran [V] |
| Design system, light and dark, phone layout | COMPLETED | Screenshots reviewed for every page [V] |
| Accessibility basics (roles, labels, keyboard, reduced motion) | IN PROGRESS | Keyboard operation and reduced motion tested [V]. **No screen-reader pass** [U] |

## Verified by the project owner

`npm run lint` reported no ESLint warnings or errors, and `npm run build` compiled, type-checked and generated all 19 pages (Next.js 14.2.5), run on the owner's checkout after Patch 2.5.1 [V, reported by the owner]. The patches have been applied to the GitHub repository.

Playwright was installed and configured on the owner's checkout, the smoke tests passed there, and the GitHub Actions workflow ran green when pushed [V, reported by the owner]. The test count and the browser projects (Chromium, and the phone project if it was kept) were not recorded in this file.

## Playwright is integrated

End-to-end tests now live in the repository, separate from the unit tests (see `docs/e2e-testing.md`, which also lists what is and is not protected):

- `playwright.config.js` at the root starts the production server on port 3100 and sets the base URL.
- `e2e/*.spec.js` holds the browser tests. `tests/*.test.js` keeps the unit tests and still runs with `npm test`.
- `npm run test:e2e` runs the browser tests. `npm test` is unchanged.
- The config was hardened (explicit timeouts, reduced motion, `127.0.0.1`, retained traces, a separate CI build step, `timeout-minutes` and `concurrency` in the workflow) and `Workbench` gets a `data-ready` hydration marker that the smoke tests wait for. **Applied and working on the owner's machine [V, reported by the owner].**

**Working rule from here on:** a patch that changes what a user sees or does adds or updates an `e2e/` spec for it, and `npm run test:e2e` joins lint, the production build and `npm test` in the gate before the patch is called delivered. The older browser scripts used during development (pan, zoom, editor, all three scenarios, the two-finger pinch) were sandbox-specific and are **not** in the repository. Until they are ported, those flows count as verified in development only, not as protected by the repository's tests.

## Not verified

1. **Browsers other than Chromium** [U]: Safari and Firefox untested. Check the spring curves, `backdrop-filter` and touch dragging. Playwright can run Firefox and WebKit once they are added as projects, which is the cheapest first step.
2. **Real touch hardware** [U]: touch was emulated.
3. **PDF output** [U], as above.
4. **Hydration in a real browser** [U]: geometry is rounded to avoid mismatches. The production build prerendered every page without errors, which covers server rendering.
5. **Flows beyond the smoke and toolbar specs** [U]: no e2e spec yet covers pan and zoom, the device editor, the link popover, packets, custom scenarios, or building the three scenarios.

## Patch 2.5.3 is delivered

The toolbar's cryptic icons now carry captions, and the toolbar groups wrap instead of running off the canvas, so Undo and Redo are no longer cut off on a 390px or 412px phone (see `docs/toolbar.md`). The simulator and keyboard pass moves to 2.5.4. `e2e/toolbar.spec.js` adds 7 tests per browser project. **From this patch on, the browser tests are also run in the development environment against a clean install of the repository.** Real phone hardware is still untested [U].

## Patch 2.5.2 is delivered

The canvas can be panned and zoomed and the side panel hidden (see `docs/canvas-view.md`). Patch 2.5 continues with 2.5.3 (toolbar labels, and a pass over the simulator, the phone layout and keyboard use); one-click fixes in the packet result are agreed for a later patch. **From this patch on, ESLint and the production build are also run in the development environment, and the app is tested in a real browser against the built Next.js app. Touch (a pinch and a one-finger pan) was driven in Chromium with real touch events, not tried on a real phone [U].**

## Patch 2.5.1 is delivered

Configuration moved out of the sidebar into a device editor and a link popover (see `docs/device-editor.md`). Patch 2.5 continued with 2.5.2 (pan, zoom and a hideable side panel, below) and goes on with 2.5.3 (toolbar labels and polish); one-click fixes in the packet result are agreed for a later patch.

## Patch 2.4 is complete

Switch, strict hub broadcasting with storm detection, expanded security enforcement and the ping reply are all in. See `docs/switch.md`, `docs/hub-broadcast.md`, `docs/transit-filtering.md` and `docs/ping-reply.md`, and `docs/recommendation.md` for the numbering (the original 2.4.3 was dropped and the original 2.4.5 became 2.4.3). The outline for Patch 2.5 is still to come.

## Decisions

None waiting. The 2.0 sign-off decisions were confirmed by the project owner and removed from `MIGRATION.md`. The changes behind them are recorded where they live: Scenario 1 in `docs/recommendation.md` (2.3.1), hubs in `docs/layer1-hubs.md`, and the revised Scenarios 2 and 3 in `docs/layer1-hubs.md`.

## Next actions

| Priority | Action |
|---|---|
| P1 | Port the development browser flows into `e2e/` as specs: pan and zoom, the device editor, the link popover, packets, and all three scenarios built through the UI |
| P1 | Add Firefox and WebKit projects to `playwright.config.js` and run the suite on them |
| P1 | Test on a real phone; download a PDF and open it |
| P1 | Screen-reader pass on the canvas, the device editor, the link popover and sheets |
| P2 | Deploy (nothing server-side is needed, so any static or Node host works) and set `NEXT_PUBLIC_SITE_URL` |
| P2 | 2.1 candidates: marquee selection, drag-to-dismiss sheets, per-policy lessons |

## Recommended next step

Finish Patch 2.5 (2.5.4: the simulator and keyboard pass), with an e2e spec for each thing it changes, and have testers try the new editor and canvas. Their feedback decides whether one-click fixes or reachability requirements come next.
