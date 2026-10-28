# Áudio — o defeito nº 1 de vlog

Take inaudível estraga vlog mais rápido que qualquer erro de imagem. Material de
celular de dias diferentes, lugares diferentes e distâncias diferentes do
microfone varia de 15 a 20 LU entre takes. Sem normalizar, o espectador mexe no
volume duas vezes e sai.

## Alvo

| Destino | LUFS integrado | True peak |
|---|---|---|
| YouTube, Instagram, TikTok | **-16** | -1.5 dBTP |
| Spotify / podcast | -14 | -1.0 dBTP |
| Broadcast EBU R128 | -23 | -1.0 dBTP |

`build.sh` usa -16 por default (`ALVO_I=-16`). Streaming abaixa o que passa do
alvo, mas **não levanta** o que fica abaixo — errar pra baixo é perda permanente.

## Um passo x dois passos

É a decisão que mais afeta a qualidade, e a errada é o default ingênuo.

**Um passo** (`LOUD=1`) — `loudnorm=I=-16` numa passada. O filtro não sabe o
futuro, então persegue o alvo **comprimindo** em tempo real.

Medido em fixture de dinâmica moderada (o caso `LOUD=2 preserva dinamica` do portão):

| | I | LRA |
|---|---|---|
| fonte | -28.1 | 8.8 |
| um passo | -16.4 | **8.0** |
| dois passos | -16.1 | **8.8** |

Dois passos preserva a faixa dinâmica **exata** da fonte e chega mais perto do
alvo. Um passo come 0,8 LU e erra o alvo por 0,4.

> **Faixa em que isso importa.** Se o LRA medido do material for **maior** que o
> LRA alvo (11), o ffmpeg desliga o modo linear sozinho e os dois modos dão
> resultado idêntico. Testado: material com LRA 21,8 sai igual nos dois. Ou seja,
> a vantagem do dois passos aparece em material de dinâmica normal — que é o
> caso da maior parte de vlog.

**Dois passos** (`LOUD=2`, default) — mede o corte, depois aplica **ganho linear**
com os valores medidos:

```bash
# passo 1: medir
ffmpeg -nostdin -v error -i corte.mp4 \
  -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | tail -14

# passo 2: aplicar o que foi medido
ffmpeg -i corte.mp4 -af \
  loudnorm=I=-16:TP=-1.5:LRA=11:linear=true:measured_I=-23.4:measured_TP=-5.2:measured_LRA=7.1:measured_thresh=-34.1 \
  -c:v copy saida.mp4
```

Custo: uma passada de análise de áudio por corte (rápido; o gargalo é vídeo).
`build.sh` faz isso por corte dentro do loop, e o cache evita remedir.

Quando `LOUD=1` se justifica: preview, rascunho, prazo. Nunca no master.

## Por corte, não no master

Normalizar só o master acerta a média e deixa o take fraco fraco. Normalizar por
corte é o que garante que **nenhum** take fica inaudível. É por isso que o
`loudnorm` está no loop e não só no concat.

O master leva só `alimiter=limit=0.95`, para segurar transiente de emenda.

## Desclique

Corte seco em áudio digital estala: a onda é cortada no meio do ciclo. Um `afade`
de 15 ms em cada ponta resolve, é inaudível como fade e elimina o clique.

```
afade=t=in:st=0:d=0.015,areverse,afade=t=in:st=0:d=0.015,areverse
```

O `areverse` duplo é o truque para aplicar fade no **fim** sem saber a duração do
corte de antemão.

## Taxa de amostragem uniforme é pré-requisito

O `loudnorm` devolve 192 kHz por dentro; o AAC trava em 96 kHz. Corte com loudnorm
sai a 96 kHz, corte pelo caminho alternativo sai a 48 kHz, e o concat demuxer
**exige taxa idêntica**. Misturar corrompe o áudio do master com `exit 0`.

Sempre `aresample=48000` **depois** do loudnorm mais `-ar 48000` no encoder.
Detalhe e comprovação em [armadilhas.md](armadilhas.md#12).

## Clipe sem faixa de áudio

Não pode derrubar o concat nem dessincronizar o resto. `build.sh` mistura um
`anullsrc` com peso 0 (`amix ... weights='1 0'`), e se o corte não tem áudio
nenhum o fallback mapeia o silêncio direto. Coberto pelo portão.

## Trilha

```bash
MUSIC=trilha.mp3 MUSIC_DB=-18 bash build.sh
```

-18 dB deixa a trilha embaixo da voz. Se o vlog é só ambiente sem fala, -12 aguenta.
Trilha entra **depois** do loudnorm por corte e antes do limiter, então ela não
distorce a medição de cada take.

## Mic de mesa (OBS, vídeo-aula) — denoise forte abafa a voz {#mic-de-mesa}

Contraintuitivo: mic de mesa (headset, lapela, USB) pega mais chiado de
ambiente que o mic de celular do vlog, e a tentação é limpar com um denoiser
forte. Testado com `afftdn=nr=10:nf=-30` (bem no meio da faixa "normal" da
documentação do filtro): o resultado soou **pior**, não melhor — voz abafada,
"debaixo d'água". `nr` alto no `afftdn` (denoiser de FFT) borra a fricativa e
a plosiva junto com o ruído de fundo, porque consoante tem energia espalhada
no mesmo espectro que o chiado que o filtro está tentando apagar. O ouvido
nota isso como perda de clareza antes de notar que o ruído sumiu.

Correção:

```
highpass=f=80,afftdn=nr=3:nf=-40,equalizer=f=3200:width_type=o:width=1.2:g=4,
acompressor=threshold=-20dB:ratio=2:attack=8:release=150:makeup=1.4
```

- `afftdn nr=3` (ou tire o filtro inteiro) — só o suficiente pra hum/chiado
  óbvio, nunca o bastante pra tocar a consoante.
- **Realce de presença** (`equalizer` em ~3–3,5 kHz, +3 a +4 dB, banda
  estreita) resolve o pedido de "mais claro" que denoise NÃO resolve — é ganho
  seletivo, não subtração, então não come detalhe.
- Compressor leve (`ratio=2`, não 3+) — comprimir demais achata o transiente
  que dá a sensação de clareza, empilhando em cima do abafamento do denoiser.

Se o pedido for "ficou mais alto e mais claro" e o resultado atual "abafou",
o denoiser é o primeiro suspeito, não o loudnorm. Teste tirando o `afftdn`
inteiro antes de mexer no alvo de LUFS.

## Verificar (sempre, não confie no filtro)

```bash
ffmpeg -hide_banner -nostats -i master.mp4 -af ebur128 -f null - 2>&1 | tail -12
```

Ler `I:` (integrado, tem que bater com o alvo ±1) e `LRA:` (faixa dinâmica —
abaixo de 3 LU indica compressão excessiva; vlog saudável fica entre 5 e 12).
