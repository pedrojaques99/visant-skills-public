/* Ver irmaos-pai.tsx. ESPERADO porta-repetida: 1 (esta ponta). */
export function CampoCaixa({ Group }: { Group: React.ComponentType<{ cap: string; children?: React.ReactNode }> }) {
  return <Group cap="link da faixa"><input placeholder="cole aqui" /></Group>;
}
