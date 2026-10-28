// No token layer, calm palette: neutrals plus two accents. Zero findings.
export function Calm() {
  return (
    <div className="border-neutral-200 bg-neutral-50 text-black dark:bg-black dark:text-white">
      <p className="text-zinc-500">muted</p>
      <a className="text-blue-600">link</a>
      <span className="text-red-500">error</span>
    </div>
  );
}
