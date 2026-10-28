# Simulação por slider

Um slider que projeta cenário coloca na tela um número que **não aconteceu**, do
lado de números que aconteceram. O desenho todo existe para essa separação não
falhar. É o mesmo princípio de "a UI não pode mentir pro banco", virado pra fora.

## O contrato

1. **O real fica visível e marcado na trilha.** Um traço no valor de hoje, e o
   rótulo diz qual é qual ("real" e "simulado", ou "hoje" e "projetado"). Dois
   números da mesma unidade e de espécies diferentes, sem rótulo, corrompem a
   leitura de quem chegou depois.
2. **Simulação em curso é um estado visível**, não uma diferença silenciosa de
   número. Um rótulo no bloco basta; não precisa de moldura nem de cor.
3. **Voltar ao real é um clique**, e o controle só aparece quando há simulação.
   Controle morto não renderiza.
4. **Paradas nos números que mudam a decisão.** `step` redondo é preguiça: as
   paradas úteis são os cortes de regime, as metas e o valor real. Fora das
   paradas, movimento livre e fino.
5. **Os cortes aparecem na trilha** antes do arraste, com o número. O usuário
   precisa ver onde a coisa muda para saber para onde arrastar.
6. **Nada persiste.** Simulação não escreve no banco. Só entra na URL se
   compartilhar cenário for parte do pedido, e aí o link diz que é cenário.
7. **Teclado move e a leitura fala.** As setas do Radix já andam; `aria-label` diz
   o que o slider controla e `aria-valuetext` devolve o valor formatado, não o
   número cru.
8. **Faixa com sentido.** O máximo do slider é um número defensável (o próximo
   corte de regime, o dobro do real), não `999999`. Máximo arbitrário faz o
   controle inteiro parecer chute.

## O estado

Um estado só, e ele é `null` quando não há simulação. Isso mata a comparação
`simulado === real` (que quebra por centavo de ponto flutuante) e faz o "voltar ao
real" ser `setSim(null)`:

```tsx
const [sim, setSim] = useState<number | null>(null);
const valorEmUso = sim ?? real;
const simulando = sim !== null;
```

Derivar tudo de `valorEmUso` mantém uma fonte só. O erro que aparece aqui é
guardar o resultado do cálculo em estado e recalcular em efeito: o cálculo é puro,
então ele mora no render.

## Latência

O número **segue o dedo**. Sem debounce no valor exibido, sem animação no valor
enquanto arrasta, sem fetch por movimento. Se a projeção exige servidor, o desenho
está errado: simulação é conta local, e o que não é conta local vira botão
"projetar" com um resultado só.

## Erros clássicos

- Slider sem o valor real na tela: quem abre a tela dois dias depois não sabe mais
  qual número é fato.
- `step` de mil num domínio de duzentos mil: 200 paradas, nenhuma útil.
- Simulação que muda o dado exportado. A planilha exporta o real, e se exportar
  cenário, o nome do arquivo diz.
- Animar o número durante o arraste.
- Slider como filtro. Filtro é filtro (select, período, busca); slider é
  projeção. Trocar um pelo outro faz o usuário achar que apagou dado.
