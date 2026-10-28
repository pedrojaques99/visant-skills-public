/*
 * hand-drawn-icon, calibrated on third-party repos (2026-10-28). This folder's
 * package.json has lucide-react, so every hand-drawn UI glyph is a finding that
 * names the library to import from.
 *
 * EXPECTED hand-drawn-icon: 3 in this file (chevron, x, and the glyph whose
 * aria-label is a UI word). The four brand marks below stay out.
 */
export function Painel() {
  return (
    <div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="m9 18 6-6-6-6" />
      </svg>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor">
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
      <svg viewBox="0 0 20 20" aria-label="Close" fill="currentColor">
        <path d="M6 6l8 8M14 6l-8 8" />
      </svg>
    </div>
  );
}

/* Brand marks on the same 24 grid (Simple Icons ships logos there).
 * EXPECTED: zero. */
export function Logos() {
  return (
    <div>
      {/* a <title> that names a brand */}
      <svg viewBox="0 0 24 24" fill="currentColor">
        <title>Acme</title>
        <path d="M12 2 2 22h20z" />
      </svg>
      {/* role="img" with a label that is not a UI word */}
      <svg viewBox="0 0 24 24" role="img" aria-label="Planetscale" fill="currentColor">
        <path d="M0 12 12 0l12 12-12 12z" />
      </svg>
      {/* a single complex path, longer than any glyph (the shortest real logo measured, Prisma, has 214 chars) */}
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.8068 18.2848L13.5528.7565c-.207-.4382-.639-.7273-1.1286-.7541-.5023-.0293-.9523.213-1.2062.6253L2.266 15.1271c-.2773.4518-.2718 1.0091.0158 1.4555l4.3759 6.7786c.2608.4046.7127.6388 1.1823.6388.1332 0 .267-.0188.3987-.0577l12.7019-3.7568c.3891-.1151.7072-.3904.8737-.7553s.1633-.7828-.0075-1.1454zm-1.8481.7519L9.1814 22.2242c-.3292.0975-.6448-.1873-.5756-.5194l3.8501-18.4386c.072-.3448.5486-.3996.699-.0803l7.1288 15.138c.1344.2856-.019.6224-.325.7128z" />
      </svg>
      {/* a literal brand color: a multicolor mark, not a currentColor glyph */}
      <svg viewBox="0 0 24 24">
        <path fill="#4285F4" d="M12 11v3h5a5 5 0 1 1-1-6" />
      </svg>
    </div>
  );
}
