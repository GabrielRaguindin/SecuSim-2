# End-to-end testing (Playwright)

> **Evidence tags:** **[V]** verified by running it · **[R]** verified by reading the code · **[U]** unverified.
> The smoke tests pass against the production build on the project owner's machine, and the GitHub Actions workflow ran green on its first push [V, reported by the owner]. Where this page describes a file, the file in the repository is the source of truth.

Unit tests check the logic in `lib/`. End-to-end (e2e) tests open the real built app in a browser and do what a user does. Both are needed: a unit test cannot tell you that a button is covered by a hint, and an e2e test is a slow way to check an IP rule.

## What lives where

```
playwright.config.js        Root. Browsers, base URL, retries, and how the server starts
e2e/                        Playwright specs, named *.spec.js
  smoke.spec.js             Three smoke tests (below)
  toolbar.spec.js           Seven toolbar tests: captions, nothing cut off at four widths, Undo and Redo on a phone
tests/                      Unit tests, named *.test.js, run by `node --test`
.github/workflows/e2e.yml   CI: unit tests, then e2e tests, on push and pull request
playwright-report/          Generated HTML report (git-ignored)
test-results/               Generated traces and failure screenshots (git-ignored)
```

The two suites never pick up each other's files. `node --test` matches `*.test.js`, and Playwright's `testDir` is `./e2e` with `*.spec.js` files.

## Commands

| Command | What it does |
|---|---|
| `npm test` | Unit tests only. Unchanged by Playwright |
| `npm run test:e2e` | Builds the app, starts it on port 3100, runs every spec, writes the HTML report |
| `npm run test:e2e:ui` | Opens Playwright's interactive UI for picking and watching tests |
| `npm run test:e2e:headed` | Runs with a visible browser window |
| `npm run test:e2e:report` | Opens the last HTML report. It needs a finished run first |

Useful flags, passed after `--`:

```sh
npm run test:e2e -- --project=chromium        # one browser project only
npm run test:e2e -- e2e/smoke.spec.js         # one file
npm run test:e2e -- -g "device can be added"  # tests whose name matches
npm run test:e2e -- --debug                   # step through with the inspector
```

## How the config works

- **Production server, not dev.** The config builds the app and runs `next start` on **port 3100**, so tests run against what users get and never collide with `npm run dev` on 3000. `next dev` compiles routes on first visit, which makes tests slow and flaky.
- **`baseURL`** is `http://localhost:3100`, so specs use `page.goto('/sandbox')`.
- **Reusing a server.** Locally, a server already running on 3100 is reused. On CI a fresh one is always started.
- **CI behaviour.** One worker, two retries, and `forbidOnly` so a stray `test.only` fails the build.
- **Reports.** The terminal gets the `list` output and an HTML report is always written without auto-opening. On CI the GitHub reporter is used as well.
- **Failures** keep a screenshot, and a trace on the first retry. Open a trace with `npx playwright show-trace test-results/<folder>/trace.zip`.
- **Projects.** `chromium` (desktop) and, if kept in your config, a phone project. Check `playwright.config.js` for the exact list [U].

Do not run `npm run dev` while the e2e build runs. Both write to `.next`.

## The smoke tests

`e2e/smoke.spec.js` holds three deliberately small tests:

1. **Home to sandbox.** The home page heading renders and the "Open the sandbox" link goes to `/sandbox`.
2. **Add a device.** In the sandbox, the "Add PC" dock button puts a device named "PC 1" on the canvas. The test first waits for the hydration marker (below).
3. **Scenario brief.** `/simulator/file-sharing` opens its brief dialog with a Start button.

They prove the build starts, routes render, hydration works and the editor can be reached. They do not prove that any feature works in depth.

## Writing a spec for SecuSim

Find elements the way a user or screen reader would. The app already exposes the names you need:

| To reach | Use |
|---|---|
| A dock button | `getByRole('button', { name: 'Add PC' })` |
| A device on the canvas | `getByRole('button', { name: /^PC 1/ })`. Its label also carries the IP, policy count and selection state |
| A sheet or modal | `getByRole('dialog')` |
| A toggle | `getByRole('switch', { name: 'Allow web traffic' })` |

SecuSim-specific points to remember:

- **Storage starts empty.** Every test gets a fresh browser context, so `localStorage` (`secusim:v2:*`) is clean. To test persistence, reload within the same test.
- **Wait for hydration before clicking.** The page is server-rendered, so buttons are visible before React has attached their handlers, and an early click is silently lost. `Workbench` sets `data-ready="true"` on its root (class `sx-bench`) once it has hydrated. In any spec that clicks straight after `page.goto`, first `await expect(page.locator('[data-ready="true"]')).toBeVisible()`. The marker is on sandbox and simulator pages; other pages need no wait for navigation links. [V, applied and working, reported by the owner]
- **First-use hints** appear in fresh contexts and can cover controls. Dismiss them in the test, or seed `secusim:v2:hints` before load with `page.addInitScript` (check the stored shape in `lib/hints.js` first [U]).
- **Sheets ignore backdrop clicks for 450 ms** after opening. Click buttons inside them.
- **Exact drags.** Use `test.use({ reducedMotion: 'reduce' })` to switch off the glide after a drag, and allow a short settle after zoom keys before measuring positions.
- **Canvas gestures** (drag, pan, link, pinch) are pointer events. Use `page.mouse.move/down/up`. Devices and the dock are ordinary buttons, so `locator.click()` works for them.
- **Touch.** A real pinch needs CDP touch events in Chromium. It cannot be done with `page.mouse`.
- **Prefer state over pixels.** Assert on names, counts and visible text rather than coordinates where possible.

## Working rule

A patch that changes what a user sees or does adds or updates an `e2e/` spec for it. Before a patch is called delivered, these all pass:

1. `npm run lint`
2. `npm run build`
3. `npm test` (unit tests)
4. `npm run test:e2e`

## What is and is not protected today

**Protected by tests in the repository:** the build starts, the home, sandbox and scenario routes render, a device can be added, and a scenario brief opens (the three smoke tests, passing locally and on GitHub Actions [V, reported by the owner]). Since Patch 2.5.3, the toolbar captions and the toolbar layout on phone widths are protected by `e2e/toolbar.spec.js` [V in the development environment; not yet run on the owner's machine or on GitHub].

**Verified during development only, not yet in `e2e/`** [U as repository tests]:

- pan, zoom, fit and the two-finger pinch
- the device editor and the link popover
- sending packets and reading results
- custom scenarios
- all three built-in scenarios built through the UI
- the PDF download on the Results page, which has never been exercised

Porting these into specs is the next testing task. Adding Firefox and WebKit projects is the cheapest way to start covering Safari and Firefox.

## Adding a browser project

In `playwright.config.js`, add to `projects`:

```js
{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
{ name: 'webkit', use: { ...devices['Desktop Safari'] } },
```

Then install the binaries (`npx playwright install --with-deps firefox webkit`) and update the install step in the CI workflow to match. Expect some failures at first. Spring curves, `backdrop-filter` and touch dragging are the likeliest to differ.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `No report found at ...playwright-report` | No run has finished yet, or the config only writes the HTML report on CI. Run `npm run test:e2e` first |
| `webServer` timeout | The build took longer than the timeout, or port 3100 is in use. Build once, then point the config command at `next start` |
| `Total: 0 tests` | The file is outside `e2e/` or is not named `*.spec.js` |
| A control cannot be clicked on the phone project | A hint or the toolbar is covering it. Check the failure screenshot |
| Errors mentioning `e2e/` from `npm test` | A spec was named `*.test.js`. Rename it to `*.spec.js` |
