// EXPECTED: zero. Hairlines, selection by color, focus up to 2px, the spinner, written exceptions.
export function Clean() {
  return (
    <div>
      <div className="rounded-lg border border-border p-4" />
      <div className="border-0 ring-1 ring-border outline-0" />
      <div className="data-[state=checked]:border-accent/55 data-[state=checked]:bg-accent/10" />
      <button className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-2" />
      <span className="size-4 animate-spin rounded-full border-2 border-muted border-t-transparent" />
      <div className="ring-offset-2 border-[0.5px]" />
      {/* EXCEPTION to stroke-scan/heavy-ring: the quota ring is a chart, its weight is data */}
      <svg className="ring-4" />
      <div style={{ borderWidth: 1, outline: 'none' }} />
      {/* <div className="border-2" /> */}
      <img className="ring-2 ring-background" />
    </div>
  )
}
