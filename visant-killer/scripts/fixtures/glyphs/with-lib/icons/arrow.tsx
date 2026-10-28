/* A file inside an `icons/` folder IS the repo's icon set: the right place for
 * an inline SVG. EXPECTED hand-drawn-icon: zero. */
export function Seta({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
