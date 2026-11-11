// EXPECTED: heavy-border 5, heavy-ring 2, heavy-outline 1, heavy-focus 2
export function Dirty() {
  return (
    <div>
      <div className="rounded-lg border-2 border-border p-4" />
      <div className="border-[1.5px] data-[state=checked]:border-2" />
      <label className="ring-2 ring-accent" />
      <button className="focus-visible:ring-[3px] focus-visible:ring-ring/50" />
      <input className="focus:outline-4" />
      <div className="outline-2 outline-accent" />
      <div style={{ borderWidth: 2 }} />
      <div style={{ border: '2px solid var(--accent)' }} />
      <div className="shadow-[0_0_0_2px_var(--accent)]" />
      {/* a reason under 8 letters releases nothing: */}
      {/* EXCEPTION to stroke-scan/heavy-border: ok */}
      <div className="border-t-2" />
    </div>
  )
}
