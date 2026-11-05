# SecuSim 2.0: Progress

> **Evidence tags:** **[V]** verified by running it · **[R]** verified by reading the code · **[U]** unverified.
> Not written to GitHub. No repository connection was available, so this is a deliverable to commit.

## What exists

| Area | Status | Evidence |
|---|---|---|
| Network model, history, validation | COMPLETED | Unit tests [V] (197 across the project) |
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
| 2.5.1 Device editor, link popover, action bar, hints, rename; sidebar cleared | COMPLETED | Unit tests [V]; 73 browser checks, including all three built-in scenarios completed through the new editor and a packet flow [V]; touch double-tap on an emulated phone [V] |
| Results page, PDF export | IN PROGRESS | List, expand and delete verified [V]. **PDF download not exercised** (jsPDF was stubbed in the harness); text sanitiser tested [V] |
| Learn pages and packet demo | COMPLETED | Rendered and the packet animation ran [V] |
| Design system, light and dark, phone layout | COMPLETED | Screenshots reviewed for every page [V] |
| Accessibility basics (roles, labels, keyboard, reduced motion) | IN PROGRESS | Keyboard operation and reduced motion tested [V]. **No screen-reader pass** [U] |

## Not verified

1. **`npm install`, `next build`, `next lint`**: not run (no network where this was built) [U]. The code was compiled with esbuild with the Next modules stubbed, and ran under React 19 although the project pins React 18. Expect to fix small things on first build, most likely lint warnings about hook dependencies.
2. **Browsers other than Chromium** [U]: Safari and Firefox untested. Check the spring curves, `backdrop-filter` and touch dragging.
3. **Real touch hardware** [U]: touch was emulated.
4. **PDF output** [U], as above.
5. **Server rendering and hydration** [U]: geometry is rounded to avoid mismatches, but it has not been seen in a real Next server render.

## Patch 2.5.1 is delivered

Configuration moved out of the sidebar into a device editor and a link popover (see `docs/device-editor.md`). Patch 2.5 continues with 2.5.2 (toolbar labels) and 2.5.3 (polish and verification); one-click fixes in the packet result are agreed for a later patch. **Touch was emulated, not tried on a real phone [U].**

## Patch 2.4 is complete

Switch, strict hub broadcasting with storm detection, expanded security enforcement and the ping reply are all in. See `docs/switch.md`, `docs/hub-broadcast.md`, `docs/transit-filtering.md` and `docs/ping-reply.md`, and `docs/recommendation.md` for the numbering (the original 2.4.3 was dropped and the original 2.4.5 became 2.4.3). The outline for Patch 2.5 is still to come.

## Decisions waiting for you

See `MIGRATION.md`, section "Decisions that need your sign-off". The impossible Scenario 1 requirement ("each PC connected to a router") is resolved: Scenario 1 is now a ring of 8 PCs with no routers.

## Next actions

| Priority | Action |
|---|---|
| P0 | Run `npm install`, `npm run build`, `npm run lint`, and fix what they report |
| P0 | Commit the 2.0 foundation and the patches on top of it as branches or commits; confirm the sign-off decisions |
| P1 | Add Playwright tests to the repo that run against `next dev` (the flows in this file marked [V] are the script) |
| P1 | Test on Safari, Firefox and a real phone; download a PDF and open it |
| P1 | Screen-reader pass on the canvas, the device editor, the link popover and sheets |
| P2 | Deploy (nothing server-side is needed, so any static or Node host works) and set `NEXT_PUBLIC_SITE_URL` |
| P2 | 2.1 candidates: marquee selection, drag-to-dismiss sheets, pan and zoom, per-policy lessons |

## Recommended next step

Run the build in a real checkout. It is the one verification this environment could not do, and everything else is ready to be judged against it.
