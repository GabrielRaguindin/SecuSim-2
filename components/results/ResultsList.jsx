'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import CheckList from '@/components/ui/CheckList';
import Icon from '@/components/ui/Icon';
import { ToastRegion, useToast } from '@/components/ui/Toast';
import { deleteResult, loadResults, restoreResult } from '@/lib/storage.js';
import { downloadResultPdf } from '@/lib/pdf.js';
import { formatDate, formatDuration } from '@/lib/format.js';

export default function ResultsList() {
  const [results, setResults] = useState(null);
  const toast = useToast();
  const busy = useRef(false);

  useEffect(() => setResults(loadResults()), []);

  const remove = (record) => {
    deleteResult(record.id);
    setResults(loadResults());
    toast.show('Result deleted.', {
      label: 'Undo',
      onClick: () => {
        restoreResult(record);
        setResults(loadResults());
      },
    });
  };

  const download = async (record) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await downloadResultPdf(record);
    } catch {
      toast.show('Couldn’t make the PDF. Try again.');
    } finally {
      busy.current = false;
    }
  };

  if (results === null) return <p className="sx-body" aria-busy="true">Loading…</p>;

  if (results.length === 0) {
    return (
      <div className="sx-empty">
        <span className="sx-empty__icon"><Icon name="list" size={28} /></span>
        <h2 className="sx-title-2">No results yet</h2>
        <p className="sx-body">Finish a scenario and save your result to see it here. Results stay in this browser for 30 days.</p>
        <Link href="/simulator" className="sx-btn sx-btn--primary">Choose a scenario</Link>
      </div>
    );
  }

  return (
    <>
      <ul className="sx-results">
        {results.map((r) => (
          <li key={r.id}>
            <details className="sx-result">
              <summary className="sx-result__summary">
                <div className="sx-result__main">
                  <p className="sx-caption">{r.scenarioNumber ? `Scenario ${r.scenarioNumber}` : 'Custom scenario'}</p>
                  <h2 className="sx-title-3">{r.scenarioTitle}</h2>
                  <p className="sx-caption">
                    {formatDate(r.createdAt)}. {formatDuration(r.secondsUsed)} of {formatDuration(r.timeLimit)}
                    {r.finishedBy === 'timeout' ? ', time ran out' : ''}.
                  </p>
                </div>
                <span className={`sx-pill ${r.passed ? 'sx-pill--ok' : 'sx-pill--danger'}`}>
                  {r.passed ? 'Passed' : `${r.met} of ${r.total} met`}
                </span>
                <span className="sx-result__chevron" aria-hidden="true"><Icon name="chevronDown" size={20} /></span>
              </summary>
              <div className="sx-result__body">
                <CheckList checks={r.checks} />
                <div className="sx-result__actions">
                  <button type="button" className="sx-btn sx-btn--sm" onClick={() => download(r)}>
                    <Icon name="download" size={16} /> Download PDF
                  </button>
                  <button type="button" className="sx-btn sx-btn--sm sx-btn--danger" onClick={() => remove(r)}>
                    <Icon name="trash" size={16} /> Delete
                  </button>
                </div>
              </div>
            </details>
          </li>
        ))}
      </ul>
      <ToastRegion toast={toast.toast} onHide={toast.hide} />
    </>
  );
}
