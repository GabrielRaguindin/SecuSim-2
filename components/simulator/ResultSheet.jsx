'use client';

import Link from 'next/link';
import Sheet from '@/components/ui/Sheet';
import CheckList from '@/components/ui/CheckList';
import Icon from '@/components/ui/Icon';
import { formatDuration } from '@/lib/format.js';

function headline(kind, result, outcome, scenario) {
  if (kind === 'check') {
    return result.passed
      ? { title: 'Everything checks out', text: `All ${result.total} requirements are met. Finish the attempt to lock in your time.` }
      : { title: `${result.met} of ${result.total} requirements met`, text: 'Keep going. Each item below says what to do next.' };
  }
  if (outcome.finishedBy === 'timeout') {
    return { title: 'Time’s up', text: `You met ${result.met} of ${result.total} requirements.` };
  }
  if (result.passed) {
    return { title: 'Network secured', text: `Finished in ${formatDuration(outcome.secondsUsed)} of the ${formatDuration(scenario.timeLimit)} allowed.` };
  }
  return { title: 'Attempt finished', text: `You met ${result.met} of ${result.total} requirements.` };
}

export default function ResultSheet({ open, onClose, scenario, kind, result, outcome, saved, onSave, onKeepWorking, onFinish, onRetry }) {
  const shown = result ?? { checks: [], met: 0, total: 0, passed: false };
  const copy = result ? headline(kind, shown, outcome ?? {}, scenario) : { title: '', text: '' };

  return (
    <Sheet open={open} onClose={onClose} title={copy.title}>
      <p className="sx-body">{copy.text}</p>
      <CheckList checks={shown.checks} />

      {kind === 'check' ? (
        <div className="sx-sheet__actions">
          <button type="button" className={`sx-btn ${shown.passed ? '' : 'sx-btn--primary'}`} onClick={onKeepWorking} data-autofocus={shown.passed ? undefined : ''}>
            Keep working
          </button>
          <button type="button" className={`sx-btn ${shown.passed ? 'sx-btn--primary' : ''}`} onClick={onFinish} data-autofocus={shown.passed ? '' : undefined}>
            Finish attempt
          </button>
        </div>
      ) : (
        <div className="sx-sheet__actions">
          <Link href="/simulator" className="sx-btn">All scenarios</Link>
          <button type="button" className="sx-btn" onClick={onRetry}>Try again</button>
          <button type="button" className="sx-btn sx-btn--primary" onClick={onSave} disabled={saved} data-autofocus="">
            {saved ? (<><Icon name="check" size={18} strokeWidth={2.4} /> Saved</>) : 'Save result'}
          </button>
        </div>
      )}
    </Sheet>
  );
}
