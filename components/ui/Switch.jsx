'use client';

/** checked: true, false, or 'mixed' (some of the selected devices have it). */
export default function Switch({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="sx-switch"
      onClick={() => onChange(checked !== true)}
    />
  );
}
