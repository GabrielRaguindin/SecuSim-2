'use client';

export default function Error({ reset }) {
  return (
    <div className="sx-page">
      <div className="sx-empty">
        <h1 className="sx-title-1">Something went wrong</h1>
        <p className="sx-body">Nothing you built was sent anywhere. Try again, and if it keeps happening, reload the page.</p>
        <button type="button" className="sx-btn sx-btn--primary" onClick={() => reset()}>Try again</button>
      </div>
    </div>
  );
}
