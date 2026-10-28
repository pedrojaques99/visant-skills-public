// Fixture of the killer-scan token fallback (--self-test).
// Contract: a code line carrying the flag-marker must be flagged, one with the quiet-marker must not.
export function Sujo({ go }: { go: () => void }) {
  return (
    <div className="bg-[#1a1a2e] p-4" data-k="ACUSA">
      <p className="text-purple-500" data-k="ACUSA">a</p>
      <span style={{ color: '#ff0000' }} data-k="ACUSA">b</span>
      <span style={{ background: 'rgba(0, 0, 0, 0.6)' }} data-k="ACUSA">c</span>
      <div className="border-[hsl(210_40%_50%)]" data-k="ACUSA" />
      <a href="#add" data-k="CALA">anchor that looks like a hex</a>
      <span style={{ color: 'hsl(var(--primary))' }} data-k="CALA">token</span>
      <p className="text-muted-foreground bg-primary" data-k="CALA">semantic</p>
      {/* EXCEÇÃO ao token-fallback/rgb-hsl-cru: scrim over a customer photo */}
      <div style={{ background: 'rgba(0,0,0,0.6)' }} data-k="CALA" />
      {/* EXCEPTION to token-fallback/hex-cru: brand swatch shown as data */}
      <span style={{ color: '#00ff00' }} data-k="CALA">swatch</span>
      <button onClick={go} data-k="CALA">&#9662; open</button>
    </div>
  );
}
