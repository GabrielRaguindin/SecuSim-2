# The Switch (Patch 2.4.1)

A sixth device on the dock: the **Switch**. It is a modern, managed switch, so unlike a hub it **can hold an IP address and security policies**.

This patch adds the device and nothing else from Patch 2.4. Hub broadcasting, targeted delivery, ping answers and filtering at intermediate devices are separate, later pieces. Today a packet crosses a switch exactly as it crosses a hub: it passes through.

## What a Switch is in SecuSim

| | Hub | Switch |
|---|---|---|
| Layer | 1 (physical) | 2 (data link), managed |
| IP address | No | Yes |
| Security policies | No | Yes |
| Can send or receive a packet | No | Yes (a managed switch can be pinged and administered) |
| Cabling group | receives on pins 1 and 2 | receives on pins 1 and 2 |

The Learn page for addressing says a basic *unmanaged* switch has no address; the Switch in SecuSim is the managed kind.

## Cabling

A switch port behaves like a hub port, so it joins the "receive" group in `lib/cabling.js`.

| Link | Cable |
|---|---|
| PC, Server or Router to Switch | Straight-through |
| Switch to Switch | Crossover |
| Switch to Hub | Crossover |
| Switch to Modem | Crossover |

`requiredCable` is still the one place this rule lives, so the canvas, inspector, grading, the custom scenario solver and the Learn table all pick it up. The Learn cabling table is now 6 by 6.

## Where it appears

- **Dock and canvas:** between Router and Hub, with a rose tile and a two-way arrow glyph (`lib/devices.js`, `DeviceGlyph.jsx`, `tokens.css`, `workbench.css`).
- **Inspector:** the full inspector, with an IP field, address class picker and every policy switch.
- **Packets:** a switch can be the sender or receiver, and it is listed in the From and To menus. A packet passing through reads "Switch 1 forwards it on."
- **Custom scenarios:** the builder shows a Switch row, rules can target switches, and a switch can be the center of a star. Scenarios saved before this patch load with no switches, so they behave as before.
- **Built-in scenarios:** unchanged. None of them places a switch.
- **Small screens:** at 400px and below the dock tiles are narrower so all six fit.

## Tests

`tests/switch.test.js` (10 tests): the device and its labels; addresses and policies, including a mixed selection that skips a hub; saved networks; the cable rules in both directions; packets through, to and from a switch; grading and the reference solution; the custom scenario builder rules. The browser checks (15) cover the dock, the inspector, cables, a ping to a switch, the Learn tables, the builder and a 360px screen.

## Not changed

A switch still just passes a packet along: it does not yet deliver only to the intended device, and filtering still applies only at the two endpoints. Hub broadcasting is covered in `docs/hub-broadcast.md`.
