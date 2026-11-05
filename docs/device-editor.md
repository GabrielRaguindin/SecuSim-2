# The device editor and the cleaner sandbox (Patch 2.5.1)

The sidebar used to hold everything: the selected device's details, an IP field, a class picker and sixteen policy switches in one long column. That column was the main complaint. Configuration now lives in two small, on-demand places, and the sidebar is back to the two things you look at while you work.

## What is beside the canvas now

| Page | Sidebar |
|---|---|
| Sandbox | **Send a packet** and **Address plan** |
| Simulator | The **Session** panel (timer, requirements, Check my work) and **Address plan** |

Nothing in the sidebar is edited. It is also narrower (330px, from 360px), and the packet panel's From and To menus now stack, so a device's name and address are never cut off.

## The device editor

Open it by **double-clicking** a device, **double-tapping** it on a touch screen, pressing **Enter** on a focused device, pressing **E** with a selection, or using **Edit** on the bar that floats beside a selected device. It is a modal on desktop and a bottom sheet on a phone.

| Part | What it has |
|---|---|
| Header | The device icon, an editable **name** and a one-line description |
| Address | The **IP address** and the three **class chips** on one row, and one line saying what the address is: "Class C, private, 192.168.1.0/24" |
| Policies | Four rows (Access control, Quality of service, Firewall, Encryption), each saying "N of 4 on". **One opens at a time**, showing its four policies, each with its toggle |
| Footer | **Remove device** and **Done**. The footer stays pinned, so it is never scrolled out of reach |

- **Closed, the editor fits without scrolling.** Opening a category adds its four rows, and the rest of the editor scrolls under the pinned footer if the screen is short.
- **Changes apply as you make them.** There is no Save button, and each change is one step in the undo history (Ctrl or ⌘ Z after closing, or the Undo button).
- **A hub** opens with its name and the Layer 1 explanation only: it has no address and can't hold policies.
- **In a timed scenario** the timer keeps running while the editor is open. If time runs out the editor closes and the result appears.
- In the **Name** and **IP address** fields, **Enter** saves, and **Escape** puts the old value back. A second Escape, with nothing left to undo, closes the editor. A cancelled draft is never saved by the blur that follows.

### Several devices at once

Select several devices (Shift-click, or the **Select all** button on the toolbar), then press **Edit 3** (or Enter on one of them, or E). The same editor opens as "3 devices": the policies only, with no name or address. One click on a toggle applies it to every selected device, and hubs are skipped. This is what makes default-deny workable: turning Allow web traffic on for a whole network is three steps.

### Names

A device can now be renamed. A name is **1 to 24 characters**, with spaces collapsed and trimmed, and **unique among the devices on the canvas, ignoring case** (so "Router 1" can never be ambiguous in a message). A bad name is explained in place and nothing is saved. Renaming is one undo step, saved networks keep their names, and the new name appears in the address plan, the packet menus and every result. Old saves load as before, and names longer than 24 characters are cut.

## The link popover

**Double-click** (or double-tap) a link, or select it and press **Edit** or **E**. A small popover hangs from the middle of the link:

- who it joins ("PC 1 to PC 2"),
- the **cable**, with a Straight-through / Crossover choice, and whether it is the right one and why (it updates as you change it),
- **Remove link**.

It closes on **Escape**, on a click anywhere else, when you pick something else, or when the link goes away.

## The action bar

Selecting something shows a small bar beside it, so editing never depends on knowing a gesture:

| Selection | Buttons |
|---|---|
| One device | **Edit**, **Link** (starts a link from that device), **Delete** |
| Several devices | **Edit N**, **Delete** |
| One link | **Edit**, **Delete** |

It sits above the selection and moves below, to the right or to the left if that would cover another device, always staying inside the canvas, clear of the toolbar and the dock. It is hidden in the Link tool, while an editor or popover is open, and when the page can't be edited.

## First-use hints

The old sidebar's tips are gone, so the canvas now teaches, one hint at a time:

1. After the first device: *double-click or double-tap a device to name it, give it an address and set its policies.*
2. With two devices and no link: *choose the Link tool (L), then drag from one device to another.*
3. Once there is a link: *double-click a link to see its cable, change it, or remove it.*
4. With three or more devices: *Shift-click several devices, or use Select all, then press Edit to set a policy on all of them at once.*

A hint goes away for good when you do the thing it describes or press **Got it**, and it is remembered in this browser (`secusim:v2:hints`).

## Decisions worth knowing about

1. **Double-tap is detected by SecuSim, not the browser.** The canvas switches off touch gestures, and the browser's own `dblclick` is unreliable there, so two taps within 380ms and 14px count as a double-tap, for a mouse and a finger alike.
2. **Double-clicking a device that is part of a multiple selection edits that device alone**, because the first click collapses the selection to it. To edit several, select them and press Edit, Enter or E.
3. **A sheet ignores backdrop clicks for 450ms after it opens.** On a touch screen the tap that opened the editor is followed by a synthetic click, which would otherwise land on the backdrop and close the editor the moment it appeared.
4. **The modal covers part of the canvas.** That is deliberate for a long list, and the link popover (short) does not.
5. **Cabling a link is unchanged.** The Link tool and the cable choice in the toolbar work as before.

## Files

| Area | File |
|---|---|
| Rename, name rules | `lib/networkReducer.js` (`rename`, `validateName`, `cleanDeviceName`) |
| Policy counts and states, the address line | `lib/deviceEditor.js` |
| Where the bar and popover sit | `lib/overlays.js` |
| Hint order and storage | `lib/hints.js`, `lib/storage.js` |
| The editor | `components/workbench/DeviceEditor.jsx`, `components/ui/Sheet.jsx` (custom header, backdrop guard) |
| The popover and the bar | `components/workbench/LinkPopover.jsx`, `components/workbench/ActionBar.jsx` |
| Gestures and Enter | `components/workbench/NetworkCanvas.jsx` |
| Wiring, hints, shortcuts | `components/workbench/Workbench.jsx`, `components/workbench/Toolbar.jsx` |
| Removed | `components/workbench/Inspector.jsx` |
| Tests | `tests/device-editor.test.js` (20 tests) |

## Not changed, and coming next

The sidebar's tips are replaced here, but a few things from the plan are still to come in 2.5.2 and 2.5.3: one-click fixes in the packet result (decided to wait), labels on the toolbar icons, a pass over the simulator, phone layout and keyboard use, and an optional collapsible sidebar.
