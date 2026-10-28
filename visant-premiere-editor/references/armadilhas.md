# Armadilhas medidas (Premiere 2026 PT-BR + premiere-pro-mcp 1.17, CEP)

Todas vistas na montagem do curso IA para Designers (23/09/2026).

| Sintoma | Causa | Conserto |
|---|---|---|
| in/out 1 quadro antes do plano | `create_subclip` recebe segundos e o Premiere arredonda pra baixo (9.2083 × 24 = 220,999 → 220) | XML com quadro inteiro (`premiere_xml.py`) |
| still com 43200 s (12 h) | subclip de PNG ignora in/out | still no XML com `duracao_s` |
| sequência 720x480, tela com largura 90,9% | XML sem `<format>`: o Premiere cai no NTSC D1 e corrige pixel não quadrado | `<format><samplecharacteristics>` com w/h, `square`, `fielddominance none` (o script já põe) |
| mídia `\\\Z:\...` offline + janela modal que trava tudo | `pathurl` `file:///Z:/...` | `file://localhost/Z%3A/...` (o script já faz) |
| mídia offline com o caminho CERTO | a importação de XML não resolve o arquivo sozinha | `relink_media` no mesmo caminho |
| `import_fcp_xml` cria projeto novo | usa `app.openFCPXML` | `import_media` com o `.xml` |
| marcador sumido | dois marcadores no mesmo quadro: às vezes o Premiere descarta um | um quadro por marcador (o script empurra a fala +1 quadro) |
| marcador sem cor | FCP7 XML não carrega cor pro Premiere | `update_marker(time, color)`: 0 verde, 1 vermelho, 2 roxo, 3 laranja, 4 amarelo, 5 branco, 6 azul, 7 ciano |
| `set_clip_properties_batch`: "Motion Scale is unavailable" | Premiere em PT-BR: "Movimento/Escala/Posição" | `set_effect_property` com os nomes locais |
| clipe em Posição (960,540) virou canto | Posição do Movimento é normalizada | `[x/w, y/h]` |
| `create_sequence_from_clips` com nome "1" | a ferramenta corta o nome no primeiro ponto ("1.1 A primeira...") | nome vem do XML |
| `Could not verify the Windows ACL ... spawnSync powershell.exe ETIMEDOUT` | checagem de permissão antes do envio; nada foi executado | repetir a chamada; mais comum com muitas em paralelo |
| toda chamada vence em 120 s | janela modal aberta no Premiere | o dono fecha; depois conferir se o comando entrou (`list_sequences`) |
| "Legacy CEP cannot safely delete project item" | a CEP não apaga item | bin `_descartar` + nome `[descartar]` |
| sequência a 29,9992 fps | MOV de iPhone é VFR e a sequência herda a média | aceitável pra rosto; se precisar de 30 cravado, o XML define o timebase |
| `export_sequence_review_frames` "did not write any frames" | falha dessa ferramenta nesta versão | `capture_frame(time_seconds)`, que às vezes falha e passa na segunda |
| duração da sequência 0,3 a 0,7 s menor que `duracao_s` do plano | o plano somou segundos quebrados e `fonte_in_f/out_f` é round de cada ponta | por corte fica abaixo de 1 quadro; avise quem gera o plano pra somar em quadros |
| keyframe aplicado e o clipe não anima | `add_keyframe(time_seconds)` conta no tempo da FONTE, não do clipe (0 s fica antes do in) | `inPoint` do `get_clip_properties` |
| `add_keyframe` recusa a Posição | aceita só número | âncora no rosto + Posição fixa no alvo, anima só a Escala |
| "Clip not found" com ID que funcionava; leitura de clipe de outra sequência | o node ID muda quando a sequência ativa muda (o dono clicando no Premiere também muda) | `get_clip_at_position` logo antes de cada operação |
| sequência com 3 s de silêncio que o motor "já apertou" | o whisper estica a palavra por cima da pausa; quem mede pausa por `ws[j].s - ws[i].e` não vê o buraco | silêncio pela energia do wav (`aperta_final.py`, `silencios()`) |
| `import_media` de XML vence em 120 s e nada entra | XML com `<file id>` vazio na 1ª aparição (o clipe que carregava a definição foi apagado no corte) e sem `<!DOCTYPE xmeml>` | a 1ª aparição de cada id leva o `<file>` completo (`completo()` no `aperta_final.py`); conferir com `list_sequences` antes de repetir |
| "duplicou": cada import de XML traz uma cópia de toda mídia da sequência | o Premiere não reaproveita clipe-mestre no import de XML, e apagar a cópia tira o clipe da timeline | `import_media` com `target_bin`, depois `move_items_to_bin` das mídias pra `<bin>/_mídia`; só a sequência fica à vista |
| import do XML com clipe copiado de outra exportação trava em 120 s | `masterclipid` do outro XML aponta pra outra mídia (ou pra nenhuma) | remapear pro masterclip que o XML de destino já usa pro mesmo arquivo (`aprende.py` faz) |
| import de XML vence em 120 s e aparece "Resultados da conversão de FCP" | o Premiere abriu o relatório de conversão (modal) por efeito que não converte, ex. `Efeito <>` sem nome em clipe copiado de outra exportação | tirar `<filter>` com `effect/name` vazio antes de importar; o relatório fica em Documentos e entra na bin |
| export_as_fcp_xml vence em 120 s e o XML sai cortado no meio | "Relatórios de tradução": o Premiere abre um aviso modal ao EXPORTAR XML com algo que não traduz | o dono clica OK; conferir se o arquivo termina em </xmeml> antes de ler, e exportar de novo |
| import_media diz ok e a sequência não aparece | o Premiere ignora reimportar um XML no MESMO caminho de um já importado | cada versão num arquivo próprio (`aula-N-apertada-vK.xml`) |
| clipe renderizado entra a 59,59 qps e mais longo | concat de pedaços acelerados (setpts/vel) deixa buraco de tempo na emenda | `fps=60,setpts=N/(60*TB)` depois do concat; conferir `avg_frame_rate` = 60/1 com ffprobe |
| sobreposição (slide, logo) empurrou a aula inteira | `add_to_timeline` é INSERÇÃO com ripple nas trilhas sync-locked | `overwrite_clip` numa trilha vazia + `set_clip_duration` (still entra com 5 s); PNG sem áudio não toca a A1 |
| conexão segue travada depois do OK no aviso | a fila de comandos que expiraram durante o modal trava o painel | reabrir Janela > Extensões > MCP Bridge |
| `remove_from_timeline(ripple=true)` deixa buraco | o rippleEdit da DOM não funciona no 26.x | `ripple_delete` (dry_run antes): fecha o buraco em todas as trilhas sync-locked, verificado |
| marcador da sequência fora do lugar depois de trocar trecho | `add_to_timeline` (inserção) move marcadores; `ripple_delete` NÃO move; `update_marker` não muda tempo | `delete_marker` + `add_marker` na posição do clipe correspondente |
| `set_item_in_out` "did not apply in point" | falha da ferramenta nesta versão | cortar o pedaço no ffmpeg e colocar o item inteiro |
| rosto lavado, cinza, em fonte de iPhone | HLG bt2020 10 bits lido como bt709 | `fonte_iphone.py` (zscale linear + tonemap hable) antes do motor |
| vídeo de iPhone de cabeça pra baixo | metadado de rotação; julgado por página em branco | `fonte_iphone.py --gira 180` (sem recodificar); conferir num quadro com gente |
| concat de peças com um quadro de 16 ms | `-c copy` entre peças de origem diferente | recodificar com `aulas.COMUM(N)` |
| render do Media Encoder sai sem a última mudança | o job guarda a sequência do momento em que entrou na fila | job novo com outro nome; apagar o velho |
| export do Media Encoder sai com segundos de preto no fim | `add_to_render_queue` exporta a sequência INTEIRA e ignora in/out; depois de `ripple_delete` o fim da sequência não encolhe | `ffmpeg -t <fim do conteúdo> -c copy` no MP4 (sem recodificar) e conferir o último quadro |
| `ripple_delete` de clipe de 1 quadro "ok" e o áudio/b-roll de 1 quadro fica em cima do anterior | o parceiro de 1 quadro não entra no `alsoRemoved`: é deslocado, não apagado | `get_sequence_structure` depois e `remove_from_timeline` dos restos de 1 quadro |
| `trim_clip` "did not apply a verified timeline trim" | edição estrutural vira no-op no 26.x | cortar o pedaço no ffmpeg com N quadros e trocar (`import_media` + `overwrite_clip`) |
| rosto aparece 1–2 quadros entre b-rolls ("flash") | buraco na trilha de b-roll (clipe começa 2 quadros depois do anterior acabar) ou 1º quadro preto do b-roll | trilha nova por cima com still do último quadro bom por 4 quadros; `move_clip` 1 quadro quando é só desalinhamento |
| depois de `add_track` as trilhas "sobem" um nível e um still colocado na trilha nova APAGA b-roll de verdade | `add_track` cai no QE fallback, que cria a trilha embaixo; o índice que você acha que é a trilha vazia é a de b-roll, e o still entra com 5 s antes do `set_clip_duration` (o readback diz ok; o defeito passou em 3 exports) | nunca `add_track` numa sequência editada: faça a ponte como MOV de N quadros (ffmpeg) e `overwrite_clip` direto na trilha de b-roll; conferir com `get_active_sequence` (lista trilha por trilha) e quadro exportado no trecho inteiro, não só na emenda |
| corte inserido de outro motor entra 8 dB mais alto | os cortes do `render.py` saem a -16 LUFS, os do motor das aulas a -24 | igualar antes de inserir (`volume=-8dB` numa cópia); `set_clip_volume` falha nesse clipe |
| `remove_from_timeline` no vídeo deixou o áudio | o clipe ligado não sai junto | remover o item da A1 também (`get_clip_at_position` na trilha de áudio) |
| fila do Media Encoder não começa, ou ao reabrir re-renderiza a fila velha como `*_1.mp4` | `add_to_render_queue` + `start_batch_encode` às vezes nunca liga; o AME guarda a fila entre sessões | `export_sequence` (direto e síncrono, não passa pelo AME; >120 s vira tarefa de fundo, então uma chamada por vez) + `sensor_export.py` na pasta; matar o AME antes |
| grade copiada do take pro hald por `copy_effects_between_clips` sai identidade | a ferramenta diz "copied" e nada chega; `apply_effect`/`color_correct` também falham | o dono gradua no Lumetri e exporta `.cube` (Lumetri > Exportar .cube); aplicar com `lut3d` no ffmpeg com matriz BT.709 explícita (`cor_aplica.py`, `cor_curso.py`); medir contra um quadro exportado do Premiere |
| LUT aplicada no ffmpeg sai mais saturada/quente que no Premiere | swscale converte YUV↔RGB em BT.601 se ninguém disser; o MP4 do OBS vem com primárias "reserved" | `setparams=...bt709` + `scale=in_color_matrix=bt709:in_range=tv:out_range=pc` antes e `out_color_matrix=bt709:out_range=tv` depois |

## Keyframe em imagem parada usa o tempo da FONTE, que começa em 3600 s (06/10)

`add_keyframe` diz "tempo relativo ao início do clipe", mas grava no tempo da fonte. Em PNG e
Gráfico o Premiere dá `inPoint = 3600` (`get_clip_properties`). Keyframe em 0–4 s cai ANTES do
trecho usado e o Premiere segura o último valor: o card ficou com opacidade 0 o tempo todo, e o
readback dos keyframes dizia que estava tudo certo. Conserto: `tempo = inPoint + t`. Prova: exportar
um quadro no meio do fade e um no meio do card, nunca confiar no readback.

Fade "da casa" pros cards (mesmo ritmo do rótulo do motor, `ROTULO.fade = 0.28`): opacidade 0→100 e
escala 96%→base em 0,28 s, opacidade 100→0 nos últimos 0,28 s, bezier no primeiro keyframe de cada
trecho. Slide opaco de tela cheia: só opacidade (escalar mostra borda). Cards colados em sequência
(prints gh1→gh2→gh3): fade só na entrada do primeiro e na saída do último, senão a tela pisca.
Leia a escala antes (`get_effect_properties Movimento`): o keyframe sobrescreve a escala que o dono pôs.
Efeito/keyframe só mexe na sequência ATIVA: avise o dono antes de trocar.

## Card vai na trilha MAIS ALTA, acima do b-roll (06/10)

Na 2.8 os avisos foram pra V2 e sumiram: a tela inteira era um b-roll na V3, que cobre tudo abaixo. O
readback e o `overwrite_clip` dizem "ok" mesmo assim. Antes de colocar: listar o que ocupa cada trilha na
janela (`get_sequence_structure` salvo + script de trilhas livres) e usar a mais alta livre; se a mais alta
tem rótulo do motor no mesmo instante, entrar DEPOIS dele (aviso logo após o rótulo, não por cima).
`move_clip_to_track` move o clipe de trilha mantendo keyframes e posição. Conferir sempre com `export_frame`.
Card de logo que repete o que o slide já mostra (2.1, "Conectar no Figma, no Drive…") não entra.
