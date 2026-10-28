/**
 * A tiny spring integrator and momentum projection, used to settle a dragged
 * device the way a scroll view settles: it keeps the speed of the gesture,
 * glides a little further, then comes to rest.
 */

/** Where a thrown object would come to rest. `rate` is the per-millisecond decay (0.99 is snappy, 0.998 floats). */
export function projectRelease(position, velocityPerSecond, rate = 0.99) {
  const perMs = velocityPerSecond / 1000;
  return position + (perMs * rate) / (1 - rate);
}

export const SPRING_DEFAULTS = { stiffness: 260, damping: 28, mass: 1 };

/** Advance one axis by `dt` seconds. Sub-steps keep it stable on slow frames. */
export function stepSpring(state, target, dt, config = SPRING_DEFAULTS) {
  const { stiffness, damping, mass } = { ...SPRING_DEFAULTS, ...config };
  let { x, v } = state;
  const steps = Math.max(1, Math.ceil(dt / 0.004));
  const h = dt / steps;
  for (let i = 0; i < steps; i += 1) {
    const force = -stiffness * (x - target) - damping * v;
    v += (force / mass) * h;
    x += v * h;
  }
  return { x, v };
}

export function isSettled(state, target, positionEpsilon = 0.4, velocityEpsilon = 4) {
  return Math.abs(state.x - target) < positionEpsilon && Math.abs(state.v) < velocityEpsilon;
}

/** Average velocity (units per second) over recent pointer samples: [{t, x, y}] with t in ms. */
export function velocityFromSamples(samples, windowMs = 90) {
  if (samples.length < 2) return { x: 0, y: 0 };
  const last = samples[samples.length - 1];
  let first = samples[0];
  for (const s of samples) {
    if (last.t - s.t <= windowMs) {
      first = s;
      break;
    }
  }
  const dt = (last.t - first.t) / 1000;
  if (dt <= 0) return { x: 0, y: 0 };
  return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
}
