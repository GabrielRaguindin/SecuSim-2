'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Simulator from './Simulator';
import { resolveScenario } from '@/lib/resolveScenario.js';
import { getScenario } from '@/lib/scenarios.js';

/**
 * Finds the scenario for an id and runs it. Built-in scenarios resolve on the first render.
 * Custom ones live in this browser's storage, so they resolve right after the page loads.
 */
export default function ScenarioRunner({ scenarioId }) {
  const [found, setFound] = useState(() => {
    const builtIn = getScenario(scenarioId);
    return builtIn ? { scenario: builtIn } : null;
  });

  useEffect(() => {
    setFound((current) => (current?.scenario?.id === scenarioId ? current : { scenario: resolveScenario(scenarioId) }));
  }, [scenarioId]);

  if (!found) {
    return (
      <div className="sx-page">
        <p className="sx-body" aria-busy="true">Loading…</p>
      </div>
    );
  }

  if (!found.scenario) {
    return (
      <div className="sx-page">
        <div className="sx-empty">
          <h1 className="sx-title-1">That scenario isn’t here</h1>
          <p className="sx-body">Custom scenarios are kept in the browser that made them. It may have been deleted, or it was made somewhere else.</p>
          <Link href="/simulator" className="sx-btn sx-btn--primary">All scenarios</Link>
        </div>
      </div>
    );
  }

  return <Simulator key={found.scenario.id} scenario={found.scenario} />;
}
