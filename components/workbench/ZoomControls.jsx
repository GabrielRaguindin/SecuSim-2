'use client';

import Icon from '@/components/ui/Icon';
import { MAX_ZOOM, MIN_ZOOM } from '@/lib/view.js';

/** Zoom out, the zoom level (press it to go back to actual size), zoom in, and Fit, which shows every device. */
export default function ZoomControls({ view, onZoomIn, onZoomOut, onActualSize, onFit, hasNodes }) {
  const percent = Math.round(view.k * 100);
  return (
    <div className="sx-glass sx-zoom" role="group" aria-label="Zoom">
      <button type="button" className="sx-iconbtn" onClick={onZoomOut} disabled={view.k <= MIN_ZOOM} aria-label="Zoom out" title="Zoom out (-)">
        <Icon name="minus" />
      </button>
      <button type="button" className="sx-zoom__level sx-tnum" onClick={onActualSize} aria-label={`Zoom ${percent} percent. Press for actual size`} title="Actual size (1)">
        {percent}%
      </button>
      <button type="button" className="sx-iconbtn" onClick={onZoomIn} disabled={view.k >= MAX_ZOOM} aria-label="Zoom in" title="Zoom in (+)">
        <Icon name="plus" />
      </button>
      <span className="sx-toolbar__divider" aria-hidden="true" />
      <button type="button" className="sx-zoom__fit" onClick={onFit} disabled={!hasNodes} title="Show every device (0)">
        <Icon name="fit" size={16} />
        <span>Fit</span>
      </button>
    </div>
  );
}
