/* See screen-a.tsx. EXPECTED: zero. */
export function TelaB({ Group }: { Group: React.ComponentType<{ cap: string }> }) {
  return <Group cap="nome do preset" />;
}
