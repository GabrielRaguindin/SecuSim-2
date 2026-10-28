'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import ScenarioArt from './ScenarioArt';
import Icon from '@/components/ui/Icon';
import { ToastRegion, useToast } from '@/components/ui/Toast';
import { downloadText } from '@/components/download.js';
import { SCENARIOS } from '@/lib/scenarios.js';
import { parseScenarioFile, scenarioFileName, serializeScenario, totalDevices } from '@/lib/customScenarios.js';
import {
  deleteCustomScenario, duplicateCustomScenario, loadCustomScenarios, loadResults, saveCustomScenario,
} from '@/lib/storage.js';
import { formatClock, formatDuration, pluralize } from '@/lib/format.js';

const LAYOUT_WORDS = { any: 'Any layout', connected: 'Connected', ring: 'Ring', star: 'Star', mesh: 'Mesh' };

export default function ScenarioList() {
  const [results, setResults] = useState([]);
  const [custom, setCustom] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const toast = useToast();
  const fileInput = useRef(null);

  const refresh = () => {
    setResults(loadResults());
    setCustom(loadCustomScenarios());
  };
  useEffect(() => {
    setResults(loadResults());
    setCustom(loadCustomScenarios());
  }, []);

  const bestFor = (id) => {
    const passes = results.filter((r) => r.scenarioId === id && r.passed);
    return passes.length ? Math.min(...passes.map((r) => r.secondsUsed)) : null;
  };

  const duplicate = (s) => {
    const result = duplicateCustomScenario(s.id);
    refresh();
    toast.show(result.ok ? `Duplicated as “${result.spec.title}”.` : result.error);
  };

  const remove = (s) => {
    deleteCustomScenario(s.id);
    setConfirming(null);
    refresh();
    toast.show(`Deleted “${s.title}”.`);
  };

  const importFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const parsed = parseScenarioFile(await file.text());
    if (!parsed.ok) {
      toast.show(parsed.error);
      return;
    }
    const saved = saveCustomScenario(parsed.spec);
    refresh();
    toast.show(saved.ok ? `Imported “${saved.spec.title}”.` : saved.error);
  };

  return (
    <div className="sx-scenario-sections">
      <section aria-labelledby="built-in">
        <h2 id="built-in" className="sx-title-2 sx-section-title">Built in</h2>
        <ul className="sx-scenarios">
          {SCENARIOS.map((s) => {
            const best = bestFor(s.id);
            return (
              <li key={s.id}>
                <Link href={`/simulator/${s.id}`} className="sx-scenario">
                  <div className="sx-scenario__art" aria-hidden="true">
                    <ScenarioArt kind={s.topology} />
                  </div>
                  <div className="sx-scenario__body">
                    <div className="sx-scenario__meta">
                      <span className="sx-pill">Scenario {s.number}</span>
                      <span className="sx-pill"><Icon name="clock" size={14} /> {formatClock(s.timeLimit)}</span>
                      {best !== null && <span className="sx-pill sx-pill--ok"><Icon name="check" size={14} strokeWidth={2.6} /> Done in {formatDuration(best)}</span>}
                    </div>
                    <h3 className="sx-title-2">{s.title}</h3>
                    <p className="sx-body">{s.story}</p>
                  </div>
                  <span className="sx-scenario__go" aria-hidden="true"><Icon name="chevronRight" size={22} /></span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="yours">
        <div className="sx-section-head">
          <div>
            <h2 id="yours" className="sx-title-2">Your scenarios</h2>
            <p className="sx-body">Write your own brief and requirements, then simulate it like any other. They stay in this browser.</p>
          </div>
          <div className="sx-section-actions">
            <input ref={fileInput} type="file" accept="application/json,.json" className="sx-visually-hidden" onChange={importFile} aria-label="Import a scenario file" tabIndex={-1} />
            <button type="button" className="sx-btn" onClick={() => fileInput.current?.click()}>
              <Icon name="download" size={18} /> Import
            </button>
            <Link href="/simulator/new" className="sx-btn sx-btn--primary">
              <Icon name="plus" size={18} strokeWidth={2.2} /> New scenario
            </Link>
          </div>
        </div>

        {custom !== null && custom.length === 0 && (
          <div className="sx-emptycard">
            <span className="sx-empty__icon"><Icon name="plus" size={26} /></span>
            <div>
              <h3 className="sx-title-3">Nothing here yet</h3>
              <p className="sx-body">Choose the devices, the layout and the policies, and SecuSim checks the attempt for you. You can also import a scenario someone shared.</p>
            </div>
          </div>
        )}

        {custom && custom.length > 0 && (
          <ul className="sx-scenarios">
            {custom.map((s) => {
              const best = bestFor(s.id);
              return (
                <li key={s.id}>
                  <article className="sx-scenario sx-scenario--custom">
                    <Link href={`/simulator/${s.id}`} className="sx-scenario__main">
                      <div className="sx-scenario__art" aria-hidden="true">
                        <ScenarioArt kind={s.layout.kind} devices={s.devices} />
                      </div>
                      <div className="sx-scenario__body">
                        <div className="sx-scenario__meta">
                          <span className="sx-pill sx-pill--accent">Custom</span>
                          <span className="sx-pill"><Icon name="clock" size={14} /> {formatClock(s.timeLimit)}</span>
                          <span className="sx-pill">{pluralize(totalDevices(s), 'device')}</span>
                          <span className="sx-pill">{LAYOUT_WORDS[s.layout.kind]}</span>
                          {best !== null && <span className="sx-pill sx-pill--ok"><Icon name="check" size={14} strokeWidth={2.6} /> Done in {formatDuration(best)}</span>}
                        </div>
                        <h3 className="sx-title-2">{s.title}</h3>
                        <p className="sx-body">{s.story || s.goal || 'Build the network to the brief.'}</p>
                      </div>
                    </Link>
                    <div className="sx-scenario__actions">
                      <Link href={`/simulator/${s.id}`} className="sx-btn sx-btn--sm sx-btn--primary">
                        <Icon name="play" size={14} strokeWidth={2.2} /> Start
                      </Link>
                      <Link href={`/simulator/edit/${s.id}`} className="sx-btn sx-btn--sm">Edit</Link>
                      <button type="button" className="sx-btn sx-btn--sm" onClick={() => duplicate(s)}>Duplicate</button>
                      <button type="button" className="sx-btn sx-btn--sm" onClick={() => downloadText(scenarioFileName(s), serializeScenario(s))}>Export</button>
                      {confirming === s.id ? (
                        <span className="sx-scenario__confirm">
                          <button type="button" className="sx-btn sx-btn--sm sx-btn--danger" onClick={() => remove(s)}>Delete for good</button>
                          <button type="button" className="sx-btn sx-btn--sm sx-btn--plain" onClick={() => setConfirming(null)}>Keep</button>
                        </span>
                      ) : (
                        <button type="button" className="sx-iconbtn" aria-label={`Delete ${s.title}`} onClick={() => setConfirming(s.id)}>
                          <Icon name="trash" size={18} />
                        </button>
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <ToastRegion toast={toast.toast} onHide={toast.hide} />
    </div>
  );
}
