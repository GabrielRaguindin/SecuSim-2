# Moving around the canvas, and a side panel you can hide (Patch 2.5.2)

The canvas used to be a fixed window: a network could not be bigger than the screen. It now has a **view** (where you are looking and how closely), so you can build big networks, and the side panel can be hidden to give the canvas the whole width.

## Moving and zooming

| Do this | To get this |
|---|---|
| **Drag the empty background** | Pan. Every device moves with it. A plain click on the empty canvas still lets go of the selection |
| **Scroll the wheel** | Zoom in or out around the pointer: whatever is under it stays under it |
| **Pinch** (two fingers) | Zoom around your fingers, and move as you go |
| **One finger** on the background | Pan, on a touch screen |
| **+** and **-** | Zoom in and out around the middle of the canvas |
| **0**, or the **Fit** button | Zoom and move so every device is in view (never zoomed in past 100%) |
| **1**, or press the percentage | Back to actual size |
| **Arrow keys** | Move the view (Shift for bigger steps). With a device focused, they nudge that device instead |

The zoom runs from **25% to 250%**. The controls sit in the bottom corner: Zoom out, the percentage, Zoom in, and Fit. On a phone they stand up at the side, above the dock, so they never cover it.

Everything else works at any zoom, and is tested at several: dragging a device (it follows the pointer exactly), linking, double-clicking a device or a link, the floating Edit / Link / Delete bar (it follows its device and keeps clear of its neighbours at the current size), the link popover, the packet animation, and dropping a device from the dock. A device you add, by tapping or by dropping, goes **where you are looking**.

### Things to know

- **Devices are no longer kept inside the visible area.** They can be anywhere in a large world (4000 units each way from the middle), and the view cannot be panned so far that the canvas is lost. If you have wandered off, **Fit** brings everything back.
- **Opening a saved network fits it to the screen**, wherever you had panned to. A saved network keeps its devices' positions, not the view.
- **Links keep their thickness on screen** at any zoom, so a link is as easy to click when zoomed out as when zoomed in.
- **The dotted background moves and scales with the view**, so it is clear that you are moving over a surface. Below 50% the dots are spaced wider so they don't turn into noise.
- **Moving around dismisses its hint.** After four devices, the canvas offers: *drag the background to move around, scroll or pinch to zoom, and press Fit to see everything.* It goes away for good once you do any of it.

## The side panel

A button at the right end of the canvas toolbar (or the **P** key) hides the side panel, and the canvas takes its whole width. The button shows as pressed while the panel is hidden, and the choice is remembered in this browser (`secusim:v2:ui`).

- Devices **stay exactly where they were** when the panel hides: the canvas simply grows to the right.
- The panel is **hidden, not removed**, so a packet in flight keeps going and nothing is lost.
- **In a timed scenario**, hiding the panel hides the timer and the requirements, so the clock and the **Check my work** button (or **View result** once finished) move onto the canvas, bottom left.

## Decisions worth knowing about

1. **Dragging the background pans.** A box-select (drag a rectangle round several devices) would need a different gesture, since this one is taken. It is a good candidate for later, and Shift-click and Select all still select several.
2. **The wheel zooms** (as in version 1), rather than scrolling. On a trackpad a pinch zooms too.
3. **The glide after dragging a device is unchanged**, and behaves the same at every zoom. One quirk that was already there: the glide follows the speed of the last movement, so holding a device still for a moment before letting go does not stop it. It would be a small fix if you want it.
4. **Two fingers always zoom**, even when one starts on a device, so the pinch is never mistaken for a drag. A pinch that starts on a device does nothing.

## Fixed along the way

- A device added after panning would have landed in the wrong place (the pan was counted twice). Caught by the new browser tests before delivery.
- **The toolbar's menus could be covered by the floating action bar**, which made the "Assign IP addresses" menu unclickable when the bar happened to sit beside it. This was already the case in 2.5.1; the toolbar now sits above the bar.

## Files

| Area | File |
|---|---|
| The view: panning, zooming, fitting, world coordinates | `lib/view.js` |
| Where new devices go; the action bar at other zooms | `lib/network.js` (`nextFreeSpotIn`), `lib/overlays.js` |
| The sidebar preference; the movement hint | `lib/storage.js`, `lib/hints.js` |
| Gestures (pan, wheel, pinch), world coordinates | `components/workbench/NetworkCanvas.jsx` |
| View state, shortcuts, hiding the panel | `components/workbench/Workbench.jsx`, `components/workbench/Toolbar.jsx` |
| Zoom controls | `components/workbench/ZoomControls.jsx` |
| The floating bar and popover follow the view | `components/workbench/ActionBar.jsx`, `components/workbench/LinkPopover.jsx` |
| The compact clock | `components/simulator/Simulator.jsx` |
| Styles | `styles/workbench.css` |
| Tests | `tests/view.test.js` (21 tests) |

`fitToBounds` in `lib/network.js` is no longer used by the app (opening a network now moves the view instead of rescaling the devices). It is left in place, with its tests.

## Not changed, and coming next

The phone layout still needs a pass: the top-left toolbar is wider than a 390px screen, so Undo and Redo are cut off there (this was already so). Together with labels on the toolbar icons, that is 2.5.3.
