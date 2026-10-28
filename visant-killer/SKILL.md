---
name: visant-killer
description: 'Porta única de auditoria de UI da Visant: roda os detectores como portão duro, aplica frontend/motion/refine como julgamento e fecha com interrogatório adversarial, com nota. Use em "tá com cara de IA", "tá slop", "audita essa tela", "mata essa tela", "nível vale do silício", "refaça nível Visant", auditar UI antes de PR.'
---

# Visant Killer

Auditoria adversarial de UI. A tela é ré, não cliente.

Duas metades que não se substituem:

1. **Portão** (determinístico, script): detector passou ou não passou. Nota binária.
   São quatro: tell de IA, token, vício de voz e **ruído de cromo**.
2. **Julgamento** (você, com as skills carregadas): o que os detectores não veem.
   Slop de IA sobrevive a qualquer linter porque o problema é decisão, não sintaxe.

> **Regra zero, herdada de `visant-copy`:** só entra no arquivo o conserto de
> defeito confirmado. O que passa limpo fica intocado, mesmo se você achar que
> soa flat. Melhoria de gosto vai como tabela de proposta no relatório, e o
> usuário escolhe linha por linha. Reescrever o que estava bom queima confiança.

> **Portão verde não é tela vista.** Um `AnimatePresence` travado num formulário
> de captação passou por `tsc`, ESLint, `motion-lint`, `impeccable`,
> `audit:design` e `copy-lint`. Por isso o `killer-scan` **recusa** dizer
> "portão aberto" sem a tabela de superfícies e o registro de ter aberto a tela.

## Proibições duras (você viola escrevendo, não revisando)

Estas não são preferência: o `lint:design` do repo reprova o commit. Estavam só
no bash e em skill nenhuma, então dava pra escrever a violação com a skill
carregada e só descobrir no portão.

| Proibido | Escreva | Por quê |
|---|---|---|
| glifo de seta em texto (`→`, `←`, `↑`, `↓`) e SVG de ícone desenhado à mão | ícone de biblioteca real (`@phosphor-icons/react`, `@radix-ui/react-icons`) | **LEI.** Seta em caractere é o vício nº1 do Claude: ela herda a métrica da fonte, desalinha da linha de base, muda de desenho a cada família, não tem peso nem tamanho controláveis, e o leitor a lê como texto. SVG à mão é a mesma doença com mais linhas. Ícone é ativo de biblioteca, sempre |
| `hover:scale-*`, `whileHover={{ scale }}` | mudar cor, sombra ou borda | escala em hover é o tell nº1 de template; move layout vizinho e não sobrevive a `prefers-reduced-motion` |
| hover que cresce **por cima** do texto vizinho | reservar a pista permanentemente e crescer dentro dela | medido no /c da cliente K: um traço `w-4` escalando 2.5× num flex passou por baixo do rótulo. Hover revela, hover não atropela |
| `hover:bg-accent` **quando `--accent` é destaque** | `hover:bg-muted` ou `hover:bg-primary` | destaque virando estado de mouse. Confira o token: no visantlabs-os `--accent` é o neutro de hover do shadcn, e ali `hover:bg-accent` é o certo |
| `border-accent` | `border-border` | mesma confusão: destaque virando cromo |
| `backdrop-blur` fora de dialog/sheet | fundo sólido do token | custa composição em cada scroll; num card é enfeite pago com frame |
| `white-space: nowrap` em overlay sem `max-width` | `max-width: calc(100% - 12px)` e deixa quebrar | dentro de um pai com `overflow: hidden` a palavra é CORTADA, e o corte só existe depois de a fonte carregar: nenhum linter vê. Medido: "tirar da fila" virou "tirar da" num card de 96px |
| realce fixo (`on: true`, `active: true`) na fábrica de um item | a condição que decide (`on: q.live`) | realce que roda uma vez por item acende a lista inteira — e destaque que destaca tudo não destaca nada |
| duas portas do mesmo tipo de dado na mesma tela | uma por tela, ou nomes que dizem a diferença (o detector só cobra a mesma tela; nome repetido entre telas é julgamento) | dois campos de url iguais, um ao lado do outro, escrevendo em bancos diferentes: a pessoa escolhe por sorte |
| `transition-all` | `transition-colors` ou lista explícita | anima o que você não pediu, inclusive layout |
| `duration-300`+ em elemento interativo | `DUR.base` / `DUR.slow` | acima de ~300ms a UI parece travada |
| hex cru, `rgb()`, `rgba()` | token HSL (`hsl(var(--x))`) | `var(--x)` sozinho não é cor: os tokens guardam canal solto |
| demo de componente com moldura falsa, legenda "passe o mouse", variações empilhadas | a peça grande e centrada, **um por vez**, seletor quieto | catálogo 35–38: no ladrilho a peça some atrás da explicação |
| estado bonito (brilho, tilt, menu aberto) só no hover | nasce no melhor estado; hover intensifica | não existe no toque, no ladrilho nem no print (catálogo 37) |
| botão/card clicável sem `cursor: pointer`; arrasto sem `grab` | regra na casca (`:is(button,[role=button],a[href])`) | preflight do Tailwind v4 zera o cursor (catálogo 46) |
| copy de cliente em peça de library | texto genérico, pt-BR falado | a library vende pra todos os clientes (catálogo 42) |

Exceções existem (transição de rota, peça de marketing, `#fff`/`#000` como
referência de contraste WCAG, blur em `Dialog`, scrim sobre foto). Exceção vai
**com motivo escrito na linha**, no formato do scanner (tabela no Passo 2),
nunca com `audit-ignore` mudo.

## Passo 0 — Raiz primeiro (alvo grande)

Alvo de dezenas de arquivos (uma pasta, "todas as rotas", o app inteiro)
começa agrupando achado por **raiz**, não lendo a lista:

```bash
node ~/.claude/skills/visant-killer/scripts/killer-scan.mjs --roots <alvo>
```

Um container errado gera centenas de folhas com o mesmo sintoma, e as folhas
apontam pro arquivo errado. Medido na rodada de 2026-10 (455 arquivos): o
`PageShell` com grade de pontos, o `GlassPanel` com blur por padrão, mono e
inglês embutidos em `CardDescription`/`EmptyState`/`StatusBadge` e um `Thumb`
que colapsava. Consertar essas raízes primeiro apagou boa parte da lista sem
tocar nas folhas. Primitivo do design system e shell vêm antes de qualquer
página; só depois o `--all` pra dividir o resto por arquivo.

Como ranqueia: junta o achado de todos os detectores pelo arquivo onde mora e
fica só com peça **compartilhada** (`components/ui`, `components/shared`,
`lib/ui`, ou importada por 5+ arquivos), ordenada por `fan-out × achados`. O
fan-out sai do `grafo.mjs` (quem importa quem, sem dependência, com alias do
tsconfig) e é medido no projeto inteiro, não no recorte: a tela que herda o
defeito pode estar fora do alvo. Mostra 15; `--all` lista tudo.

## Passo 1 — Classificar o alvo (nunca pule)

O tier decide quanto interrogatório o alvo merece. Errar o tier gasta contexto no
lugar errado, ou entrega auditoria rasa em cima do que paga a conta.

| Tier | O alvo é | Sinais | Interrogatório |
|---|---|---|---|
| **T1 Folha** | um componente, um card, uma linha de lista | 1 a 3 arquivos, não tem rota própria, não escreve no banco | 5 perguntas |
| **T2 Rota** | uma tela inteira | tem `page.tsx`, tem estados (carregando, vazio, erro), tem teclado | 12 perguntas |
| **T3 Núcleo** | fluxo que move dinheiro, identidade, ou várias rotas | escrita no banco, cobrança, permissão, onboarding, pipeline comercial | 20 perguntas mais posicionamento |

Quando o alvo mistura tiers, classifique **por região**, não por pasta: uma linha
de cobrança dentro de uma tela de listagem é T3 dentro de um T2.

**Atalho, quando a queixa for só de excesso** ("tá cheio de texto", "poluído",
"muita label", "cara de template", "ruído visual"): vá direto para
[references/despoluir.md](references/despoluir.md). É o único caminho desta skill
que não depende de nada da casa — roda em repo alheio, em inglês, sem instalar
nada e sem o repo ter linter nenhum.

## Passo 2 — Portão (roda antes de ler o código)

**Comece pelo relatório, não pelo detector.** Esta ordem é o conserto de uma
falha real: numa rodada, alguém rodou `motion-lint` e `refine-scan`, viu os dois
zerados e chamou de passada completa — pulou o `visant-frontend` sem perceber.
Não foi descuido. Os detectores terminam em script, e script dá sensação de
acabamento; a classificação das superfícies terminava numa pergunta, que não tem
exit code. Agente sempre gravita pro que fecha em zero.

```bash
K=~/.claude/skills/visant-killer/scripts/killer-scan.mjs
node $K --init-report AUDIT.md <alvo>    # esqueleto com uma linha por tela
# preencha a tabela ANTES de consertar qualquer coisa
node $K --report AUDIT.md <alvo>
```

O `--init-report` pré-preenche uma linha **por rota** (lida do roteador: página
real, não arquivo de componente; redirecionamento sai da tabela e vira nota),
com a coluna **Shell** já sugerida pelo `navConfig` (quem menciona o caminho).
Shell é pista, não classificação: confirme. Repo sem roteador legível cai em
uma linha por arquivo de interface. Sem `--report`, ou
com a tabela incompleta, o script imprime **PORTÃO INCOMPLETO** e sai 1 — a
palavra "aberto" ficou inalcançável por disciplina.

Duas colunas são obrigatórias por linha, e as duas existem para forçar uma frase:

- **superfície** — A aquisição (quem ainda não é cliente), B trabalho (quem usa
  todo dia), C confiança (dinheiro, permissão, ação destrutiva). Aplicar
  instinto de A numa tela B é o erro mais caro do frontend Visant.
- **variável de negócio** — o que este elemento move. Traço, "TBD" ou vazio o
  script rejeita: preencher com nada é a versão burocrática de pular o passo.

A seção `## Tela vista` do relatório é a outra metade: uma linha por tela
**aberta**, com rota, largura, estado do dado e o que aconteceu. Antes de medir
qualquer coisa, leia [references/ambiente.md](references/ambiente.md) — numa
sessão real, metade dos achados iniciais eram o dev server mentindo (rota
compilando em 115s, hidratação parcial lida como bug, CDP cortando em 45s).

O `killer-scan` roda os quatro detectores e imprime um placar só, já filtrando o
falso positivo que faz o copy-lint gritar em código (o menos da subtração, o
travessão dentro de comentário): só string que chega no olho do usuário — texto
de JSX, `label`, `title`, `placeholder`, `aria-label`, `alt`.

**Portão de token achado por ARQUIVO, não só por script npm.** O detector 2
procurava `audit:design` / `lint:design` / `design:lint` / `lint:tokens` no
`package.json` e, sem nenhum deles, imprimia `PULADO`. O visantlabs-os guarda o
portão dele como arquivo (`scripts/scan-design-violations.mjs`), então o killer
dizia "pulado" com o scanner ali do lado — pulo silencioso lido como aprovação,
o mesmo defeito que os apelidos de npm já tinham consertado uma vez. Agora ele
cai em `scripts/scan-design-*.mjs` / `audit-design-system.cjs` antes de
desistir, e só `ERR` é portão (`WRN` continua sendo julgamento).

**Diga o caminho inteiro do script.** Esta skill, o `visant-frontend` e o
`visant-refine` citam scripts uns dos outros pelo nome curto, e descobrir onde
eles moram custa tempo em toda sessão nova. O prefixo é sempre
`~/.claude/skills/<skill>/scripts/`:

```bash
K=~/.claude/skills/visant-killer/scripts/killer-scan.mjs
R=~/.claude/skills/visant-refine/scripts/refine-scan.mjs
D=~/.claude/skills/visant-killer/scripts/dist-scan.mjs
C=~/.claude/skills/visant-copy/scripts/copy-lint.mjs
T=~/.claude/skills/visant-killer/scripts/corta-scan.js   # roda NO NAVEGADOR (Passo 5)
V=~/.claude/skills/visant-killer/scripts/verify-screens.mjs  # abre o app logado (Passo 5)
# grafo.mjs (mesma pasta) não se roda sozinho: é a biblioteca de imports que o
# --roots (fan-out) e a porta-repetida (mesma tela) usam
```

**Portões do repo-alvo entram junto quando existirem.** No visantlabs-os:

```bash
npm run check:ui-ratchet                     # o que o CI roda (ver "Catraca" abaixo)
node scripts/scan-ui-scale.mjs <alvo>        # micro-label, px cru, peso, raio, accent
                                             # em repouso, matiz literal, opacidade crua
node scripts/scan-ui-slop.mjs                # ciano fora de CTA, mono decorativo
node scripts/scan-lightmode-breakage.mjs --summary   # o que some no tema claro
node scripts/sync-craft-tokens.mjs --check   # a Layer 2 chegou no index.css?
```

O quarto detector do `killer-scan` é o **ruído de cromo** (`scripts/ruido-scan.mjs`
desta skill), e ele existe porque
os outros três olham para uma linha por vez. Nenhum deles soma. O defeito que
sobrava era a tela inteira correta e ilegível de tanto texto de apoio: rótulo em
caixa-alta em todo trecho, instrução de uso ao lado de um controle que já tem
afordância, a mesma informação dita em três tamanhos, a palavra "add" repetida
uma vez por item da lista. Cada uma dessas linhas, sozinha, é defensável — e é
por isso que passa por tudo. O catálogo tem a entrada completa em
[references/slop-catalog.md](references/slop-catalog.md), item 20, "a página que
se explica", e o procedimento de aplicação em qualquer repo — inclusive fora da
Visant, em inglês, sem tokens da casa — está em
[references/despoluir.md](references/despoluir.md).

Duas coisas sobre esse detector:

**Das quinze regras do `ruido-scan`, nove não são de texto.** Três entraram em
2026-09-11, de um painel que passou pelos quatro detectores, pelo `tsc`, pelo
`ui:audit` e por 2347 testes:

- `realce-que-nao-decide` — realce escrito à mão (`on: true`) dentro da fábrica
  de um item: ele roda uma vez por item, a lista inteira acende, e o único
  destaque da tela é gasto num fato que um selo já contava.
- `porta-repetida` — **a regra que não cabe num arquivo.** A mesma porta de
  dado (campo com `placeholder`) em dois componentes **da mesma tela**: a
  pessoa escolhe por sorte. "Mesma tela" é ancestral comum a até dois níveis no
  grafo de imports (`grafo.mjs`), sem `import()` lazy, sem roteador/barril como
  pai, e sem `return` antecipado ou ternário separando os dois lados; chave
  `common.*` fica fora. Antes disso (rodada 1 de 2026-10-05) eram 25 achados
  quase todos falsos; agora 2 reais. O achado aponta as duas pontas. **A forma
  2** (um nome só pra coisas diferentes em telas diferentes) saiu do detector e
  voltou a ser julgamento: é vocabulário, ver `slop-catalog.md` item 21.
- `icone-desenhado-a-mao` — o que um import de biblioteca substituiria.

Seis entraram em 2026-10-05, dos prints que o usuário mandou da fase 1 do slop
killer: todas foram vistas **abrindo a tela** depois de os detectores darem
verde. Uma linha de motivo cada; o caso inteiro está no `slop-catalog.md`.

| Regra | Pega | Por quê |
|---|---|---|
| `capa-sintetica` | matiz de hash do nome, cores de dado viradas degradê perto de imagem ausente | capa inventada parece dado e não quer dizer nada (catálogo 24) |
| `img-de-tile-sem-onerror` | `<img>` com `object-cover`/`aspect-*` sem `onError` | URL quebrada vira ícone partido ou borrão eterno; 128 refs mortas na /references (25) |
| `cascata-por-indice` | `delay`/`animationDelay` = `index * …` | o 30º item espera 1,5s a cada filtro (30) |
| `hover-que-levanta` | `hover:-translate-y-*`, `hover:scale` > 1, `whileHover` com `y<0` | 26 cards do AdminPage pulando; não existe no toque (31) |
| `grade-de-pontos` | `radial-gradient` repetido, SVG de círculos, `<GridDots>` | textura de template; morava no `PageShell` e saía em toda rota (32) |
| `blur-em-card` | `backdrop-blur` em elemento no fluxo | sem nada atrás não borra nada, só custa GPU (18) |

- **Achado dele é candidato a corte, não conserto automático.** Uma dessas
  linhas pode ser a única que orienta de verdade. Confirme em `arquivo:linha`.
- **A exceção existe e é obrigada a se justificar**, no formato da tabela
  "Exceção escrita" abaixo. Gesto sem afordância nativa (modificador de
  teclado, redimensionar janela) é a exceção legítima mais comum; a outra é o detector estático que
  não vê a troca em runtime (`porta-repetida` com um compositor que some quando
  o painel do chat está aberto).

Dois portões laterais, conforme o alvo:

```bash
# alvo com gráfico, medidor ou animação
node ~/.claude/skills/visant-refine/scripts/refine-scan.mjs <alvo>
# superfície A (aquisição) — e este roda ANTES do burilamento
node ~/.claude/skills/visant-killer/scripts/dist-scan.mjs <raiz-do-app>
```

O de distribuição vem antes porque burilar o interior de uma página sem porta é
a inversão que já custou uma sessão: página que compartilha sem card, ou que
converte sem disparar evento, não é consertável por token de cor, e nenhum
detector de interface acende nisso.
[references/distribuicao.md](references/distribuicao.md).

**Portão falhado vira conserto, não proposta — depois de confirmar cada achado
em `arquivo:linha`.** As duas metades dessa frase são obrigatórias. Em código
novo e uniforme o portão acerta quase tudo; em código legado ele é barulhento, e
já entregou **6 falso positivo em 12 achados** numa rodada real (um `prev.year - 1`
lido como travessão, uma assinatura de tipo, um `;` que era de `&quot;`).
Consertar sem ler a linha é escrever bug com a bênção do detector.

Falso positivo confirmado tem UM conserto certo: **arrumar a regra e travar o
caso no fixture**, nunca um `audit-ignore` no arquivo. Ignore por valor esconde o
próximo.

### Exceção escrita: um contrato, cinco scanners

Linha legítima se libera com um comentário **na mesma linha ou nas 8 acima**,
citando escopo e regra pelo nome, com motivo. Allowlist muda é proibida.

| Scanner | Linha | Arquivo inteiro | Regras |
|---|---|---|---|
| `ruido-scan` (desta skill) | `EXCEÇÃO ao ruido-scan/<regra>: motivo` | `// ruido-ignore-file: <regra> — motivo` | as 15 do script (`ensina-a-usar`, `porta-repetida`, `blur-em-card`…) |
| `scripts/scan-ui-slop.mjs` | `EXCEÇÃO ao ui-slop/<regra>: motivo` (aceita `ruido-scan/<regra>`) | não tem | `cyan` ou `cyan-non-cta`, `mono` ou `mono-uppercase` |
| `scripts/scan-ui-scale.mjs` | `EXCEÇÃO ao ui-scale/<regra>: motivo` | `// ui-scale-ignore-file: <regra> — motivo` | `micro-label`, `px-cru`, `peso-pesado`, `raio-sortido`, `accent-repouso`, `matiz-cru`, `opacidade-cru` |
| `scripts/scan-design-violations.mjs` | `EXCEÇÃO ao audit:design/<regra>: motivo` | `// audit:design-ignore-file: <regra> — motivo` | o `id` da regra no script |
| `scripts/scan-lightmode-breakage.mjs` | `EXCEÇÃO ao lightmode/<regra>: motivo` | `// lightmode-ignore-file: <regra> — motivo` | `dark-surface-no-token`, `light-only-text`, `dark-only-border` |

```tsx
{/* EXCEÇÃO ao ui-scale/opacidade-cru: scrim sobre a foto do cliente */}
<div className="absolute inset-0 bg-black/60" />
```

- **Nome exato, escopo certo.** `ui-scale/peso` não libera `peso-pesado`, e
  `ui-slop/opacidade-cru` não libera o `ui-scale`. Linha que dois scanners
  acusam leva dois comentários (scrim com `text-white`: `ui-scale/opacidade-cru`
  e `lightmode/light-only-text`).
- **Motivo de verdade:** pelo menos 8 letras, pode continuar na linha de
  comentário seguinte. `EXCECAO` sem acento vale. Exceção abaixo do achado não
  vale. O `ruido-scan` só confere a palavra e o nome da regra; o motivo continua
  obrigatório por contrato.
- **`--fix` não toca linha exceptuada** (`scan-design-violations`).
- O contrato está travado em `--self-test` nos quatro scripts do repo.
- O portão de **copy** não tem exceção por linha: só `.killer-voice.json` na
  raiz do alvo, `{"dispensa":["bolinha"],"motivo":"…"}`, motivo de 40+
  caracteres e só regra de delimitador (`bolinha`, `travessao`,
  `pipe-separador`, `hifen-como-travessao`).
- O `scan-lightmode-breakage` também suprime arquivo que declara a classe
  `dark` solta (palco sempre escuro) e as pastas de editor. A regra do editor
  escuro está em `visant-frontend/references/ds-visantlabs-os.md`.

### Catraca no CI

`npm run check:ui-ratchet` roda no `.github/workflows/test.yml`: self-test do
`scan-ui-slop`, `check:ui-slop`, `check:ui-scale` e `i18n:check --strict`. Os
dois scanners comparam o total do app com `scripts/.ui-slop-baseline.json` e
`scripts/.ui-scale-baseline.json` e falham se qualquer total subir.

Quando regravar (`node scripts/scan-ui-slop.mjs --save-baseline`,
`node scripts/scan-ui-scale.mjs --save-baseline`):

- **Só quando o total caiu.** O `--check` avisa ("melhorou; rode
  --save-baseline pra apertar"). Regrave no mesmo commit da limpeza, senão a
  folga vira espaço pra regressão.
- **Nunca pra absorver subida.** Total que subiu se conserta no código ou com
  exceção escrita. Regravar por cima é `audit-ignore` com outro nome.
- **Mede o app inteiro**, não combine com `--page` nem com alvo. Com agentes em
  paralelo, regrava uma vez só, quem fecha a rodada, depois das edições.

### Regra do alvo antes do achado (não caia em buraco de minhoca)

Sintoma de que o defeito está na REGRA, e não no código: **muito achado, quase
nenhum verdadeiro**. Num audit real o `lint:design` devolveu 104 hex com ~1
verdadeiro — o resto era paleta extraída, referência de contraste WCAG, cor de
marca de terceiro, canvas e HTML de e-mail.

Antes de gastar rodada numa lista: agrupe o achado por pasta (concentração num
`lib/` ou num motor de canvas é assinatura de regra mal escopada), leia a
intenção escrita na própria regra, e só então conserte o que sobrou. Escopar
pede **motivo escrito dentro da regra**; exclusão sem justificativa é
`audit-ignore` com outro nome.

Procedimento completo, com os três casos que ele **não** autoriza:
[references/falso-positivo.md](references/falso-positivo.md).

## Passo 3 — Julgamento (carregue por tier, não tudo sempre)

Carregar quatro skills custa caro e o custo é real: numa rodada, quem tentou
carregou três e usou `revenue-centric-design` de memória. Memória de skill não
é skill. Então a carga escala com o tier, e o que **não** carregar fica escrito
no relatório.

| Tier | Carregue | Não carregue |
|---|---|---|
| **T1 folha** | nada além desta skill | as quatro. A tabela de proibições acima e o `slop-catalog` bastam pra um card |
| **T2 rota** | `visant-frontend` + `visant-motion` | `revenue-centric-design`, salvo se a rota vender algo |
| **T3 núcleo** | as quatro | — |

**Modo T3 enxuto**, quando o contexto está apertado: carregue as quatro skills
mas leia só o SKILL.md de cada uma, nunca os `references/`. As espinhas e as
proibições moram no corpo; os `references/` são consulta sob demanda, para
quando um achado específico exigir. Puxe o reference **do achado**, não o
reference inteiro por precaução.

Ordem, quando carregar:

1. **`visant-frontend`** — o *cut test*: todo elemento nomeia a variável de
   negócio que move, ou não fica. A tabela de superfícies do Passo 2 é a saída
   desta skill, e por isso ela vem antes das outras.
2. **`visant-motion`** — SSoT de easing e duração, e as gotchas que travam o feel.
3. **`visant-copy`** — voz brasileira falada (o portão já pegou a sintaxe; aqui
   é voz).
4. **`revenue-centric-design`** — só como munição do Passo 4.

O que os detectores **não** pegam está catalogado em
[references/slop-catalog.md](references/slop-catalog.md): as marcas de slop de IA
que passam por todo linter, cada uma com sintoma, causa e conserto. Leia antes de
julgar. O card arco-íris (toda cifra pintada de verde ou vermelho numa memória de
cálculo) e o spinner no lugar do skeleton estão lá.

### Vários agentes ao mesmo tempo

Alvo T3 dividido entre agentes paralelos quebra em dois lugares conhecidos, e
os dois têm regra:

- **Posse exclusiva de arquivo.** Cada agente recebe uma lista de arquivos (ou
  uma pasta) e só edita ela. Primitivo compartilhado (`src/components/ui/*`,
  shell, `index.css`) tem UM dono, e quem precisa de mudança ali pede, não
  edita. Dois agentes no mesmo arquivo é o `Edit` de um apagando o do outro sem
  erro nenhum.
- **i18n por fragmento, merge uma vez.** Ninguém edita `src/locales/*.json` em
  paralelo. Cada agente grava `<pasta>/<escopo>.json` no formato
  `{"pt-BR":{"a.b":"…"},"en-US":{"a.b":"…"}}`, e no fim alguém roda, uma vez:

  ```bash
  node scripts/i18n-merge-fragments.mjs <pasta>                  # dry-run: conflito e chave de um locale só
  node scripts/i18n-merge-fragments.mjs <pasta> --apply
  node scripts/i18n-merge-fragments.mjs <pasta> --apply --override a.b,c.d
  ```

  O merge nunca sobrescreve chave existente: valor diferente vira conflito no
  relatório. `--override` é exceção nomeada **chave por chave** (tradução ou nome
  aprovado), nunca um force geral.
- **Dev server compartilhado mente durante a rodada.** O HMR de um agente
  recompila a rota que o outro está medindo: tela vazia e tema "não aplicado"
  aparecem e somem. Meça depois que as edições pararam, ou remeça o que acusar
  antes de chamar de bug.

## Passo 4 — Advogado do diabo

Aqui a auditoria deixa de ser sobre pixel. O objetivo é achar a mudança de
**conceito** que torna metade do trabalho de pixel desnecessário.

Banco de perguntas, por tier, com o que cada resposta obriga:
[references/devils-advocate.md](references/devils-advocate.md).

Como conduzir:

- Escolha as perguntas do tier. Não invente número: pergunta a mais em T1 vira
  filosofia sobre um card. O **bloco fixo (F1 a F6)** roda em todo tier: reuso,
  consistência do design system, responsivo e performance medidos, fluxo
  progressivo para o ICP, o que esconder ou virar ícone, e o que falta para o
  nível Vale do Silício. São as perguntas que o usuário faz de qualquer jeito.
- **Responda você mesmo primeiro**, com evidência em `arquivo:linha`. Pergunta
  devolvida ao usuário sem tentativa de resposta é preguiça disfarçada de rigor.
- Só sobe pro usuário a pergunta que **muda o que se constrói** e que você não
  consegue responder lendo o código. Essa vai como decisão pendente, com a sua
  recomendação primeiro.
- Nomeie o mecanismo do `revenue-centric-design` quando ele existir (hierarquia
  de atenção, Swiss Knife Index, jogada ótima, default como decisão, promessa do
  tamanho da prova). Nomear a alavanca é o valor.
- Uma pergunta que derruba a tela inteira vale mais que doze consertos de token.
  Se a resposta honesta for "esta tela não deveria existir", escreva isso.

## Passo 5 — Verificação (o que compila não é o que alguém viu)

**A primeira linha é abrir a tela.** Ela vem antes de qualquer medida, não
depois, e é o que preenche a seção `## Tela vista` do relatório. Seis portões
verdes já entregaram um formulário de captação com o passo travado; a diferença
entre aquela rodada e uma boa não é mais um detector, é ter olhado.

**App atrás de login: `verify-screens.mjs`** (`$V`). Abre cada rota logado,
nas larguras e nos temas pedidos, e por tela mede estouro do documento,
`corta-scan`, chave i18n crua, erro de console e `pageerror`, resposta 4xx/5xx
de `/api`, tela vazia e se o tema aplicou. Grava print e `report.json`. Rode do
repo-alvo (ele resolve o Playwright de lá):

```bash
node $V                                        # rotas do navConfig, 1366+390, dark, dev-login
node $V --routes home,apps,references --theme both
node $V --scan-paid                            # useEffect que chama IA paga: candidatos à trava
node $V --self-check                           # parsing, sem navegador
```

Rota no Git Bash vai **sem barra** (`apps`, `settings/api-keys`): o MSYS troca
`/apps` por `C:/Program Files/Git/apps`, e `MSYS_NO_PATHCONV=1` quebra o caminho
do próprio script.

**Trava de rota paga.** Abrir `/naming` na base real cobrou e estornou crédito:
sessão salva na fase `deck` com deck vazio dispara `generate-naming` no mount.
Por isso o script tem duas camadas: rota da lista `--skip-paid` (default
`/naming`) nem abre, e em **toda** rota um POST pra endpoint pago é abortado no
navegador e aparece como `PAGO-BLOQUEADO`. A segunda pega a rota paga que
ninguém pôs na lista. `--allow-paid` desliga as duas, e só se usa sabendo
quem paga. Achou rota nova que gasta ao carregar: entra em `DEFAULT_SKIP_PAID`.

`TELA-VAZIA` é remedida uma vez antes de virar achado (quase sempre é o dev
server recompilando), e `api4xx5xx` não reprova sozinho: backend local tem
rota quebrada que não é da tela.

Fora do app (URL publicada, sem login): `corta-url.mjs <base> rota rota`.

E o que está aberto à mão tem ferramenta também: **`corta-scan.js`** mede o
que o olho erra no que está aberto (`corta('.painel')` no console devolve
`arquivo`-menos, `elemento:motivo`). Ele nasceu de um print em que se lia
**"tirar da"** dentro de um card — metade de "tirar da fila", cortada por um
`overflow: hidden` de 96px. Nenhuma linha estava errada em nenhum arquivo.

Ele separa três coisas que a vista confunde, e a separação é o valor:
rolagem **não** é corte (a primeira versão acusou onze linhas de uma lista
rolada, com o "comido" crescendo em progressão aritmética — a assinatura do
próprio defeito da regra), reticências e `line-clamp` **não** são corte, e
trilho que rola de lado **não** é corte. E selo pequeno (< 25% da área) sobre
fundo `inset-0` sem nada interativo **não** é overlay empilhado ("Pública"
sobre a capa do card de marca, 2026-10-05). Travado em
`scripts/fixtures/corta-casos.html`: `node ~/.claude/skills/visant-killer/scripts/corta-self-test.mjs`
rodado do repo-alvo (resolve `playwright-core`/`playwright` do cwd, com o cache do npx
de reserva; sem nenhum, diz NÃO TESTADO, que não é aprovação).

Antes de medir, os quatro sinais de [references/ambiente.md](references/ambiente.md):
rota aquecida (ou medida em `next start`), hidratação confirmada por marca no DOM
(`readyState` **não** serve), dado real incluindo o pior registro, e contagem de
nós batendo com a página aberta à mão. Medida tirada antes disso não é da tela,
é do compilador — e some sozinha na rodada seguinte.

Depois, e só depois. O que não rodou vai escrito no relatório:

| Checagem | Como |
|---|---|
| tipos e lint | `npx tsc --noEmit` e o lint do repo. **Nunca `next build` com o dev de pé** (quebra o `.next`). |
| estouro horizontal | `$V` (coluna `estouro`): `scrollWidth - clientWidth` **do documento** a 390px, e remedir depois de cada conserto. No elemento não vale: um blob decorativo sob `overflow-hidden` já virou 64px de estouro que não existia |
| **texto cortado e overlay empilhado** | `$V` (coluna `corta`), ou `corta-scan.js` (`$T`) colado no console: acha palavra comida pelo pai que recorta, overlay que cobre outro no mesmo canto, e peça que saiu da caixa. É o que nenhum detector estático vê — a largura de uma palavra só existe depois de a fonte carregar |
| distribuição | a página existe fora dela mesma? `title`, `description`, card de compartilhamento, evento de conversão, `sitemap`, `robots`. Ver [references/distribuicao.md](references/distribuicao.md) |
| dado real | tela com o melhor registro e com o pior; vazio esconde todo estouro |
| tema claro | `$V --theme both`. O app é dark-first: o claro quebra onde ninguém olha |
| falha de backend | rodar com o backend parado. Zero silencioso é a mentira dominante: fetch que falha e pinta "0" é indistinguível de zero verdadeiro |
| teclado | `focus-visible` alcança tudo que o hover revela |
| feel | DevTools, Animations, 25% de velocidade |

Estouro, corte, chave crua e console saem do `verify-screens.mjs` de uma vez;
detalhe de cada checagem em `visant-frontend/references/verification.md`.

## Passo 6 — Relatório

É o mesmo `AUDIT.md` do Passo 2, agora com achados e nota — nunca só texto no
chat, e a nota vem antes do detalhe. Template e critério:
[references/scorecard.md](references/scorecard.md). A nota é uma nota, não um
elogio: 100 no portão com T3 sem interrogatório de posicionamento é auditoria
incompleta, e o relatório precisa dizer isso.

## Não fazer

- Nota alta declarada sem rodar o script, ou "passada completa" com a tabela de
  superfícies em branco. O placar vem do processo, não da vibe.
- Componente novo de design system sem autorização explícita. Reusar e
  parametrizar; se falta primitivo, instalar o oficial (`npx shadcn@latest add`)
  e avisar antes.
- Consertar folha antes de raiz (Passo 0, `--roots`).
- Abrir rota que gasta crédito ao carregar sem a trava do `verify-screens`.
- Refatorar em cima de defeito relatado sem confirmar no código. Diagnóstico é
  `arquivo:linha`, não opinião.
- Declarar pronto sem ter aberto a tela. É a linha que este documento inteiro
  existe pra defender.
- Aplicar em produto de aposta, cassino ou jogo de azar. Recusar e explicar: é
  condição de reuso do `revenue-centric-design`, não gosto.
