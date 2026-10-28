'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import TopologyDiagram from './TopologyDiagram';
import Icon from '@/components/ui/Icon';
import { layoutTopology, packetRoute } from '@/lib/layouts.js';

const STEP_MS = 650;

const MIDDLE_TEXT = {
  ring: 'Passed on to the next device.',
  star: 'The center forwards it.',
  mesh: 'Passed along.',
};

export default function TopologyLesson({ lesson }) {
  const { kind, title, summary, body, facts, scenarioId, scenarioNumber } = lesson;
  const { nodes } = layoutTopology(kind);
  const route = packetRoute(kind);
  const [step, setStep] = useState(-1);
  const timers = useRef([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const send = () => {
    clearTimers();
    setStep(0);
    route.slice(1).forEach((_, i) => {
      timers.current.push(window.setTimeout(() => setStep(i + 1), STEP_MS * (i + 1)));
    });
    timers.current.push(window.setTimeout(() => setStep(-1), STEP_MS * route.length + 900));
  };

  const running = step >= 0;
  const litEdges = [];
  for (let i = 0; i < step; i += 1) litEdges.push(`${Math.min(route[i], route[i + 1])}-${Math.max(route[i], route[i + 1])}`);
  const current = running ? nodes[route[step]] : null;

  let status = 'Press the button to send a packet across.';
  if (running) status = step === 0 ? 'Sent.' : step === route.length - 1 ? 'Delivered.' : MIDDLE_TEXT[kind];

  return (
    <section className="sx-lesson" id={kind} aria-labelledby={`${kind}-title`}>
      <div className="sx-lesson__text">
        <h2 id={`${kind}-title`} className="sx-title-1">{title}</h2>
        <p className="sx-lead">{summary}</p>
        <p className="sx-body">{body}</p>
        <dl className="sx-facts">
          {facts.map(([term, detail]) => (
            <div key={term} className="sx-facts__row">
              <dt className="sx-callout">{term}</dt>
              <dd className="sx-callout sx-muted">{detail}</dd>
            </div>
          ))}
        </dl>
        <Link href={`/simulator/${scenarioId}`} className="sx-btn sx-btn--tint">
          Practice in scenario {scenarioNumber}
          <Icon name="chevronRight" size={18} />
        </Link>
      </div>

      <figure className="sx-lesson__figure">
        <TopologyDiagram kind={kind} active={current ? current.id : null} litEdges={litEdges} packet={current} label={`${title} topology`} />
        <figcaption className="sx-lesson__caption">
          <button type="button" className="sx-btn sx-btn--sm" onClick={send} disabled={running}>
            <Icon name="send" size={16} /> Send a packet
          </button>
          <span className="sx-caption" role="status">{status}</span>
        </figcaption>
      </figure>
    </section>
  );
}
