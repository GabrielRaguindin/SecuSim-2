/**
 * The rules behind the device editor and the link popover. Nothing here touches React or the DOM.
 */

import { POLICY_CATEGORIES } from './policies.js';
import { canHavePolicies } from './devices.js';
import { describeIp } from './ip.js';

/** The selected devices that can hold a policy. A hub can't, so it is left out of every policy count. */
export function holderIds(doc, ids) {
  return ids.filter((id) => {
    const node = doc.nodes.find((n) => n.id === id);
    return node && canHavePolicies(node.type);
  });
}

/** true when every device has the policy, false when none does, 'mixed' when only some do. */
export function policyState(doc, ids, policyId) {
  const holders = holderIds(doc, ids);
  if (holders.length === 0) return false;
  const on = holders.filter((id) => (doc.policies[id] ?? []).includes(policyId)).length;
  return on === holders.length ? true : on === 0 ? false : 'mixed';
}

/** One row per category: how many of its policies are on (for some or all of the devices). */
export function categoryCounts(doc, ids) {
  return POLICY_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    total: category.policies.length,
    on: category.policies.filter((p) => policyState(doc, ids, p.id) !== false).length,
  }));
}

/** "Class C, private, 192.168.1.0/24", or null when the address isn't a class A, B or C address. */
export function ipSummary(ip) {
  const info = describeIp(ip);
  return info ? `${info.label}, ${info.private ? 'private' : 'public'}, ${info.network}/${info.prefixLength}` : null;
}
