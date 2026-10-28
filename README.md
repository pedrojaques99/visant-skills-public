# visant-skills-public

Skills de [Claude Code](https://docs.claude.com/en/docs/claude-code/skills) da
[Visant](https://visantlabs.com): como a casa decide interface, motion e copy,
como audita uma tela antes do PR, e como monta vídeo, do site gravado ao bruto
no Premiere. Os detectores rodam de verdade: `npm test` exercita cada um contra
fixture.

As skills estão em português (a `visant-motion` e a `visant-frontend` em inglês).

## Instalar

```bash
npx skills add pedrojaques99/visant-skills-public                       # escolhe na lista
npx skills add pedrojaques99/visant-skills-public --skill visant-killer # só uma
```

Ou na mão: copie a pasta da skill pra `~/.claude/skills/`. No Windows,
`mklink /J %USERPROFILE%\.claude\skills\visant-killer <repo>\visant-killer`
mantém uma cópia só e o `git pull` atualiza.

## Junto com a library

As skills de interface mandam buscar peça pronta antes de escrever uma:
[**@visant/ui**](https://ui.visantlabs.com), 150+ componentes React num registry
shadcn, já passados pela `visant-killer`. O código vem pro seu projeto, não é
pacote npm.

```bash
# components.json → "registries": { "@visant": "https://ui.visantlabs.com/r/{name}.json" }
npx shadcn@latest add @visant/gauge
```

Índice pra agente: [ui.visantlabs.com/llms.txt](https://ui.visantlabs.com/llms.txt).

## Interface

| Skill | Pra quê |
|---|---|
| [`visant-killer`](visant-killer/SKILL.md) | **comece por aqui.** Auditoria de UI anti-slop: detectores como portão duro, julgamento pelas skills abaixo, advogado do diabo e nota |
| [`visant-frontend`](visant-frontend/SKILL.md) | decisão de interface: cada elemento nomeia a variável de negócio que move, ou sai |
| [`visant-motion`](visant-motion/SKILL.md) | tokens de easing/duração em CSS e framer-motion, `motion-lint`, medição de URL |
| [`visant-refine`](visant-refine/SKILL.md) | gráfico, gauge, sparkline, slider e tile de métrica com anatomia própria |
| [`visant-copy`](visant-copy/SKILL.md) | copy na voz falada brasileira, com `copy-lint` contra vício de IA |

## Vídeo e motion

| Skill | Pra quê |
|---|---|
| [`site-reels`](site-reels/SKILL.md) | grava as cenas de um site (hero WebGL, scroll, 3D) em MP4 1080p e monta showreel de marca ou de produto em Remotion |
| [`visant-premiere-editor`](visant-premiere-editor/SKILL.md) | monta o bruto no Premiere Pro a partir de um plano de corte em JSON: corte em quadro exato, marcadores, punch-in, card, b-roll, entrega a -14 LUFS |
| [`visant-video-editor`](visant-video-editor/SKILL.md) | vlog, vídeo de evento e vídeo-aula a partir de mídia bruta: decupagem, corte de silêncio, loudness, capítulos, com self-test contra falha silenciosa |

## Processo

| Skill | Pra quê |
|---|---|
| [`metodologia-visant`](metodologia-visant/SKILL.md) | as 9 etapas de construção de marca e a cascata de dependências |
| [`visant-preflight`](visant-preflight/SKILL.md) | pré-voo de projeto grande: perguntas ao dono + cinco checagens de premissa |
| [`visant-mcp-connect`](visant-mcp-connect/SKILL.md) | conectar e operar o MCP do Visant Labs |

Algumas skills citam skills da casa que não são públicas (ex.: `visant-registry`,
`visant-comercial`). Dá pra ignorar a menção.

## Rodar os detectores

Node 20+, sem build.

```bash
npm install
npm test                                           # self-test de todos os detectores
node visant-killer/scripts/killer-scan.mjs <app>   # o portão inteiro
node visant-motion/scripts/motion-lint.mjs <app>
node visant-copy/scripts/copy-lint.mjs <arquivo>
bash visant-video-editor/scripts/self-test.sh      # precisa de ffmpeg
```

## Créditos

Boa parte disto se apoia em trabalho de outras pessoas. Cada skill cita a sua
fonte no próprio texto; o resumo:

| O quê | De quem | Onde entra |
|---|---|---|
| [impeccable](https://impeccable.style) | Paul Bakaus ([pbakaus/impeccable](https://github.com/pbakaus/impeccable)) | portão do `visant-killer` |
| [revenue-centric-design](https://github.com/heliocosta-dev/revenue-centric-design) | princípios de Richard ([@richardrx](https://x.com/richardrx)), empacotados por heliocosta-dev | `visant-frontend`, `visant-killer` |
| [Emil Kowalski skills](https://github.com/emilkowalski/skills) | Emil Kowalski ([animations.dev](https://animations.dev)) | princípios da `visant-motion` |
| [agent-skills](https://github.com/vercel-labs/agent-skills) (`vercel-react-view-transitions`) | Vercel | `visant-motion` |
| [premiere-pro-mcp](https://github.com/leancoderkavy/premiere-pro-mcp) | contribuidores do premiere-pro-mcp | `visant-premiere-editor` |
| [OpenTimelineIO](https://opentimeline.io) | Academy Software Foundation | `visant-premiere-editor` (FCP7 XML) |
| [Simple Icons](https://simpleicons.org) (CC0) | contribuidores do Simple Icons; as marcas são de seus donos | logos dos cards da `visant-premiere-editor` |
| [Remotion](https://www.remotion.dev), [puppeteer-screen-recorder](https://github.com/prasanaworld/puppeteer-screen-recorder), timesnap | Remotion; prasanaworld; Tungs | `site-reels` |
| [FFmpeg](https://ffmpeg.org), [auto-editor](https://github.com/WyattBlue/auto-editor), [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | FFmpeg; WyattBlue; SYSTRAN | `visant-video-editor` |
| [shadcn/ui](https://ui.shadcn.com), [Radix](https://www.radix-ui.com), [Playwright](https://playwright.dev) | shadcn; WorkOS; Microsoft | `visant-killer`, `visant-frontend` |

Faltou alguém? Abra uma issue.

## Como este repo é feito

Este repo é a fonte: as skills daqui não existem em nenhum outro lugar. As
skills operacionais da casa (comercial, demanda e marca de cliente) moram num
repo privado, e todo commit daqui passa por um portão que barra nome de cliente
e por scanner de segredo ([gitleaks](https://github.com/gitleaks/gitleaks)).
Caso real de cliente aparece anonimizado ("cliente K"). PR é bem-vindo.

```bash
node link.mjs            # o que em ~/.claude/skills já aponta pra cá (Windows, junction)
node link.mjs --apply    # aponta (exige repo limpo no git)
```

## Licença

MIT, ver [LICENSE](LICENSE). Ferramentas e skills de terceiros citadas acima
seguem as licenças delas.
