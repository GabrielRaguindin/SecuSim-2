'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import Workbench from '@/components/workbench/Workbench';
import Sheet from '@/components/ui/Sheet';
import Icon from '@/components/ui/Icon';
import TimerRing from './TimerRing';
import ResultSheet from './ResultSheet';
import { useNetwork } from '@/components/hooks.js';
import { useToast } from '@/components/ui/Toast';
import { DEVICE_ORDER } from '@/lib/devices.js';
import { emptyDoc } from '@/lib/networkReducer.js';
import { evaluateScenario, getScenario } from '@/lib/scenarios.js';
import { saveResult } from '@/lib/storage.js';
import { formatClock } from '@/lib/format.js';

function Brief({ open, scenario, mode, onStart, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title={scenario.title} dismissible={mode === 'view'}>
      <p className="sx-pill sx-pill--accent">Scenario {scenario.number}</p>
      <p className="sx-body sx-brief__story">{scenario.story}</p>
      <p className="sx-callout sx-brief__goal"><strong>Goal.</strong> {scenario.goal}</p>

      <h3 className="sx-title-3 sx-brief__heading">Requirements</h3>
      <ol className="sx-brief__list">
        {scenario.checks.map((c, i) => (
          <li key={c.id}>
            <span className="sx-brief__num sx-tnum">{i + 1}</span>
            <span className="sx-callout">{c.label}</span>
          </li>
        ))}
      </ol>

      <p className="sx-caption sx-brief__note">
        You have {formatClock(scenario.timeLimit)} once you start. The clock keeps running if you read this again.
        <span className="sx-only-narrow"> This works best on a larger screen.</span>
      </p>

      <div className="sx-sheet__actions">
        {mode === 'start' ? (
          <>
            <Link href="/simulator" className="sx-btn">Back</Link>
            <button type="button" className="sx-btn sx-btn--primary" onClick={onStart} data-autofocus="">
              <Icon name="play" size={16} strokeWidth={2.2} /> Start
            </button>
          </>
        ) : (
          <button type="button" className="sx-btn sx-btn--primary" onClick={onClose} data-autofocus="">Back to the canvas</button>
        )}
      </div>
    </Sheet>
  );
}

export default function Simulator({ scenarioId }) {
  const scenario = getScenario(scenarioId);
  const net = useNetwork();
  const toast = useToast();
  const docRef = useRef(net.doc);
  docRef.current = net.doc;

  const [phase, setPhase] = useState('brief'); // brief | running | finished
  const [remaining, setRemaining] = useState(scenario.timeLimit);
  const endAt = useRef(0);
  const [briefView, setBriefView] = useState(false);
  const [check, setCheck] = useState(null);
  const [checkOpen, setCheckOpen] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [savedId, setSavedId] = useState(null);

  const finish = useCallback(
    (by) => {
      const elapsed = Math.round(scenario.timeLimit - (endAt.current - Date.now()) / 1000);
      const secondsUsed = by === 'timeout' ? scenario.timeLimit : Math.max(0, Math.min(scenario.timeLimit, elapsed));
      const result = evaluateScenario(scenario, docRef.current);
      setOutcome({ result, secondsUsed, finishedBy: by });
      setCheck({ result, doc: docRef.current });
      setPhase('finished');
      setCheckOpen(false);
      setOutcomeOpen(true);
    },
    [scenario]
  );
  const finishRef = useRef(finish);
  finishRef.current = finish;

  /* The clock is derived from a deadline, so it stays right even if the tab is throttled. */
  useEffect(() => {
    if (phase !== 'running') return undefined;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(id);
        finishRef.current('timeout');
      }
    };
    const id = window.setInterval(tick, 250);
    tick();
    return () => window.clearInterval(id);
  }, [phase]);

  const start = () => {
    endAt.current = Date.now() + scenario.timeLimit * 1000;
    setRemaining(scenario.timeLimit);
    setPhase('running');
  };

  const runCheck = () => {
    setCheck({ result: evaluateScenario(scenario, docRef.current), doc: docRef.current });
    setCheckOpen(true);
  };

  const retry = () => {
    net.dispatch({ type: 'load', doc: emptyDoc() });
    setPhase('brief');
    setRemaining(scenario.timeLimit);
    setCheck(null);
    setOutcome(null);
    setOutcomeOpen(false);
    setSavedId(null);
  };

  const save = () => {
    if (!outcome || savedId) return;
    const { result, secondsUsed, finishedBy } = outcome;
    const record = saveResult({
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      scenarioNumber: scenario.number,
      passed: result.passed,
      met: result.met,
      total: result.total,
      checks: result.checks,
      secondsUsed,
      timeLimit: scenario.timeLimit,
      finishedBy,
    });
    if (record) {
      setSavedId(record.id);
      toast.show('Result saved.');
    } else {
      toast.show('Couldn’t save. Allow this site to use storage and try again.');
    }
  };

  const edited = check && check.doc !== net.doc;
  const statusFor = (id) => check?.result.checks.find((c) => c.id === id)?.ok;

  const session = (
    <section className="sx-panel sx-session" aria-label="Session">
      <div className="sx-session__top">
        <TimerRing remaining={remaining} total={scenario.timeLimit} state={phase} />
        <div>
          <p className="sx-caption">Scenario {scenario.number}</p>
          <h2 className="sx-title-3">{scenario.short}</h2>
        </div>
      </div>

      {phase === 'running' && (
        <div className="sx-session__actions">
          <button type="button" className="sx-btn sx-btn--primary sx-btn--block" onClick={runCheck}>
            <Icon name="check" size={18} strokeWidth={2.4} /> Check my work
          </button>
        </div>
      )}
      {phase === 'finished' && (
        <div className="sx-session__actions">
          <button type="button" className="sx-btn sx-btn--tint sx-btn--block" onClick={() => setOutcomeOpen(true)}>View result</button>
          <button type="button" className="sx-btn sx-btn--block" onClick={retry}>Try again</button>
        </div>
      )}

      <h3 className="sx-callout sx-session__heading">Requirements</h3>
      <ol className="sx-reqs">
        {scenario.checks.map((c) => {
          const ok = statusFor(c.id);
          return (
            <li key={c.id} className="sx-req" data-state={ok === undefined ? 'unchecked' : ok ? 'ok' : 'fail'} data-stale={Boolean(edited)}>
              <span className="sx-req__mark" aria-hidden="true">
                {ok === true && <Icon name="check" size={12} strokeWidth={3} />}
                {ok === false && <Icon name="x" size={12} strokeWidth={3} />}
              </span>
              <span className="sx-caption sx-req__text">
                <span className="sx-visually-hidden">{ok === undefined ? 'Not checked yet: ' : ok ? 'Met: ' : 'Not met: '}</span>
                {c.label}
              </span>
            </li>
          );
        })}
      </ol>
      {edited && phase === 'running' && <p className="sx-caption">You’ve made changes since the last check.</p>}
      {phase === 'running' && (
        <button type="button" className="sx-btn sx-btn--plain sx-btn--sm" onClick={() => setBriefView(true)}>
          <Icon name="info" size={16} /> Read the brief
        </button>
      )}
    </section>
  );

  return (
    <>
      <Workbench net={net} toast={toast} palette={DEVICE_ORDER} disabled={phase !== 'running'} sidebarTop={session} />

      <Brief
        open={phase === 'brief' || briefView}
        scenario={scenario}
        mode={phase === 'brief' ? 'start' : 'view'}
        onStart={start}
        onClose={() => setBriefView(false)}
      />

      <ResultSheet
        kind="check"
        open={checkOpen}
        onClose={() => setCheckOpen(false)}
        scenario={scenario}
        result={check?.result}
        onKeepWorking={() => setCheckOpen(false)}
        onFinish={() => finish('manual')}
      />

      <ResultSheet
        kind="final"
        open={outcomeOpen}
        onClose={() => setOutcomeOpen(false)}
        scenario={scenario}
        result={outcome?.result}
        outcome={outcome}
        saved={Boolean(savedId)}
        onSave={save}
        onRetry={retry}
      />
    </>
  );
}
