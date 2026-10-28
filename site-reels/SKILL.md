---
name: site-reels
description: 'Grava as melhores cenas de um site/app web (hero WebGL, 3D, scroll, wordmark) em MP4 1080p pra deck e apresentação, sobe como slides ocultos no Figma Slides, e monta showreel de marca ou de produto (lançamento de app) em Remotion. Use em "gerar vídeo do site", "gravar as cenas do app", "render mp4 pro figma", "vídeo pro deck", "animação pro slide", "showreel", "vídeo de lançamento", "reel do produto", /site-reels.'
---

# Site Reels — site → MP4 → deck

Grava cenas roteirizadas de um site rodando local e entrega MP4 prontos pro Figma
(1920×1080, 30fps, x264, < 100MB). Motor validado: **puppeteer-core +
puppeteer-screen-recorder** (screencast CDP + ffmpeg). Nada de gravar tela.

## Rodar

```
mkdir <proj>-reels && cd <proj>-reels && npm init -y && npm i puppeteer-core puppeteer-screen-recorder
cp ~/.claude/skills/site-reels/scripts/scenes.example.mjs scenes.mjs   # edite as cenas
# no repo do site: npx next build && npx next start -p 3100   (produção: WebGL mais liso)
OUT="<pasta no Drive>/Videos" node ~/.claude/skills/site-reels/scripts/record.mjs scenes.mjs [cena ...]
```

Cada cena = `{ name, path, theme?, trim?, crf?, css?, prepare(page, ctx), act(page, ctx) }`.
`prepare` roda antes de gravar (rolar até a seção, esperar 3D carregar); `act` é o que
vai pro vídeo. `ctx` tem `wait`, `scrollTo(page, y|seletor, ms)` e
`scrollThrough(page, seletor|null, ms, de, até)` com easing. Intro que roda no load:
faça `page.reload()` dentro do `act` e use `trim` pra cortar o carregamento.

Roteiro que funciona pra marca: logo/hero intro (light e dark), troca de mídia da
hero, seção 3D com a câmera entrando pelo scroll, rota imersiva (caminhada), wordmark
do rodapé e um percurso completo da página. 5–7 cenas de 12–55s.

## Auditar antes de entregar (não confie no exit code)

- Folha de contato por vídeo: `ffmpeg -i x.mp4 -vf "fps=6/<dur>,scale=480:-1,tile=3x2" -frames:v 1 sheet.png` e **olhe**.
- Arquivo de 1MB pra 19s = cena em branco. Arquivo > 100MB = não entra no Figma (o `crf` da cena resolve; 24 pra cena com grão + rastro).
- Faixa do topo (`crop=1920:120:0:0`) em vários tempos pra caçar nav vazando.

## Armadilhas já pagas

1. **Janela oculta congela o rAF** → quadros parados. O launch já passa
   `--disable-backgrounding-occluded-windows --disable-renderer-backgrounding
   --disable-background-timer-throttling --disable-features=CalculateNativeWinOcclusion`.
   `headless: false` de propósito: headless cai no SwiftShader e o WebGL engasga.
2. **CSS de esconder UI some** com o reload e com a hidratação do React limpando o
   `<head>` → o script reanexa um `<style id="reels-hide">` no body a cada 100ms.
3. **Um seletor inválido derruba a regra inteira**: `\[` num template literal JS vira `[`
   e `.z-[60]` invalida `header, nav, .z-[60]`. Uma regra por seletor arriscado.
4. **Não esconda `[data-cursor]`**: sites marcam o canvas 3D e carrosséis com ele.
   Mire no elemento do cursor custom (fixed + mix-blend + pointer-events-none).
5. **3D carregado sob demanda** (IntersectionObserver + import dinâmico): espere
   5–7s depois de chegar na seção. Ler o canvas WebGL pra checar volta vazio sem
   `preserveDrawingBuffer` — use espera fixa ou screenshot.
6. Screencast entrega ~32 quadros únicos/s → **grave em 30fps** (60 fica com
   quadro repetido irregular). `trim` padrão 0,3s tira o 1º quadro em cache.
7. **Screencast engasga com a máquina carregada** (Photoshop aberto, render em
   paralelo): o MP4 sai "30fps" com 9–18 quadros únicos/s e o usuário vê travado.
   O `record.mjs` mede (`mpdecimate=hi=64:lo=24:frac=0.05`) e regrava até 2x abaixo
   de `MIN_FPS` (24). Pra placa de WebGL/3D, prefira o `snap.mjs` (abaixo).

## Placas em 60fps cravado: `snap.mjs` (determinístico)

`scripts/snap.mjs` injeta o **timeweb** (o relógio virtual do timesnap: rAF,
performance.now, setTimeout e vídeo), avança 1/60s por quadro e fotografa. Não depende
da carga da máquina. Cena: `{ name, path, theme, css, dur, wait (ms reais pra carregar 3D),
pre (ms virtuais antes de rolar, 2000; **0 pra intro que roda no load**), start (s virtuais
pulados), scroll: { sel, from, to, at, len } | { bottom: [de, até] em alturas de tela },
frame(page, t) (ex.: mouse) }`. A rolagem é função do tempo virtual.

```
npm i puppeteer-core timesnap && mkdir -p scripts && cp ~/.claude/skills/site-reels/scripts/patch-timeweb.mjs scripts/
npm pkg set scripts.postinstall="node scripts/patch-timeweb.mjs" && npm run postinstall
FPS=60 OUT=... node ~/.claude/skills/site-reels/scripts/snap.mjs scenes-snap.mjs [cena]
```

- **Não use o `timesnap()` em si**: com Next + R3F + Lenis ele grava a página em
  branco, e no hero WebGL deixa trechos congelados (rAF não roda). O laço próprio
  (goTo + scrollTo + screenshot) funcionou em tudo: 60/60 quadros únicos.
- **Patch do timeweb obrigatório**: ele troca `video.play()` por versão sem Promise e
  sem evento `playing` → `video.play().catch()` estoura e a página fica em branco.
- `preserveDrawingBuffer: true` forçado no getContext (desligue com `preserve: false`).
- Quadros vão pro tmp, nunca pro Drive (milhares de jpg sincronizando).
- **Nada de GPU em paralelo** (render Remotion, Photoshop): o WebGL perde o contexto
  e grava segundos só com o fundo. O script avisa `FLASH` (quadro piscando por
  luminância); trecho longo em branco só aparece na folha de contato. Olhe.
- Auditoria de fluidez de verdade: `magick compare -metric MAE` entre quadros
  vizinhos em resolução cheia. 0 = quadro repetido.
- Entrega: `entrega.sh` (no projeto de referência) gera reveals, loops (`loop.sh`) e
  3D limpo subindo o crf de 3 em 3 até < 95MB.

## Subir no Figma Slides (oculto, sem atrapalhar o time)

O MP4 **não entra por MCP**: o `use_figma` não tem rede e o Plugin API não cria
vídeo por bytes; o `upload_assets` só aceita imagem (≤ 10MB). Então:

1. Capa de cada vídeo: `ffmpeg -ss <t> -i x.mp4 -frames:v 1 -q:v 2 _capas/x.jpg`.
2. `use_figma` (skills `figma-use` + `figma-use-slides`): `createSlideRow(idx)` antes
   do slide final, `row.name = 'WIP · Motion (oculto)'`, um `createSlide(idx, i)` por
   vídeo com `isSkippedSlide = true`, fundo preto, retângulo 1920×1080 chamado
   `VIDEO · x.mp4` e a instrução nas `speakerNotes`.
3. `upload_assets` com `nodeIds` dos retângulos → POST multipart das capas.
4. O usuário arrasta o MP4 do Drive em cima do retângulo (troca a capa pelo vídeo).
   Diga isso claramente; não prometa vídeo inserido.

`getSlideGrid()` omite slides pulados: confira a estrutura por
`SLIDE_GRID.children[i].children`.

Origem: cliente Y (out/2026), 7 vídeos aprovados; projeto de referência em `D:\dev\marca-reels`.

## Brand showreel (Remotion) — placas + cenas desenhadas

Quando pedirem showreel de branding (logo, cores, tipografia, layouts, manifesto,
mockups), grave só **placas limpas** do site (sem texto: CSS por cena esconde
título/nav) e componha o resto em **Remotion** (render quadro a quadro, sem tremido).
Referência pronta: `D:\dev\marca-showreel` (copie `src/fx.tsx` — `Mist`,
`MistWords`, `Grain`, `KenBurns`, `Plate`, transição `nevoa()` — e troque `brand.ts`).

- **IDV vem do deck, não do site**: confira tipografia e paleta oficiais nos slides
  (o site da cliente Y usava Mozilla Text; a IDV é Zalando Sans).
- Cenas que funcionam: abertura com frase em névoa, reveal gravado, construção do
  logo (`evolvePath` + guias medidas no raster do logo), manifesto frase a frase,
  pilares com eixo `wght` variável, paleta em faixas, tipografia, grafismo em
  camadas, 3D com título em `mix-blend-difference`, colunas de layouts correndo,
  montagem de mockups 1/2/3 quadros, produto sincronizado com o nome, fecho com wordmark.
- Revise por **stills** (`npx remotion still ... --frame=N` + montage) antes de renderizar.
- Render com `--concurrency=3`. Com 8, mais o Photoshop aberto, a máquina de 32GB
  ficou sem memória e o Claude Code matou a tarefa.
- Loops: `scripts/loop.sh in out [inicio] [dur] [crossfade]`. Confira a emenda com
  `magick compare -metric RMSE` entre o 1º e o último quadro (< 0,5% = invisível).
- Placa ruim é descarte: objeto de revolução girando não mostra movimento; câmera
  enquadrada pra canvas retrato fica pequena em 16:9.
- **Reel frenético (o que o usuário aprovou como ritmo, ref. Arko® Brand Reel)**: 25–35s,
  60fps, `Series` com corte seco em grade de 120 BPM (30 quadros), rajadas de imagem a
  cada 3–6 quadros, crop gigante do logo sobre grid, pesos de fonte piscando, blocos da
  paleta se rearranjando, retrato em máscara circular, burst de grafismo, frase cinética,
  mockups de 1 batida, fecho com logo parado ~2,5s. **Zero label**: texto só como grafismo.
  Referência: `D:\dev\marca-showreel\src\reel.tsx`. Showreel lento de 1:40 foi reprovado.
- **Reel suave/esfumaçado (v2, cliente Y)**: grave a fumaça do hero **sem logo nem foto**, preto no
  branco puro (cena com `storage` = params no localStorage e `block: ['assets/logo.png']`; o PNG
  vazio tem que ser transparente; **não bloqueie o vídeo**: vídeo quebrado trava o timeweb). Use a
  placa como overlay `mix-blend-mode: multiply`: abre no começo da cena, versão invertida
  (`ffmpeg -vf reverse`) fecha no fim; o corte cai no preto. Transição a ~1,1s (rate 2), senão a
  cena vira metade preta. Referência: `D:\dev\marca-showreel\src\reel2.tsx`.
- **Layouts do Figma Slides se montando**: clone o slide (pulado), duplique cada card 3x com só
  fundo / logo / texto visível, baixe cada nó por `download_assets` (scale 2) e apague os clones.
  Slides **não exporta transparência** (vem com o fundo do slide): exporte logo/texto com o slide
  preto e depois branco e tire o alfa por diferença (`layers-src/matte.mjs`, ImageMagick). Não
  devolva base64 pelo `use_figma` (estoura contexto).

## Showreel de produto (app real filmado) — produto B, out/2026

Referência: `D:\dev\produto-showreel`. As telas são filmadas de verdade (`scripts/capture.mjs`:
Playwright + screencast CDP em 2x, passos `goto/move/click/type/scroll/wait`, rastro do ponteiro em
`public/clips/<id>.cursor.json`) e o cursor é redesenhado no Remotion por cima. Corte atual:
`src/v6/Punch.tsx`; render + loudness: `pwsh -File scripts/render-fast.ps1 -Only <corte>`.

**O que o usuário reprovou (não repita):**
- **Colar o reel desenhado com a tela real** (abertura ilustrada + meio filmado + CTA desenhado):
  duas linguagens, o personagem some e volta, a cartela preta entre os atos para o ritmo. Uma
  linguagem por vídeo.
- **Tela do produto pequena e acelerada** numa janela 16:9: o feed e o ranking viram um paredão
  ilegível.
- **Zoom que corta a tela** (tela cheia com crop na ação) e **texto carimbado por cima** do vídeo
  (verbo gigante, contador 01/07, degradê): ficou intrusivo.
- Espera vazia na tela ("waiting…", "cole isso no seu bot"): corta direto pro momento da ação.
- Frase vaga ("Ele chega sozinho."): a copy tem que ser óbvia e brasileira ("Ele mesmo cria o perfil.").

**A forma que funciona:** por ação, **primeiro o texto sozinho**, centralizado e curto (2 batidas),
**depois a tela inteira, sem corte**, numa janela centralizada no aspecto da captura, sobre fundo
limpo. Texto discreto (peso 700, entrada por palavra com blur leve, ponto final em ciano), sem
contador e sem degradê. Cortes na grade da trilha (14 quadros = 128,57 BPM). No máximo 40s.

**Técnica que já se pagou:**
- Acelerar captura: `<OffthreadVideo trimBefore={from} playbackRate={rate}>` e recalcular os
  quadros de clique `/ rate` (som e anel do cursor).
- Começar outra composição no meio: `<Sequence from={X}><Sequence from={-inicio}><Comp/></Sequence></Sequence>`.
  Confira o 1º quadro do trecho: elemento compartilhado "voando" (o rosto vindo do painel anterior)
  aparece solto. Pule uns quadros e recoloque o som de impacto que ficou antes.
- Idioma de composição com timeline no módulo: flag em `globalThis` setada por um entry próprio
  (`src/pt.ts` importa `pt-flag.ts` antes do Root), igual ao teaser.
- Trilha contínua entre cortes: `trimBefore` no bed pra seguir do quadro onde o trecho anterior parou.
- Loudness: renderiza, mede e normaliza com `loudnorm` em 2 passes (-14 LUFS / -1 dBTP), copiando o
  vídeo. Medir só no fim: o mix bruto do Remotion passa de 0 dBFS.
- Auditoria: folha de contato com timestamp (`fps=2,drawtext=%{pts\:hms},tile=8x6`) de cada render,
  e uma folha densa (fps=6) em toda junção de trecho.
- Link do Drive sem navegador logado: o id da pasta sai do banco do Drive para desktop
  (`%LOCALAPPDATA%\Google\DriveFS\<conta>\mirror_metadata_sqlite.db`, tabela `items`, coluna `id`,
  abra **read-only**). URL: `https://drive.google.com/drive/folders/<id>`.
- Anexo no chat do OpenBot não aceita MP4: remuxe pra `.mov` (`-c copy`) e anexe da pasta do agente.
- O projeto não tem git e outra sessão pode editar ao mesmo tempo: corte novo em arquivo novo,
  backup `*.bak-*` antes de editar arquivo compartilhado, e avise o usuário.

## Cards de portfolio e reel de estúdio (cliente T, out/2026)
Referência: `Shared\cliente-t\motion\` (README + tools) e `D:\dev\estudio-cliente\reels` (cenas) / `D:\dev\estudio-cliente\motion` (Remotion).
- `record.mjs` agora aceita env `W`, `H`, `DPR`, `MOBILE=1` (toque) e `KEEP_UI=1` (mantém a nav: card mostra o site
  como ele é). Celular 4:5: `W=360 H=450 DPR=2 MOBILE=1` → 720x900. Rode o script **copiado pro projeto**: ESM resolve
  `puppeteer-core` a partir da pasta do script, não do cwd.
- Cenas geradas do inventário (`portfolio.json`, só `publico:true` e com URL); sem URL viva = Ken Burns do screenshot.
- Aceite o banner de cookies no `prepare` (clique genérico em "Aceitar/Accept/OK") antes de gravar.
- Ferramenta sem rolagem (gerador, editor de efeito) grava parada: a cena tem que **interagir** (subir arquivo no
  `input[type=file]`, clicar os presets por texto do botão). Slider custom não responde a `input` sintético.
- `LOW-FPS` com pausa longa no começo/fim é falso alarme (o medidor conta quadro parado); olhe a folha de contato.
- Pacote do card: loop por crossfade do fim no começo, 2 passes de bitrate pelo teto em KB, WebM VP9 junto, poster
  WebP do 1º quadro. Script: `Shared\cliente-t\motion\tools\pack-cards.ps1`.
- PowerShell: variável ignora caixa (`$d` sobrescreve `$D`) e `R` é alias do `Invoke-History`. Nomes únicos.
- Logo com alpha pro site: `--codec=vp9 --pixel-format=yuva420p` (Safari não toca) + ProRes 4444 pra edição;
  `Config.setVideoImageFormat("png")` pra manter o alpha.
- Estética recorte/stop-motion no Remotion: tempo quantizado em dois (24 fps, pose a cada 2 quadros), filtro SVG por
  pose (feTurbulence + feDisplacementMap na borda, feMorphology pra borda creme, sombra dura offset) com 3 seeds em
  ciclo ("boil"), textura de papel em multiply. Peças do mascote lidas por id do SVG do designer (DOMParser), então a
  versão nova do branding entra sem mexer no código.
- Trilha CC0 que serviu: Free Music Archive, John Bartmann (álbum CC0). O MP3 sai do `fileUrl` no HTML da página da
  faixa. Andamento e trecho mais cheio com `librosa.beat.beat_track` + RMS por janela.
