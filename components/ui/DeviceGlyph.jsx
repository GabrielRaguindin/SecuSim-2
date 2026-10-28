/* Device symbols on a 24px grid. Used inside the canvas (SVG) and in the dock (HTML). */

export function GlyphPaths({ type }) {
  switch (type) {
    case 'router':
      return (
        <>
          <rect x="3" y="13" width="18" height="7" rx="2" />
          <path d="M7 13V8M17 13V8M7 5.5h.01M17 5.5h.01M7.5 16.5h.01M11 16.5h.01" />
        </>
      );
    case 'hub':
      return (
        <>
          <rect x="3" y="8" width="18" height="10" rx="2" />
          <path d="M7 12v2M10.33 12v2M13.67 12v2M17 12v2" />
        </>
      );
    case 'pc':
      return (
        <>
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </>
      );
    case 'modem':
      return (
        <>
          <rect x="3" y="13" width="18" height="7" rx="2" />
          <path d="M7.5 16.5h.01M11 16.5h.01" />
          <path d="M7 9.5a7 7 0 0 1 10 0" />
          <path d="M9.8 11.9a3.2 3.2 0 0 1 4.4 0" />
        </>
      );
    default:
      return <circle cx="12" cy="12" r="8" />;
  }
}

export default function DeviceGlyph({ type, size = 24, strokeWidth = 1.7 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <GlyphPaths type={type} />
    </svg>
  );
}
