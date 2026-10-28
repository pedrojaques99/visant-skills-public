# Gráfico na Visant (recharts)

Complemento do `dataviz`, que é quem manda em forma, cor por função e
anti-padrão. Aqui fica só o que é específico do stack e do repo.

## Mapa de token

Nunca hex no JSX, nunca palette crua do Tailwind. E **o envelope não é opcional**:
os tokens deste repo guardam canal HSL solto (`--primary: 0 0% 9%`), então
`stroke="var(--primary)"` entrega a string `0 0% 9%`, que não é cor. O traço
simplesmente não aparece: sem erro de tipo, sem aviso de lint, sem achado de
detector visual. Foi exatamente assim que um gráfico foi commitado sem cor.

```tsx
// Uma série: a cor da série é o próprio primário; texto usa token de texto.
<Line dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />

// Grade e eixo são recessivos, sempre.
<CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
<XAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
```

Antes de escrever a primeira cor, confira o formato do token no `globals.css` do
repo: canal solto pede `hsl(var(--x))`; token que já é cor completa (`oklch(...)`,
`#hex`) pede `var(--x)` pelado. Errar o formato é invisível na leitura do código.

| Função | Token |
|---|---|
| série única, magnitude | `hsl(var(--primary))` |
| segunda série, comparação com o passado | `hsl(var(--muted-foreground))` |
| exceção (estourou, atrasou, negativo) | `hsl(var(--destructive))` |
| meta batida | `hsl(var(--success))` |
| grade e eixo | `hsl(var(--border))` e `hsl(var(--muted-foreground))` |

Mais de duas séries num painel de trabalho é sinal de que a pergunta não foi
decidida. Corte a série ou separe em dois gráficos. Nunca dois eixos y.

## Estados

Todo gráfico entra dentro do `ChartState` (`components/admin/finance/ChartState.tsx`):
skeleton em forma de barra, sem salto de layout, e vazio que fala. Eixo vazio com
moldura é o equivalente gráfico do "0 itens" que na verdade era erro de rede.

Erro é estado separado de vazio. Se o fetch falhou, o gráfico não diz "sem dados
neste período".

## Limite e meta

Limite é fato, então é linha, não cor de fundo:

```tsx
<ReferenceLine
  y={MEI_ANNUAL_LIMIT}
  stroke="var(--destructive)"
  strokeDasharray="4 4"
  label={{ value: 'Teto MEI', position: 'insideTopRight',
           fill: 'var(--muted-foreground)', fontSize: 11 }}
/>
```

- Tracejado para limite legal ou meta; contínuo só para o dado.
- O rótulo tem o nome. Linha sem rótulo obriga a decorar a legenda.
- Marcar **onde** cruzou vale mais que marcar que cruzou: num acumulado, o ponto
  do mês em que passou o teto é a informação que gera ação.

## Acumulado que cruza faixa

A forma certa para "quando eu estouro o limite": área do acumulado por mês, com
`ReferenceLine` em cada corte, e o ponto de cruzamento rotulado. Não é gráfico de
pizza, não é barra por mês (que esconde o acumulado), e não é medidor (que perde
o quando).

```tsx
<AreaChart data={acumulado} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
  <defs>
    {/* id escopado por instância: dois gráficos com o mesmo id se sobrescrevem */}
    <linearGradient id={`fill-${instanceId}`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.18} />
      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
    </linearGradient>
  </defs>
  <Area dataKey="acumulado" stroke="var(--primary)" strokeWidth={2}
        fill={`url(#fill-${instanceId})`} />
</AreaChart>
```

`useId()` do React resolve o escopo. Sem isso, `clipPath` e `defs` repetidos entre
dois gráficos da mesma página colidem, e o bug aparece como gráfico sem
preenchimento em apenas um dos dois.

## Sparkline

Sem eixo, sem grade, sem tooltip, altura fixa, `dot={false}`. Se a série tem
menos de 4 pontos, não desenhe: escreva o delta.

## Tooltip

`CustomChartTooltip` já existe e já formata moeda. Reusar. Tooltip próprio só se o
conteúdo é estruturalmente diferente, e nesse caso ele nasce ao lado do outro, com
o mesmo espaçamento e o mesmo tipo de rótulo.

## Verificação específica de gráfico

- Renderizar e **olhar**: o validador do `dataviz` checa cor, não colisão de
  rótulo nem estouro.
- Medir a 390px: gráfico é o principal gerador de estouro horizontal, e
  `ResponsiveContainer` precisa de um pai com largura definida e `min-w-0`.
- Ano vazio, mês vazio e um ponto só: os três renderizam sem quebrar o eixo.
