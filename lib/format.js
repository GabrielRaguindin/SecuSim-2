/** Small formatting helpers shared by the UI and the scenario checks. */

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m === 0) return `${rest} sec`;
  return rest === 0 ? `${m} min` : `${m} min ${rest} sec`;
}

export function formatDate(timestamp) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
  } catch {
    return new Date(timestamp).toISOString();
  }
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "a", "a and b", "a, b and c", "a, b, c and 2 more" */
export function joinList(items, max = 3) {
  const list = [...items];
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  if (list.length <= max) return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
  return `${list.slice(0, max).join(', ')} and ${list.length - max} more`;
}
