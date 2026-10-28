# From 1.x to 2.0

## What changed at a glance

| | 1.x | 2.0 |
|---|---|---|
| Canvas | vis-network, with DOM-to-canvas coordinate mixing | Own SVG canvas, pointer events, one coordinate system |
| Scenarios | Three components of about 900 lines, 95% identical | One `Simulator` driven by data in `lib/scenarios.js` |
| Validation | Inline in components, untestable | Pure functions in `lib/`, 46 tests |
| Persistence | Server memory (lost on restart) and unrelated `localStorage` keys | Namespaced `localStorage` only. No API routes |
| Policies keyed by | IP address (orphaned and ghost entries) | Stable device id |
| UI kit | flowbite-react, Tailwind | Hand-written CSS design system (tokens, springs, materials) |
| Device placement | HTML5 drag and drop, desktop only | Pointer events: mouse, touch, pen. Tap or keyboard also adds a device |
| Check results | Fake 10-second progress bar | Instant, with a reason and a next step for every requirement |
| Mobile | Blocked by user-agent sniffing | Works. Layout adapts |
| Router | App Router plus Pages Router API routes | App Router only |

Dependencies removed: `flowbite-react`, `vis-network`, `vis-data`, `react-icons`, `tailwindcss`, `postcss`. Kept: `next`, `react`, `react-dom`, `jspdf`.

## Every bug from the 1.x audit

| ID | Was | Now |
|---|---|---|
| B-01 | Topology check passed with no links | Fixed. Ring and mesh require links, connectivity and exact degrees. Tested |
| B-02 | Deleted devices still counted in policy checks | Fixed. Deleting removes links and policies. Tested |
| B-03 | Changing an IP lost the device's policies | Fixed. Policies keyed by id. Re-saving your own IP is fine. Tested |
| B-04 | Policy checks ignored device type | Fixed. Checks name the type they need ("router and both hubs only"). Tested |
| B-05 | Scenario 3 said "Expected 6 PCs" | Fixed. Messages are built from the same data as the rule. Tested |
| B-06 | Results lost on server restart | Fixed. Stored in the browser, 30-day expiry kept |
| B-07 | Space key linked nodes while typing | Removed. Shortcuts are ignored in text fields and while a sheet is open. Browser-tested |
| B-08 | Duplicate or reversed links | Fixed. A pair links once, in either order. Tested |
| B-09 | Stop left the check hanging; side effects in a state updater | Removed with the fake progress bar. The clock runs from a deadline |
| B-10 | Listener leak on a non-existent event | Gone with vis-network |
| B-11 | Stale closure cleared the selection | Fixed. One selection model |
| B-12 | Library listed every `localStorage` key | Fixed. One namespaced key. Tested |
| B-13 | Wrong favicon path; Facebook URL as site URL | Fixed. `app/icon.svg`; `NEXT_PUBLIC_SITE_URL` |
| B-14 | `headers()` forced dynamic rendering | Fixed. Gone with the UA sniffing |
| B-15 | Font weights loaded did not match those used | Fixed. System font stack |
| B-16 | Double fetch, tooltip typo, unwrapped PDF text | Fixed. PDF wraps and paginates. Text sanitiser tested |
| B-17 | Duplicate `PolicyCard` and `TopologyCard` | Fixed |
| B-18 | Conflicting canvas height classes | Fixed |
| B-19 | Relative and absolute image paths | N/A. Devices are drawn in SVG, so there are no image assets |
| B-20 | Results had no scenario id; duplicates on repeated save | Fixed. Each record carries its scenario; Save becomes Saved |
| B-21 | Policy settings saved but never read | Removed. The Learn page is explanation, not a form |
| B-22 | Dead CSS variables | Fixed |
| B-23 | Copy typos | Fixed. Copy rewritten |
| B-24 | Mixed coordinate systems on drop | Fixed. Single coordinate system |
| B-25 | Hamburger did nothing on scenario pages | Fixed. Navigation is always present |

## Decisions that need your sign-off

2.0 changed a few requirements because the 1.x text and the 1.x checks disagreed. Please confirm each.

1. **Scenario 1: "each PC is connected to at least one router".** This cannot be done in a ring of 12 devices with 2 routers (each router has two neighbours, so at most 4 PCs can touch one). 1.x never checked it. 2.0 drops it and asks for "a single ring of all 12 devices". If you want a router-centred requirement, a different topology is needed.
2. **Scenario 1: Block untrusted IP.** 1.x required it on every device; the text says "for the file-sharing PCs". 2.0 requires it on the five file-sharing PCs only.
3. **Scenario 2: Allow web traffic.** The text says all devices; 1.x only counted devices that also had streaming on. 2.0 requires every device, as written. The star is strict: the router links to all other devices and nothing else is linked.
4. **Scenario 3: Remote desktop** is now exactly the router and both hubs, as the text says. 1.x accepted any three devices.
5. **IP addresses** reject leading zeros ("01.2.3.4"). 1.x allowed them.
6. **Results are per browser.** There is no account or server. If you want results shared across devices, that needs a backend and a decision about identity.
7. **Policy names** have corrected capitalisation and spelling ("VoIP", "end-to-end").

## Not verified, and next steps

- `npm install`, `next build` and `next lint` were **not run** (the build environment had no network). The code was compiled and run in a real browser through an esbuild harness with the Next modules stubbed, using React 19 where the project pins React 18. Run `npm run build` first and fix anything it reports.
- Safari and Firefox were not tested; only Chromium. The things most worth a look there are the spring curves, `backdrop-filter`, and touch dragging.
- No screen-reader pass yet. Semantics are in place (labelled controls, switch roles, live regions, keyboard operation of the canvas) but have not been heard.
- Not built, and would suit 2.1: marquee selection, drag-to-dismiss on sheets, pan and zoom for large networks, a lesson for each policy with a demo, and Playwright tests inside the repo.
