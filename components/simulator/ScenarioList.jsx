'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import TopologyDiagram from '@/components/learn/TopologyDiagram';
import Icon from '@/components/ui/Icon';
import { SCENARIOS } from '@/lib/scenarios.js';
import { loadResults } from '@/lib/storage.js';
import { formatClock, formatDuration } from '@/lib/format.js';

export default function ScenarioList() {
  const [results, setResults] = useState([]);
  useEffect(() => setResults(loadResults()), []);

  return (
    <ul className="sx-scenarios">
      {SCENARIOS.map((s) => {
        const passes = results.filter((r) => r.scenarioId === s.id && r.passed);
        const best = passes.length ? Math.min(...passes.map((r) => r.secondsUsed)) : null;
        return (
          <li key={s.id}>
            <Link href={`/simulator/${s.id}`} className="sx-scenario">
              <div className="sx-scenario__art" aria-hidden="true">
                <TopologyDiagram kind={s.topology} compact />
              </div>
              <div className="sx-scenario__body">
                <div className="sx-scenario__meta">
                  <span className="sx-pill">Scenario {s.number}</span>
                  <span className="sx-pill"><Icon name="clock" size={14} /> {formatClock(s.timeLimit)}</span>
                  {best !== null && <span className="sx-pill sx-pill--ok"><Icon name="check" size={14} strokeWidth={2.6} /> Done in {formatDuration(best)}</span>}
                </div>
                <h2 className="sx-title-2">{s.title}</h2>
                <p className="sx-body">{s.story}</p>
              </div>
              <span className="sx-scenario__go" aria-hidden="true"><Icon name="chevronRight" size={22} /></span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
