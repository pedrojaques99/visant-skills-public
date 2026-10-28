# Armadilhas — falhas silenciosas deste pipeline

Cada item aqui já entregou vídeo errado com `exit 0`. Ordenado por quanto custa
descobrir tarde. Todas têm caso no `scripts/self-test.sh`; se você mexer no
pipeline, o portão é o que impede a reincidência.

## Índice

- [Regra zero: teste consequência, não causa](#regra-zero)
- [1. Temporário de nome fixo entre scripts concorrentes](#1)
- [2. Cache com chave de posição](#2)
- [3. Rotação por metadado](#3)
- [4. `set -e` dentro de loop de pipe](#4)
- [5. `ffprobe -of csv=p=0` devolve vírgula sobrando](#5)
- [6. Este ffmpeg de Windows não tem glob](#6)
- [7. concat demuxer não engole caminho msys](#7)
- [8. Foto com `-ss` não gera frame](#8)
- [9. `creation_time` de foto não existe](#9)
- [10. Google Drive File Stream: arquivo virtual](#10)
- [11. `-v error` engole a medição do loudnorm dois-passos](#11)
- [12. loudnorm reamostra pra 192 kHz e mistura a taxa dos cortes](#12)
- [Folclore corrigido: ffmpeg comendo stdin](#folclore)

---

<a id="regra-zero"></a>
## Regra zero: teste consequência, não causa

O caso mais valioso do portão é o mais bobo: **todo corte do roteiro chega no
concat?** Ele não sabe por que um corte sumiria. Por isso pega causa que ainda
não foi diagnosticada — inclusive a que você vai introduzir amanhã.

Teste de causa (“o `-nostdin` está lá?”) só prova que você lembrou de uma causa
conhecida. Teste de invariante prova que o vídeo está inteiro.

---

<a id="1"></a>
## 1. Temporário de nome fixo entre scripts concorrentes

**Causa raiz do abort mais confuso que este pipeline já deu.** `roteiro.sh` e
`decupagem.sh` escreviam o mesmo `_build/.edl.tmp`. Rodando junto (um em
background, o que é o normal aqui porque ingest é lento), um leu o arquivo do
outro pela metade, as colunas do `join` desalinharam, `printf '%03d'` recebeu um
nome de arquivo, e o `set -e` matou o loop no meio.

Sintoma: decupagem parou em 7 de 148 itens, **exit 0**.

Regra: todo temporário leva prefixo do script **e `$$`**. `mktemp` também serve.
Nunca `.tmp` com nome adivinhável compartilhado.

**Reincidiu três vezes nesta base**, em arquivos diferentes:
1. `.edl.tmp` compartilhado entre `roteiro.sh` e `decupagem.sh`
2. `concat.txt` compartilhado entre dois builds simultâneos — 47 entradas num EDL
   de 45, ou seja, master com cortes de duas montagens
3. o próprio conserto de (2): tornei a lista por processo **e a apaguei no EXIT**,
   cegando os três casos do portão que a inspecionam

Conclusão que vale mais que a regra: **documentar não impediu a reincidência — o
teste impediu.** E o corolário de (3): arquivo de trabalho pode ser por processo,
mas sempre deixe uma cópia de nome fixo (`concat.ultimo.txt`) para inspeção
depois do fato. Sem ela você perde a checagem que avisa quando um corte some.

---

<a id="2"></a>
## 2. Cache com chave de posição

Nomear corte por posição (`001.mp4`) faz o corte de um roteiro velho ser
reaproveitado para um clipe **diferente** quando o roteiro muda. Vídeo errado no
lugar certo, sem uma linha de aviso.

Regra: a chave é `md5(arquivo|in|out|fill|W|H|fps|loud)`. Qualquer coisa que mude
o pixel ou a onda tem que entrar na chave. Mudou parâmetro de áudio e esqueceu de
incluir? O cache serve o áudio antigo.

---

<a id="3"></a>
## 3. Rotação por metadado

Celular grava 1920x1080 **em pixel** e marca `rotation=-90` no display matrix. Ler
largura/altura sem a rotação classifica clipe vertical como horizontal, e o corte
para 16:9 destrói o enquadramento.

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height:stream_side_data=rotation \
  -of default=nw=1 arquivo.MOV
```

Se `|rotation|` é 90 ou 270, **troque largura por altura** antes de decidir.

Para gerar fixture de teste: `-metadata:s:v:0 rotate=90` **não grava** display
matrix nesse ffmpeg. Use `-display_rotation 90` na entrada com `-c copy`.

---

<a id="4"></a>
## 4. `set -e` dentro de loop de pipe

`cmd | while read ...; do ... done` roda o corpo num subshell. Um comando que
falha ali **aborta o loop inteiro** sob `set -e`, e o script segue como se tivesse
terminado. Contagem parcial, exit 0.

Regra: no corpo de loop, todo comando que pode falhar por dado ruim leva
`|| true` explícito ou `if ...; then ... else` com mensagem. E sempre feche com um
teste de contagem (entrada = saída).

---

<a id="5"></a>
## 5. `ffprobe -of csv=p=0` devolve vírgula sobrando

Pedindo campos de stream mais side_data, a saída vem `1920,1080,` — com a vírgula
final. `[ "$h" -gt 0 ]` com `1080,` falha, e num `||` isso cai no default errado
**em silêncio**.

Regra: `-of default=nw=1` e parseie `chave=valor` com awk, limpando não-dígito.

---

<a id="6"></a>
## 6. Este ffmpeg de Windows não tem glob

```
Pattern type 'glob' was selected but globbing is not supported by this libavformat build
```

Entrada de sequência de imagem tem que ser `-i '%03d.jpg'` com `-start_number`, e a
numeração **não pode ter buraco**: o demuxer para no primeiro arquivo que falta.

Corolário: numere o arquivo por contador sequencial próprio, e desenhe o número
lógico (do corte) dentro da imagem com `drawtext`.

---

<a id="7"></a>
## 7. concat demuxer não engole caminho msys

O ffmpeg aqui é build nativo de Windows; o shell é Git Bash. Caminho `/tmp/...`
ou `/h/...` dentro do `concat.txt` dá:

```
Impossible to open '/c/tmp/...'
```

Regra: a lista do concat mora **na mesma pasta dos cortes** e referencia só
basename relativo.

---

<a id="8"></a>
## 8. Foto com `-ss` não gera frame

`ffmpeg -ss 0.3 -i foto.jpg -frames:v 1` falha. Num loop, isso abre buraco na
numeração e derruba a folha de contato (ver #6).

Regra: para imagem estática, nada de `-ss`.

---

<a id="9"></a>
## 9. `creation_time` de foto não existe

Foto de celular normalmente não traz `creation_time` no container. O fallback
natural é o mtime, que no Google Drive é a **hora do upload** — não a da captura.

Consequência: a ordem cronológica das fotos é ficção. Dos vídeos é confiável.
Diga isso ao usuário antes que ele veja foto do dia 3 no meio do dia 1, e ofereça
posicionar foto à mão no EDL.

Para ler EXIF de verdade: `exiftool -DateTimeOriginal` (não vem instalado).

---

<a id="10"></a>
## 10. Google Drive File Stream: arquivo virtual

Em `H:\Meu Drive\...` o arquivo é virtual até ser lido. Cada `ffprobe`/`ffmpeg`
força download.

Consequência prática: ingest de ~170 arquivos leva minutos, e encodar 2,5 GB leva
uma hora. **Rode em background** e avise o usuário do custo antes, não depois.
Nunca rode o pipeline inteiro em foreground achando que é rápido.

---

<a id="11"></a>
## 11. loudnorm: `-v error` engole a medição do dois-passos

O `loudnorm` imprime o `print_format=json` em nível **info**. Rodar a passada de
medição com `-v error` devolve string vazia; o código cai no fallback de um passo
e o `LOUD=2` vira **no-op silencioso** — mesmo comando, mesma saída, nenhum erro.

Foi exatamente o que aconteceu ao escrever esta skill, e só apareceu porque
tentei **verificar a própria afirmação** da documentação: um passo e dois passos
davam resultado idêntico.

Regra: a passada de medição usa `-v info`. E o portão mede a consequência
(dinâmica preservada), não a presença da flag.

Sobre o efeito real do um-passo: ele comprime, mas menos do que eu afirmei antes.
Números medidos em [audio.md](audio.md). A afirmação original de "LRA de 1,6 LU"
veio de material da feira e **não era atribuível ao um-passo** — era característica
do material (clipes curtos, ambiente constante).

---

<a id="12"></a>
## 12. loudnorm reamostra pra 192 kHz e mistura a taxa dos cortes

O `loudnorm` reamostra **internamente** para 192 kHz. O encoder AAC não vai além
de 96 kHz, então o corte sai a **96 kHz** — mesmo que a entrada fosse 48 kHz e
mesmo com `aresample=48000` **antes** do filtro.

O corte que cai no caminho alternativo (sem áudio, sem loudnorm) sai a 48 kHz.

O concat demuxer exige parâmetros **idênticos** entre os cortes. Taxa misturada dá:

```
[dec:aac] Error submitting packet to decoder: Invalid data found when processing input
[aac] Number of scalefactor bands in group (42) exceeds limit (41).
```

Medido: **843 erros** num master de 14 min, com `exit 0`.

Regra: `aresample=<taxa>` **depois** do loudnorm, e `-ar <taxa>` no encoder. Os
dois — são consertos independentes, e um cobre o outro se alguém mexer no filtro.

Comprovação em 10 segundos:

```bash
ffmpeg -i in.m4a -af "aresample=48000,loudnorm=I=-16:TP=-1.5:LRA=11" -c:a aac out.m4a
ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate -of csv=p=0 out.m4a
# 96000  <- a taxa de entrada nao importa
```

**Por que passou por 22 testes:** todas as fixtures seguiam o mesmo caminho de
áudio, e taxa uniformemente errada concatena sem reclamar. O defeito só aparece
quando cortes do mesmo roteiro tomam caminhos **diferentes**. Lição de fixture:
cobrir o caminho principal E o alternativo **no mesmo build**, não em builds
separados.

E ao consertar: a cadeia de áudio entrou na chave de cache (`a2`). Sem isso, o
corte velho de 96 kHz continuaria sendo servido e o conserto nunca chegaria no
master — ver [#2](#2).

---

<a id="folclore"></a>
## Folclore corrigido: ffmpeg comendo stdin

Existe um bug clássico e real: `ffmpeg` dentro de `while read` consome o stdin do
loop e pula iteração. Vale manter `-nostdin` e ler o roteiro por descritor
dedicado (`read -u 9` / `done 9<`) — custa nada e é boa prática.

**Mas não foi isso que quebrou aqui.** Diagnóstico foi feito por semelhança de
sintoma e estava errado: mutação controlada (tirar `-nostdin` e voltar o loop pro
stdin) **não reproduz** a falha nesta versão de ffmpeg, nem em loop de arquivo nem
de pipe. A causa real era a #1, colisão de temporário.

Lição que vale mais que o bug: um restart de build de uma hora foi feito em cima
de uma causa presumida. Antes de agir numa hipótese caro, **reproduza o defeito em
mutação controlada**. O portão existe para isso.
