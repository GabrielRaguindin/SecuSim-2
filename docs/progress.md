# SecuSim 2.0: Progress

> **Evidence tags:** **[V]** verified by running it · **[R]** verified by reading the code · **[U]** unverified.
> Not written to GitHub by the assistant (it has no repository connection). Each patch is applied to the repository by the project owner.

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
| 2.5.1 Device editor, link popover, action bar, hints, rename; sidebar cleared | COMPLETED | Unit tests [V]; 78 browser checks, including all three built-in scenarios completed through the new editor and a packet flow [V]; touch double-tap on an emulated phone [V] |
| Results page, PDF export | IN PROGRESS | List, expand and delete verified [V]. **PDF download not exercised** (jsPDF was stubbed in the harness); text sanitiser tested [V] |
| Learn pages and packet demo | COMPLETED | Rendered and the packet animation ran [V] |
| Design system, light and dark, phone layout | COMPLETED | Screenshots reviewed for every page [V] |
| Accessibility basics (roles, labels, keyboard, reduced motion) | IN PROGRESS | Keyboard operation and reduced motion tested [V]. **No screen-reader pass** [U] |

## Verified by the project owner

`npm run lint` reported no ESLint warnings or errors, and `npm run build` compiled, type-checked and generated all 19 pages (Next.js 14.2.5), run on the owner's checkout after Patch 2.5.1 [V, reported by the owner]. The patches have been applied to the GitHub repository.

## Not verified

1. **Browsers other than Chromium** [U]: Safari and Firefox untested. Check the spring curves, `backdrop-filter` and touch dragging.
2. **Real touch hardware** [U]: touch was emulated.
3. **PDF output** [U], as above.
4. **Hydration in a real browser** [U]: geometry is rounded to avoid mismatches. The production build prerendered every page without errors, which covers server rendering.

## Patch 2.5.1 is delivered

Configuration moved out of the sidebar into a device editor and a link popover (see `docs/device-editor.md`). Patch 2.5 continues with 2.5.2 (toolbar labels) and 2.5.3 (polish and verification); one-click fixes in the packet result are agreed for a later patch. **Touch was emulated, not tried on a real phone [U].**

## Patch 2.4 is complete

Switch, strict hub broadcasting with storm detection, expanded security enforcement and the ping reply are all in. See `docs/switch.md`, `docs/hub-broadcast.md`, `docs/transit-filtering.md` and `docs/ping-reply.md`, and `docs/recommendation.md` for the numbering (the original 2.4.3 was dropped and the original 2.4.5 became 2.4.3). The outline for Patch 2.5 is still to come.

## Decisions

None waiting. The 2.0 sign-off decisions were confirmed by the project owner and removed from `MIGRATION.md`. The changes behind them are recorded where they live: Scenario 1 in `docs/recommendation.md` (2.3.1), hubs in `docs/layer1-hubs.md`, and the revised Scenarios 2 and 3 in `docs/layer1-hubs.md`.

## Next actions

| Priority | Action |
|---|---|
| P1 | Add Playwright tests to the repo that run against `next dev` (the flows in this file marked [V] are the script) |
| P1 | Test on Safari, Firefox and a real phone; download a PDF and open it |
| P1 | Screen-reader pass on the canvas, the device editor, the link popover and sheets |
| P2 | Deploy (nothing server-side is needed, so any static or Node host works) and set `NEXT_PUBLIC_SITE_URL` |
| P2 | 2.1 candidates: marquee selection, drag-to-dismiss sheets, pan and zoom, per-policy lessons |

## Recommended next step

Finish Patch 2.5 (2.5.2 toolbar labels, 2.5.3 polish and verification), and have testers try the new editor. Their feedback decides whether one-click fixes or reachability requirements come next.
