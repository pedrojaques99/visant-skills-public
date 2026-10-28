---
name: visant-premiere-editor
description: 'Monta o bruto no Premiere Pro pelo premiere-pro-mcp a partir de um plano de corte em json: corte em quadro exato, marcador, punch-in, card e b-roll, e a entrega a -14 LUFS. Use em "monta no Premiere", "sequência do bruto", "marcadores pra narrar", "punch-in no Premiere", "põe card/aviso/logo", "cobre com b-roll", "exporta as aulas", /visant-premiere-editor.'
---

# Visant Premiere Editor

O agente monta o bruto; o dono refina no Premiere. Nada de trilha, cor ou b-roll
no bruto, a não ser que o dono peça.

Entrada: um plano de corte em json (formato no topo de `scripts/premiere_xml.py`).
Quem gera o plano é outra etapa: decupagem e corte por fala na
`visant-video-editor`, ou os scripts do projeto (`aula_tela.py`, `premiere_plano.py`).
Esta skill não decide corte, só leva o plano pro Premiere sem perder quadro.

> **Regra zero: nunca montar corte a corte pelo MCP.** `create_subclip` +
> `create_sequence_from_clips` erra 1 quadro por ponta (o Premiere arredonda
> segundos pra baixo) e subclip de PNG vira 12 horas. O caminho é XML.

## Fluxo

0. **O dono pode estar com o Premiere na mão.** `set_active_sequence` troca a
   tela dele, e o node ID de clipe muda quando a sequência ativa muda. Antes de
   cada edição, releia o ID com `get_clip_at_position`, e avise antes de uma
   rodada de mudanças.
1. **Conexão, só leitura.** `verify_premiere_connection` (backend `cep`) e
   `get_project_info`. Se uma chamada vencer em 120 s, tem janela aberta no
   Premiere: peça pro dono fechar e não dispare mais nada até ele fechar.
2. **Conferir a fonte** com `ffprobe`: resolução, fps (`r_frame_rate` e
   `avg_frame_rate`), se tem áudio, rotação. MOV de iPhone é VFR, e o Premiere
   interpreta a 29,9992.
3. **Gerar o XML**: `python scripts/premiere_xml.py <plano.json> --saida <dir>`.
   Precisa de `opentimelineio` e `otio-fcp-adapter` (pip).
4. **Importar no projeto aberto**: `import_media` com o `.xml` (`suppress_ui: true`).
   Não use `import_fcp_xml`, que cria OUTRO projeto. Uma aula por chamada.
5. **Religar**: a mídia do XML entra offline mesmo com o caminho certo.
   `search_project_items` com `offline_only`, depois `relink_media` de cada item
   no mesmo caminho. Até 4 em paralelo funciona.
6. **Punch-in** (só plano de rosto): `python scripts/premiere_xml.py --motion <plano.json>`
   dá a tabela. Aplique com `set_effect_property`, efeito `Movimento`, `Escala`
   (%) e `Posição` normalizada `[x/w, y/h]`. Em PT-BR o `set_clip_properties_batch`
   falha. Leia os nomes com `get_effect_properties` se o Premiere não for PT-BR.
   **Push-in animado** (só com aprovação do dono, mostrando antes a folha de
   quadros inicial e final): `add_keyframe` só aceita número, então a Posição
   não anima. Ponha o `Ponto de ancoragem` no rosto `[cx/w, cy/h]` e a `Posição`
   no alvo `[0.5, 0.38]`, e anime só a `Escala`. O tempo do keyframe é o da
   FONTE: use o `inPoint` do `get_clip_properties` e `inPoint + duração − 1 quadro`.
7. **Cor dos marcadores**: o XML não leva cor. Use `update_marker(time_seconds,
   color=1)` (vermelho) nos de plano; a fala fica no padrão (0, verde).
8. **Ler de volta e conferir**: `get_full_sequence_info`. Quando o resultado vai
   pra arquivo (saída grande), rode `python scripts/premiere_xml.py --conferir
   <plano.json> <arquivo>`. Quando vem inline, confira contagem de cortes, quadros
   totais, marcadores, formato e A1.
9. **Olhar o quadro**: `capture_frame` em 2 ou 3 pontos (um punch-in de cada
   escala e o corte mais suspeito) contra o render de referência, se houver.
   Posição encostada no limite do clamp é sinal de rosto mal detectado.
10. **Salvar** (`save_project`) e **arrumar**: sequências e mídias numa bin por
    entrega. A CEP não apaga item de projeto: o que for teste vai pra uma bin
    `_descartar (teste do agente)` e o nome da sequência ganha `[descartar]`,
    pro dono apagar.

## Apertar uma sequência já editada (pausa, arrasto, caco)

Quando o dono já mexeu na sequência à mão, **não regere pelo motor**: a edição
dele se perde. O caminho é XML de ida e volta, numa sequência nova ao lado:

1. `create_project_backup` do `.prproj`.
2. Pra cada aula: `set_active_sequence` (avise antes, troca a tela do dono) e
   `export_as_fcp_xml` pra `_apertada/aula-N.xml`.
3. `python aperta_final.py _apertada/aula-N.xml` (mora no projeto, ao lado do
   `aulas.py`, porque precisa do plano e do wav das fontes). Ele sai com
   `aula-N-apertada.xml` + `.cortes.tsv`, onde cada corte vem com o tempo, o
   motivo e a palavra.
4. `import_media` do XML apertado com `target_bin` (a bin do dono), mídias pra
   `<bin>/_mídia`, depois o passo 5 (religar) e o 8 (conferir). A original fica
   intacta pra comparar; reimportação leva `--sufixo v2` e não pisa na apertada
   que o dono já editou.

Regras do aperto: o silêncio é medido **pelo áudio** (< -45 dB), nunca pela
distância entre palavras do whisper, porque o whisper estica a palavra por cima
da pausa (o "or" da 1.1 tinha 4,7 s). Pausa > 0,15 s fica com 0,10 s. Arrasto
é palavra de até 3 letras com som contínuo > 0,40 s, medido dentro das bordas
do whisper, porque em fala corrida o som não para entre as palavras. Do arrasto
saem só o miolo da vogal, ficando 0,15 s de cabeça e 0,08 s de rabo. Selo e
rótulo só andam com o corte; o b-roll é cortado junto.
O script aborta quando a duração de uma peça `.mov` não bate com o plano: sinal
de que o plano do motor mudou depois do render e o mapa palavra→quadro está errado.

## Aprender com a edição do dono

Quando o dono corrige à mão uma sequência gerada (ex.: refez o fecho), não
adivinhe o que ele quis. Exporte a versão dele e compare com a sua:
`python aprende.py <meu.xml> <dono.xml>`. A comparação é por trecho do bruto,
e mostra o que ele DEVOLVEU, o que ele CORTOU A MAIS e quais palavras estão em
cada trecho. Pra repetir o fecho dele numa versão nova:
`aprende.py <novo.xml> <dono.xml> --fecho MM:SS.s <saida.xml> "<nome>"`. Os
clipes dele entram no fim com volume e corte, e o `masterclipid` é remapeado,
porque o id dele aponta pra outra mídia e o import trava. Mudança que se repete
vira número na skill ou linha no roteiro (`fecho.tsv`, `roteiro.tsv`), não
conserto à mão de novo.

Pra a edição dele sobreviver a toda versão nova: `aprende.py <meu> <dono> --grava`
escreve `edicao_dono.tsv` (corta/mantém por trecho do bruto) e o `aperta_final`
repete sozinho. Trecho chato (ditar prompt) vira rampa: linha no `rampas.tsv`
(`rampa.py`: acelera em degraus até 3x, voz sempre audível, sem zoom — o dono faz
o zoom à mão — e selo ACELERADO).

Corte de conteúdo (rodeio, frase dita duas vezes, tropeço) é do agente e fica
separado: `fala.py <modulo> <aula>` imprime a fala por frase com o tempo da fonte;
`agente.py <modulo> <aula> <fonte> "começo|fim" ... --grava` acha o trecho pelo
texto e escreve `edicao_agente.tsv`, que o `aperta_final` lê junto do do dono.
Corte que muda promessa (curso citado, preço, prazo) entra, mas vai pra pergunta.

## Cards: aviso e logo, feitos no Figma

O card nasce no deck da aula (Figma Slides), nunca desenhado no Premiere:
1. `python scripts/figma_cards.py <lote.json> <lote.js>` (formato no topo do script; ícones em
   `scripts/icones/`, Simple Icons CC0 com a cor oficial; marca que não está lá entra como texto).
2. Rodar o JS com `use_figma` (skills `figma-use`, `figma-use-slides`). Cada aula ganha uma linha
   `Edição N (não apresentar)`; se a linha encher, abre `Edição N b`.
3. `get_screenshot` com `contentsOnly` de cada card → PNG em `_build/aulaN/sobre/`.
4. No Premiere: `import_media`, `overwrite_clip` na trilha MAIS ALTA livre, `set_clip_duration`,
   `set_effect_property` (Posição normalizada, Escala), fade da casa (`references/armadilhas.md`).
   Achar o segundo da fala: `onde.py <modulo> <aula> <xml|estrutura.json> "frase"`.
Card que repete o que o slide já mostra não entra.

## Cobrir fala com b-roll e timelapse

(`onde.py`, `fonte_iphone.py`, `entrega.py`, `trecho.py` moram no projeto, ao lado do `aulas.py`.)

Trecho de rosto longo sem tela pede b-roll. Regras:
- **Cópia só vídeo** (`ffmpeg -an`) de cada b-roll: o áudio da câmera nunca entra na A1.
- **Cortar o pedaço exato no ffmpeg** (`cortes/<aula>_<tl>_<fonte>.mov`) e colocar inteiro:
  `set_item_in_out` não aplica o in nesta versão.
- Trilha acima do rosto e abaixo dos cards; nunca por cima de um card ou rótulo do motor.
- **Olhar cada quadro antes**: barra lateral do Claude, seletor de conta, e-mail, nome de cliente.
  Borrar (`boxblur` na região) ou trocar de b-roll. Na dúvida, troca.
- Fonte de iPhone: `fonte_iphone.py` (HDR→SDR e rotação) ANTES do `trecho.py`.

## Trocar uma peça renderizada que já está na sequência

Peça refeita (corte de fala, cor) sai com NOME NOVO (`-2.mov`): reimportar o mesmo caminho é ignorado.
`import_media` → `remove_from_timeline` do vídeo E do áudio (saem separados) → `overwrite_clip` em 0 →
`get_sequence_structure` pra conferir a duração. Job do Media Encoder já na fila guarda a versão
antiga: ponha um job novo com outro nome e peça pro dono apagar o velho.

## Entrega

1. Nome da sequência é o nome do arquivo: `Aula N · Título`, sem `v2`/`apertada`/`nova`.
   O `aperta_final` sai com `· nova`; o dono aprova e o sufixo sai.
2. `save_project`, `check_offline_media` = 0, e por aula: `set_active_sequence` →
   `add_to_render_queue` (preset `01 - Match Source - High bitrate`, saída `<N · Título>.mp4`,
   sem `?` no nome) e `start_batch_encode` (o dono não precisa apertar ▶). O MP4 sai com a
   sequência inteira: aparar o preto do fim com `ffmpeg -t ... -c copy`. Vigiar com `sensor_export.py`.
3. `python entrega.py <pasta export> <pasta final>`: loudnorm 2 passes a -14 LUFS / -1,5 dBTP com o
   vídeo copiado, depois `.srt`/`.vtt` pelo `legenda_whisper.py`. Roda de novo só no que falta.

## Relatório

Uma tabela por sequência: cortes, quadros, duração vs plano, marcadores, formato,
faixas. Diga o que mudou em relação ao plano (quadro puxado, marcador empurrado,
posição corrigida à mão) e mande a correção pra quem gera o plano.

Armadilhas medidas, com causa e conserto: `references/armadilhas.md`. Leia antes
da primeira importação da sessão.
