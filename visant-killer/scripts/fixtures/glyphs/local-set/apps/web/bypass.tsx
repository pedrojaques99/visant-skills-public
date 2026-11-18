/*
 * Never imports the repo's Icon, and draws a glyph inline. The repo has its own set,
 * so this is a bypass. EXPECTED hand-drawn-icon: 1.
 */
export function Fechar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
