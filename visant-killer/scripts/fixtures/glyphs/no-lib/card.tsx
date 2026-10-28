/*
 * The same three glyphs, in a repo with NO icon library in package.json. The
 * fix is adopting a library, not editing each SVG, so the file gets ONE finding
 * with that hint. EXPECTED hand-drawn-icon: 1.
 */
export function Cartao() {
  return (
    <div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="m9 18 6-6-6-6" />
      </svg>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </div>
  );
}
