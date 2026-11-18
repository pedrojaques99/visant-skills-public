import { Icon } from "@acme/ui";

/*
 * Uses the local Icon, then bypasses it with one inline glyph.
 * EXPECTED hand-drawn-icon: 1 (the bypass). The `<Icon name=...>` call is clean.
 */
export function Barra() {
  return (
    <div>
      <Icon name="chevron" />
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M5 12h14" />
      </svg>
    </div>
  );
}
