/**
 * First-use hints on the canvas. They replace the tips the old sidebar used to show, one at a time,
 * and each is dismissed for good once the learner has done the thing or pressed "Got it".
 */

export const HINTS = [
  { id: 'edit', text: 'Double-click or double-tap a device to name it, give it an address and set its policies.', when: (doc) => doc.nodes.length >= 1 },
  { id: 'link', text: 'Choose the Link tool (L), then drag from one device to another to cable them.', when: (doc) => doc.nodes.length >= 2 && doc.edges.length === 0 },
  { id: 'cable', text: 'Double-click a link to see its cable, change it, or remove it.', when: (doc) => doc.edges.length >= 1 },
  { id: 'multi', text: 'Shift-click several devices, or use Select all, then press Edit to set a policy on all of them at once.', when: (doc) => doc.nodes.length >= 3 },
];

export const HINT_IDS = HINTS.map((h) => h.id);

/** The hint to show now, or null: the first one whose moment has come and that hasn't been dismissed. */
export function nextHint(doc, dismissed = []) {
  return HINTS.find((h) => !dismissed.includes(h.id) && h.when(doc)) ?? null;
}
