---
name: visant-video-editor
description: 'Monta vlog, vídeo de evento e vídeo-aula a partir de mídia bruta: decupagem, corte de silêncio sem cortar palavra, loudness e capítulos, com self-test contra falha silenciosa. Use em "monta um vlog", "edita esses vídeos", "decupagem", "vídeo do evento", "edita essa aula", "tira o silêncio do vídeo", "corta esse grito/ruído do áudio", /visant-video-editor.'
---

# Visant Video Editor

Montagem de vlog a partir de pasta bruta. O material é de celular: dezenas a
centenas de arquivos, takes de 1 a 120 s, orientação misturada, volume de áudio
variando 20 LU entre clipes.

Duas metades que não se substituem:

1. **Portão** (`scripts/self-test.sh`, determinístico): o pipeline entrega vídeo
   inteiro ou não entrega. Nota binária.
2. **Julgamento** (você, lendo a decupagem): qual take entra, em que ordem, por
   quanto tempo. Nenhum script decide isso bem.

> **Regra zero: o roteiro vai pra aprovação antes do encode.** Encodar 25 min de
> material do Drive custa uma hora. Propor o roteiro em texto custa segundos.
> Nunca renderize master sem o usuário ter visto a lista de cortes — a não ser
> que ele tenha dito "só faz" explicitamente.

> **Portão verde não é vídeo visto.** O portão prova que nenhum corte sumiu e que
> o áudio bate o alvo. Não prova que a abertura é boa nem que o take certo entrou.
> Sempre abra uma folha de contato antes de dizer que está pronto.

## Antes de tocar em qualquer coisa

```bash
bash scripts/self-test.sh
```

20 casos, ~2 min, sandbox próprio com fixtures geradas na hora. **Portão fechado =
não monte vídeo de cliente**: as falhas cobertas são todas silenciosas (exit 0 com
vídeo errado). Se você mexeu num script do pipeline, rode de novo.

## Fluxo

```
1. self-test          portão. Sem isso, não comece.
2. ingest.sh          lê metadado de tudo -> _build/manifest.tsv (ordena por captura)
3. roteiro.sh         propõe o corte dentro de um teto -> _build/edl.txt
4. decupagem.sh       folha de corte + capítulos + folha de contato
5. >>> APROVAÇÃO <<<  mostre a decupagem e o total; espere o ok
6. build.sh           normaliza cada corte e cola -> _out/vlog.mp4
7. verifique          loudness, duração, folha de contato. Só então diga pronto.
```

Tudo de uma vez, quando o usuário já aprovou o perfil:

```bash
SRC=/pasta/midia PROJ=/pasta/projeto PERFIL=youtube bash scripts/tudo.sh
```

`PROJ` é onde nascem `_build/` e `_out/`. `SRC` é a pasta da mídia — **nunca é
escrita**, e o portão testa isso.

## Perfis

| `PERFIL` | Formato | Take de fala | Uso |
|---|---|---|---|
| `youtube` (default) | 16:9 1920x1080 | **inteiro** | vlog de evento, registro longo |
| `reels` | 9:16 1080x1920 | 8 s máx | corte social, teto de 1 min |
| `registro` | 16:9 | inteiro, nada aparado | arquivo bruto organizado |

## As decisões que importam

| Decisão | Padrão | Por quê |
|---|---|---|
| Preenchimento | `FILL=auto` | clipe horizontal enche a tela (crop); clipe vertical entra com fundo borrado (blur). Cortar vertical pra 16:9 **destrói o enquadramento**. A decisão lê o display matrix, não a largura do pixel |
| Loudness | `LOUD=2` (dois passos) | um passo comprime: medido LRA de 1,6 LU, dinâmica morta. Ver [audio.md](references/audio.md) |
| Transição | corte seco | vlog bom é corte. Wipe e crossfade em b-roll é cara de template |
| Duração do corte | proporcional ao take | teto plano gerava 41 cortes de 5,0 s idênticos: ritmo de esteira |
| Ordem | cronológica por `creation_time` | monta a narrativa sozinha (montagem → chegada → evento). Vale para vídeo; **não vale para foto** |
| Cache | chave de conteúdo | md5 de arquivo+in+out+fill+formato+áudio. Nunca por posição |

## O roteiro (`_build/edl.txt`)

Uma linha por corte, separado por TAB. É aqui que a edição de verdade acontece:

```
arquivo.MOV	0	12.5      # entra em 0s, sai em 12.5s
outro.MOV	4	9         # só o trecho de 4s a 9s
foto.jpg	0	3         # foto = 3s com zoom lento (Ken Burns)
# linha com # é ignorada    <- "deleta" um take sem apagar arquivo
```

Reordenar as linhas reordena o vídeo. Comentar é como se tira um take ruim.

`roteiro.sh` classifica por tamanho do take e **nunca sacrifica narrativa**: se
estourar o teto, aperta os caps primeiro e só depois afina o b-roll por amostragem
uniforme. Take longo (>25 s) é fala e sempre entra.

```bash
TETO_MIN=5 bash scripts/roteiro.sh    # alvo de 5 min
TETO_MIN=0 bash scripts/roteiro.sh    # sem teto
MAX_LONG=0 bash scripts/roteiro.sh    # take de fala inteiro
FOTOS_POR_DIA=0 bash scripts/roteiro.sh
```

## Entregas de decupagem

`decupagem.sh` produz três coisas que o usuário usa de verdade:

- `DECUPAGEM.md` — uma linha por corte: posição no timeline, arquivo, dia, quanto
  do bruto foi usado, tipo (fala/médio/b-roll) e enquadramento
- `CAPITULOS.txt` — capítulos por dia, prontos pra descrição do YouTube (o
  primeiro **tem** que ser `00:00:00`, ou o YouTube recusa)
- `_build/contato/folha-*.jpg` — grade de thumbs numeradas. **Abra pelo menos uma
  antes de declarar pronto.** É o único jeito de ver o conteúdo sem assistir tudo

## Antes de dizer que está pronto

```bash
ffprobe -v error -show_entries format=duration,size -of default=nw=1 _out/vlog.mp4
ffmpeg -hide_banner -nostats -i _out/vlog.mp4 -af ebur128 -f null - 2>&1 | tail -12
```

Checar: duração fecha com a soma do EDL; `I:` dentro de ±1 do alvo; `LRA:` entre 5
e 12 (abaixo de 3 = comprimido demais). Então abra a folha de contato e olhe a
**abertura** — o vlog abre com clipe forte ou com vertical borrado?

## Montagem narrada (ensaio, nao log)

Quando o material tem fala com conteudo, a ordem nao vem da data — vem do
argumento. O caminho:

```bash
bash scripts/transcreve.sh       # 151 frases com timecode
bash scripts/frames.sh           # ponto de entrada de cada clipe
# recorte os blocos de fala (ver _build/falas4 e falasv no projeto de exemplo)
python scripts/planeja.py        # gera o EDL por argumento
bash scripts/build.sh
```

**EDL de narracao** — 5 colunas, video de um arquivo e voz de outro:

```
broll.MOV   in   out   narracao.m4a   in_da_voz
```

**Momento de rosto** — 3 colunas apontando pro proprio clipe da fala em
`falasv/`, que tem video e audio cortados juntos. Sincronia garantida, narracao
sem emenda.

Regras medidas em campo, em [armadilhas.md](references/armadilhas.md):
- respiro de ambiente **so** entre blocos de fonte diferente
- pool global sem repeticao (senao o video gira nos mesmos 6 clipes)
- bloco de fala longo e continuo: 40-56s sem interrupcao e o que soa natural

## Vídeo-aula / curso (screencast, fala corrida)

Forma diferente de vlog: geralmente **um arquivo só** (ou poucos, de uma sessão
de gravação), vídeo e áudio **sempre da mesma fonte** (sem b-roll separado de
narração), e o problema não é achar o take certo — é que a gravação tem minutos
de silêncio morto (tela sendo observada, ninguém falando) entre frases boas, e
às vezes um evento pontual ruim no áudio (grito ao fundo, batida no microfone).

Fluxo (não usa `roteiro.sh`/`frames.sh`/`planeja.py` — aqueles são pra separar
narração de b-roll; aqui video e áudio nunca se separam):

```
1. transcreve.sh              frase com timecode de cada arquivo bruto
2. leia a transcrição          decida quais frases ENTRAM, na ordem
3. monte o EDL na mão          arquivo\tin\tout, um por frase (não por take)
4. scan de anomalia de áudio    ver references/aula-curso.md — pico e queda
5. build.sh                    mesmo motor de trim+concat+loudnorm do vlog
6. confira o corte              ouça as emendas, principalmente onde um evento
                                foi removido
```

Regra dura: **nunca corte no meio de uma palavra ou de um raciocínio em
andamento.** Aperte o silêncio até quase zero, mas só na fronteira real entre
frases/orações — ver [references/aula-curso.md](references/aula-curso.md) pra
como achar essa fronteira nos timestamps do whisper sem adivinhar.

**O fim da aula é o lugar onde isso mais quebra.** O corte final cai num
"recapitulando…" e a avaliação que fecha o raciocínio ("levou 7 minutos, teve
um erro, nota 8") fica de fora, quase sempre porque logo antes dela tem uma
tentativa que travou ("em aproximadamente 450 segundos" + silêncio). Tire a
tentativa e mantenha a retomada; nunca jogue a avaliação junto. Antes de
fechar a decupagem, rode a porta do fecho (no curso IA para Designers:
`edicao/fecho.py`). Ela marca toda aula cuja próxima palavra no bruto vem em
menos de 3 s, e mostra o que ficou e o que vem depois, com as pausas marcadas.
Quem decide é quem LÊ: o som não sabe onde o raciocínio fecha, e o whisper
quase não põe ponto final. O fim aceito vai pro `fecho.tsv`, com a frase que
fecha. Não é corte no meio quando o que vem depois já é a próxima aula, quando
tem "corta" dito na gravação, ou quando o assunto vira ("agora o próximo
teste…").

Evento de áudio indesejado (grito, batida, pico): **corte literal por padrão**,
não abaixe o volume. Duck é gambiarra frágil aqui — o compressor e o loudnorm
que rodam depois tendem a levantar de novo o que foi abaixado, e o resultado
"parece que funcionou" só até alguém ouvir com atenção. Só considere duck se
cortar o tempo destruir uma frase que precisa continuar inteira, e mesmo assim
avise que é solução de exceção. Detalhe completo, com o porquê medido, em
[references/aula-curso.md](references/aula-curso.md).

## Quando o material tem muita fala

`roteiro.sh` escolhe takes; ele não limpa o miolo de um take. Para isso existe
`auto-editor`, já instalado e testado: corta o silêncio dentro do take. Rode
**antes** do ingest, numa pasta separada. Ver [ferramentas.md](references/ferramentas.md).

## Leia quando precisar

- **[references/armadilhas.md](references/armadilhas.md)** — as falhas silenciosas
  deste pipeline, com causa raiz. **Leia antes de mexer em qualquer script**, e
  leia antes de diagnosticar bug por semelhança de sintoma: tem um caso aqui de
  diagnóstico errado que custou um rebuild de uma hora.
- **[references/audio.md](references/audio.md)** — alvos de loudness, um passo vs
  dois passos, desclique, trilha. Leia ao mexer em áudio ou ao receber "o som tá
  estranho".
- **[references/ferramentas.md](references/ferramentas.md)** — o que já existe
  pronto (auto-editor, whisper, ffmpeg-normalize, exiftool), o que está instalado
  e o que não trazer. Leia antes de escrever qualquer coisa nova.
- **[references/aula-curso.md](references/aula-curso.md)** — decupagem por frase
  de screencast/vídeo-aula: achar fronteira de corte segura nos timestamps do
  whisper, achar evento de áudio ruim (grito, batida) sem confundir com ênfase
  de fala, e por que corte literal bate duck. Leia antes de editar aula/curso.

## Mídia no Google Drive

Em `H:\Meu Drive\...` o arquivo é virtual até ser lido, e cada leitura força
download. Ingest de ~170 arquivos leva minutos; encodar 2,5 GB leva uma hora.

**Rode em background e diga o custo ao usuário antes**, não depois. Nunca chame
`tudo.sh` em foreground achando que é rápido.
