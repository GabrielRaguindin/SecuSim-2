import { formatClock } from '@/lib/format.js';

const R = 24;
const C = 2 * Math.PI * R;

export default function TimerRing({ remaining, total, state }) {
  const fraction = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const tone = state !== 'running' ? 'idle' : remaining <= 15 ? 'danger' : remaining <= 60 ? 'warn' : 'ok';
  return (
    <div className="sx-timer" data-tone={tone} role="timer" aria-label={`Time left: ${formatClock(remaining)}`}>
      <svg viewBox="0 0 56 56" width="56" height="56" aria-hidden="true">
        <circle className="sx-timer__track" cx="28" cy="28" r={R} />
        <circle
          className="sx-timer__bar"
          cx="28"
          cy="28"
          r={R}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - fraction)}
          transform="rotate(-90 28 28)"
        />
      </svg>
      <span className="sx-timer__text sx-tnum">{formatClock(remaining)}</span>
    </div>
  );
}
