# Toolbar labels and the phone toolbar (Patch 2.5.3)

The toolbar had two problems. Its icons were cryptic and, on a touch screen, there is no hover to explain them. And on a phone the top-left group of tools was wider than the screen, so Undo and Redo were cut off. Both are fixed here.

## Captions

Five buttons in the **Actions** group carry a short caption under the icon, and so does **Library** in the sandbox:

| Button | Caption | Accessible name |
|---|---|---|
| Select all | Select all | Select all devices |
| Lightning bolt | Assign IP | Assign IP addresses |
| Trash | Delete | Delete selection |
| Reset arrow | Clear | Clear the canvas |
| Folder (sandbox only) | Library | Library |
| Side panel | Hide panel / Show panel | Hide panel / Show panel |

- Each caption is the start of the button's accessible name, so what you see is what a screen reader says.
- The tooltips (with the keyboard shortcut) are unchanged.
- **One name changed.** The side-panel button was "Hide the side panel" / "Show the side panel" and is now "Hide panel" / "Show panel", to match its caption. Nothing in the repository's tests referred to the old name.
- The Tools group (Select, Link, the cable choice, Undo, Redo) stays icon-only. Those icons are conventional, and the group is already the widest part of the toolbar.
- The Library button in the sandbox is now the same stacked style as its neighbours, instead of a tinted pill.

## A toolbar group can no longer run off the canvas

- Each group may now **wrap** onto a second line (`flex-wrap`) and is limited to the width of the canvas. A button can be pushed down, but never out of reach.
- At **640px and narrower**, the word "Cable" and the divider lines are hidden, the plain icon buttons are 36px instead of 38px, and the captioned buttons are a little narrower. Together this keeps each group on **one row at 390px and 412px**.
- At **360px**, the Tools group and the Actions group each wrap onto a second line. Everything is still on the canvas.
- Wrapped groups use softer corners than the pill shape.

Measured in headless Chromium against the built app (Tools group, then Actions group):

| Viewport | Before | After |
|---|---|---|
| 412 px | Redo cut off | Both groups one row each |
| 390 px | Undo and Redo cut off | Both groups one row each |
| 360 px | Not measured before | Both groups wrap to two lines, nothing cut off |
| 1280 px (side panel open) | One row | One row |

## Things to know

- The Actions group is a little taller (58px against 46px), because of the captions. On a desktop the toolbar still ends above the first-use hint and above the area new devices are placed in.
- On a phone the toolbar is taller than before, so there is slightly less free canvas between the toolbar and the dock.
- Below about 1000px wide, with the side panel open, the two groups still wrap onto separate rows, as they did before.

## Files

| Area | File |
|---|---|
| Captions | `components/workbench/Toolbar.jsx`, `components/sandbox/Sandbox.jsx` (Library) |
| Wrapping and phone sizes | `styles/workbench.css` |
| Tests | `e2e/toolbar.spec.js` (7 tests, run in both browser projects) |

## Tests

`e2e/toolbar.spec.js` checks that every captioned button shows its caption, that the panel button changes its label, that no toolbar button is cut off at 1280, 412, 390 and 360px wide, and that Undo and Redo work on a 390px screen. Run against the code from before this patch, the caption tests and the 412, 390 and 360px tests fail, so they do detect the original problem. The 1280px test and the Undo and Redo test pass on the old code too: they guard against regressions rather than detect the old defect.
