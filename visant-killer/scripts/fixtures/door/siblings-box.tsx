/* See siblings-parent.tsx. EXPECTED repeated-door: 1 (this end). */
export function CampoCaixa({ Group }: { Group: React.ComponentType<{ cap: string; children?: React.ReactNode }> }) {
  return <Group cap="link da faixa"><input placeholder="cole aqui" /></Group>;
}
