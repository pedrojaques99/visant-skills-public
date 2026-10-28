# Vídeo-aula / curso — decupagem por frase, sem b-roll

Aprendido montando uma aula aberta a partir de 9 clipes OBS brutos (~90 min,
a maior parte silêncio morto ou gravação esquecida ligada). O material tinha
uma frase boa aqui, quinze minutos de nada ali, e um grito de fundo no meio de
uma frase.

## Achar a fronteira de corte sem adivinhar

O whisper (`transcreve.sh`, já usa `faster_whisper` pequeno/CPU) devolve
segmentos com `start`/`end`. Dois fatos usados pra cortar com segurança:

1. **Gap zero entre segmentos = fronteira real de fala**, não corte no meio da
   palavra. Quando o `end` de um segmento bate exatamente com o `start` do
   próximo, é porque o VAD do whisper decidiu que ali existe uma pausa (por
   menor que seja) — cortar exatamente nesse ponto não rouba som de nenhuma das
   duas frases.
2. **Gap grande (>0,5 s) entre segmentos que você vai manter os dois** é pausa
   de verdade — aperte pra um resíduo pequeno (~0,1–0,15 s de cada lado), não
   apague por completo. Zero de silêncio entre TODA frase soa robótico; o
   "ritmo YouTube" que o dono pediu é *pouco* silêncio, não *nenhum*.

Prática: pegue os `start`/`end` brutos do JSON do whisper, escolha as frases
que ficam, e ao redor de cada uma aplique uma pequena margem (`start - 0.05` a
`start - 0.1`, `end + 0.1` a `end + 0.15`) **checando sempre o vizinho real no
arquivo fonte** — se o vizinho não-desejado está a menos de 0,15 s, a margem
tem que ser menor que essa distância, senão o corte capta a ponta da fala que
você queria descartar (um fiapo de palavra estranha entrando no meio do corte
seguinte).

Quando dois segmentos que você quer manter são **contíguos com gap zero** (uma
frase que o whisper só quebrou em pedaços de ~2 s por VAD, sem pausa real
entre eles — comum em fala corrida), **não** corte entre eles: junte como um
`atrim`/`trim` só, do início do primeiro ao fim do último. Cortar ali seria
inventar uma emenda onde a fala nunca parou.

## Achar evento de áudio ruim (grito, batida, pico)

Script rápido, RMS em janelas de 20 ms comparado com a mediana móvel local
(1 s de contexto):

```python
import numpy as np
rms = [...]  # RMS por janela de 20ms
local_med = [np.median(rms[max(0,i-50):i+51]) for i in range(len(rms))]
for i, v in enumerate(rms):
    base = max(local_med[i], 0.015)
    if v > base * 2.3 and v > 0.11:
        print("pico/berro", i * 0.02)
```

**Distinguir evento real de ênfase natural de fala**: um pico de verdade
(grito, batida) aparece em **muitos frames consecutivos** (>0,3–0,5 s
sustentado). Ênfase de fala normal ("bater no muro!") passa pelo mesmo limiar
mas em 1–2 frames (20–40 ms) — é uma consoante ou vogal mais forte, não um
evento. Não trate os dois igual: reporte o cluster sustentado como candidato a
corte, e trate os blips curtos como normais (não precisam de correção).

Quedas de energia (`v < 0.006` com base alta) quase sempre são só as pausas
naturais entre palavras — **não** é sinal de "picotada" de microfone. Um
dropout de mic de verdade parece diferente: silêncio abrupto NO MEIO de uma
palavra que o whisper transcreveu como contínua (o segmento não tem pausa ali,
mas o áudio cai a zero) — se não achar esse padrão específico, não invente
correção pra "picotada": relate ao dono e peça o timestamp aproximado antes de
mexer.

## Corte literal, não duck — e por quê

Primeira tentativa (errada): abaixar o volume só na janela do evento com uma
curva gaussiana (`volume=eval=frame:volume='1-K*exp(-((t-centro)/sigma)^2)'`).
Falhou de dois jeitos medidos:

1. **Gaussiana é fraca na borda.** Se o pico dura 0,6 s mas a gaussiana só é
   forte perto do centro, a atenuação na borda (onde o evento também está alto)
   fica em -3 a -7 dB — quase nada. Comparar o pico dentro/fora da janela de
   corte ANTES de declarar resolvido: se o comparativo de amplitude pico
   evento vs. fala vizinha não mudar de sinal, a atenuação não pegou.
2. **O compressor + loudnorm depois RE-INFLAM o buraco.** `acompressor` com
   makeup gain e o `loudnorm` (ganho linear global) não sabem que aquele
   trecho foi deliberadamente abaixado — o compressor não estica o que já está
   baixo (então não é ele o culpado direto), mas a comparação de pico
   pós-processamento pode enganar: se o limiter (`alimiter`) satura tanto a
   região ducked quanto a vizinha no mesmo teto, a métrica de pico bruto para
   de distinguir os dois, e parece que o duck "sumiu" quando na verdade só o
   medidor errado foi usado. **Meça em RMS numa janela estreita, não em pico
   bruto**, pra confirmar que o duck realmente segurou.

Trocar pra um platô plano com borda suave em `tanh` (não gaussiana) resolveu
a atenuação-fraca-na-borda:

```
volume=eval=frame:volume='1-P*0.5*(tanh((t-t0)/w)-tanh((t-t1)/w))'
```

`P` = profundidade (ex.: `1 - 10^(-30/20)` pra -30 dB), `t0`/`t1` = início/fim
do platô (com folga além do evento medido), `w` = suavidade da borda (~0,05 s).

**Mesmo assim, corte literal é melhor por padrão.** Depois de fazer o duck
funcionar de verdade, o próprio dono pediu pra trocar por corte — porque duck
bem feito ainda é "esconder", e o pedido original era "tirar". Regra: pergunte
qual o pedido antes de escolher a técnica. Se der pra cortar sem quebrar uma
frase em andamento, corte. Só faça duck quando o evento cai bem no meio de uma
frase que precisa continuar inteira — e mesmo aí, avise que é solução de
compromisso.

Cortar literalmente pode roubar a ponta final de uma palavra e o começo da
próxima (se o evento cair bem na fronteira entre duas frases, como aconteceu
aqui — "próxima" e "sessão" perderam ~meio fonema cada uma). Avise o dono
disso explicitamente; na prática o contexto da frase costuma cobrir a perda.

## Áudio de mic de mesa (OBS, não celular)

Ver [audio.md](audio.md#mic-de-mesa) pro motivo de NÃO usar denoise forte
aqui — é o oposto do que parece intuitivo (mic de mesa tem mais ruído de
ambiente que celular, e a tentação é limpar mais).
