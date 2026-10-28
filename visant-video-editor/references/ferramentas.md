# Ferramentas — o que já existe, e quando usar em vez dos scripts

Regra da casa: não reinventar. Os scripts desta skill fazem **montagem por
roteiro** (decidir ordem e duração de corte, normalizar formato, colar). O que
está abaixo faz coisas que eles não fazem — e faz melhor.

Checar o que está instalado antes de prometer:

```bash
for t in ffmpeg ffprobe auto-editor whisper ffmpeg-normalize exiftool; do
  printf '%-18s ' "$t"; command -v $t >/dev/null && echo ok || echo "-"
done
```

## auto-editor — corte de silêncio (jump cut)

**Instalado e testado** (v29.3.1). Faz o que `roteiro.sh` **não** faz: corta o
silêncio *dentro* de um take. `roteiro.sh` decide quais takes entram e por quanto
tempo; `auto-editor` limpa o miolo de cada um.

```bash
auto-editor take.mp4 --margin 0.2s -o take-limpo.mp4
```

Testado: take de 7s com 3s de silêncio no meio → 4,43s.

Quando usar: take de fala longo (>25s), entrevista, depoimento, tutorial —
qualquer coisa em que a pessoa fala, pensa, respira, retoma.

Quando **não** usar: b-roll, ambiente, música, drone. Não tem fala, e o
"silêncio" é o conteúdo.

Fluxo recomendado para vlog com muita fala:

```bash
# 1. limpa os takes longos ANTES do ingest
mkdir -p limpos
for f in TAKE_*.MOV; do auto-editor "$f" --margin 0.25s -o "limpos/$f"; done
# 2. roda o pipeline normal apontando pra pasta limpa
SRC=./limpos bash ingest.sh && bash roteiro.sh && bash build.sh
```

Opções que importam: `--margin` (respiro antes/depois da fala; 0.2–0.3s soa
natural, 0 soa robótico), `--edit audio:threshold=4%` (sensibilidade),
`--silent-speed` (acelera em vez de cortar).

## whisper — legenda e transcrição

**Instalado, mas o CLI quebra na invocação** neste ambiente (traceback no
`runpy`). Antes de prometer legenda ao usuário, teste:

```bash
whisper --help 2>&1 | head -3
```

Se quebrar, as saídas são: usar a API, `faster-whisper`, ou `whisper.cpp`. Não
prometa legenda automática sem ter rodado uma vez.

Quando funciona, a saída `.srt` entra no vídeo como legenda queimada:

```bash
ffmpeg -i vlog.mp4 -vf "subtitles=vlog.srt:force_style='FontSize=18'" -c:a copy legendado.mp4
```

## ffmpeg-normalize — loudness em lote

**Não instalado** (`pip install ffmpeg-normalize`). Wrapper Python do `loudnorm`
com dois passos por default e menos jeito de errar.

O `build.sh` já faz dois passos por corte (`LOUD=2`), então não é necessário. Vale
quando o trabalho é só áudio, ou para normalizar uma pasta inteira de uma vez:

```bash
ffmpeg-normalize *.mp4 -t -16 -o saida/ --audio-codec aac
```

## exiftool — data real da foto

**Não instalado.** Resolve a armadilha #9 de [armadilhas.md](armadilhas.md): foto
sem `creation_time` cai no mtime, que é a hora do upload.

```bash
exiftool -DateTimeOriginal -s3 foto.jpg
```

Sem ele, a ordem cronológica das fotos não é confiável — avise o usuário em vez de
entregar montagem com foto no dia errado.

## O que NÃO trazer

- **moviepy / editly / ffmpeg-python**: camada Python/JS sobre ffmpeg. O pipeline
  aqui é bash + ffmpeg direto, roda sem dependência e o portão cobre. Trocar por
  wrapper só adiciona superfície de falha.
- **Detector de cena** (`ffmpeg -vf select=gt(scene\,0.4)`): serve pra fatiar
  gravação longa contínua. Material de celular já vem fatiado em arquivo por take
  — o `creation_time` faz esse trabalho melhor.
