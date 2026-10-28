// Outside icons/: a fill on <path> is glyph geometry, a fill on <circle> is a chart color.
export function Gauge() {
  return (
    <svg viewBox="0 0 100 100">
      <path
        d="M0 0L10 10"
        fill="#0D0C22" data-k="CALA"
      />
      <circle
        cx="50"
        r="45"
        fill="#DCFCE7" data-k="ACUSA"
      />
      <p className="text-[#1d9bf0]" data-k="ACUSA">arbitrary class outside icons still fires</p>
    </svg>
  );
}
