// Fixture of the killer-scan token fallback (--self-test): new and legacy rule ids in exceptions.
// Contract: a code line carrying the flag-marker must be flagged, one with the quiet-marker must not.
export function Ids() {
  return (
    <div>
      {/* EXCEPTION to token-fallback/paleta-tailwind: legacy id still waives */}
      <p className="text-purple-500" data-k="CALA">a</p>
      {/* EXCEPTION to token-fallback/raw-hex: new id waives */}
      <span style={{ color: '#00ff00' }} data-k="CALA">c</span>
      {/* EXCEÇÃO ao token-fallback/raw-rgb-hsl: new id, Portuguese prefix */}
      <span style={{ color: 'rgb(1, 2, 3)' }} data-k="CALA">d</span>
      <hr />
      <hr />
      <hr />
      {/* EXCEPTION to token-fallback/tailwind-palette: new id waives */}
      <p className="text-rose-500" data-k="CALA">b</p>
    </div>
  );
}
export function WrongRule() {
  return (
    <div>
      {/* EXCEPTION to token-fallback/hex-cru: waives raw-hex only, not the palette */}
      <p className="text-teal-500" data-k="ACUSA">e</p>
    </div>
  );
}
