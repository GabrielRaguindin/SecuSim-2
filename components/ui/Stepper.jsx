'use client';

import Icon from './Icon';

/** A number you nudge up and down. Buttons stop at the limits, so the value is always valid. */
export default function Stepper({ value, min = 0, max = 99, onChange, label, format }) {
  return (
    <div className="sx-stepper" role="group" aria-label={label}>
      <button type="button" className="sx-iconbtn" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <Icon name="minus" size={18} />
      </button>
      <output className="sx-stepper__value sx-tnum" aria-live="polite">{format ? format(value) : value}</output>
      <button type="button" className="sx-iconbtn" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        <Icon name="plus" size={18} />
      </button>
    </div>
  );
}
