#!/usr/bin/env bash
# PORTAO do visant-video-editor. Roda antes de montar video de cliente.
#
# Cada caso aqui e um bug que JA aconteceu em producao e que falha EM SILENCIO:
# o build termina com exit 0 e entrega video errado. Linter nao pega, olho nao pega
# num vlog de 25 min. So teste pega.
#
# Uso:  bash self-test.sh            # roda tudo
#       bash self-test.sh -v         # mostra a saida dos scripts
#       KEEP=1 bash self-test.sh     # nao apaga o sandbox (pra debugar)
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERBOSE=0; [ "${1:-}" = "-v" ] && VERBOSE=1
SANDBOX="${TMPDIR:-/tmp}/vve-selftest-$$"
OK=0; FALHOU=0; FALHAS=""

mkdir -p "$SANDBOX/src"
limpar() { [ "${KEEP:-0}" = 1 ] && { echo "sandbox: $SANDBOX"; return; }; rm -rf "$SANDBOX"; }
trap limpar EXIT

roda() { if [ "$VERBOSE" = 1 ]; then "$@"; else "$@" >/dev/null 2>&1; fi; }

passou() { OK=$((OK+1)); printf '  \033[32mOK\033[0m   %s\n' "$1"; }
falha()  { FALHOU=$((FALHOU+1)); FALHAS="$FALHAS\n  - $1: $2"; printf '  \033[31mFALHA\033[0m %s\n         %s\n' "$1" "$2"; }
aval()   { if [ "$2" = "$3" ]; then passou "$1"; else falha "$1" "esperado [$3], veio [$2]"; fi; }

# ---------------------------------------------------------------- fixtures
# Sinteticas, geradas na hora: a skill nao carrega video de exemplo.
# Cobrem as formas que quebram o pipeline: horizontal, vertical, rotacao por
# metadado, sem faixa de audio, audio mudo, e foto estatica.
echo "== gerando fixtures"
# $5 = fonte visual, $6 = frequencia do tom. As fixtures TEM que ser distinguiveis:
# com testsrc2 em todas, dois cortes de clipes diferentes saem byte-identicos e o
# teste de cache passa por engano (ja aconteceu ao escrever este portao).
fx() { # $1=nome  $2=WxH  $3=dur  $4=tem_audio  $5=fonte-lavfi  $6=hz
  local o="$SANDBOX/src/$1"
  if [ "$4" = 1 ]; then
    ffmpeg -nostdin -y -v error -f lavfi -i "$5=size=$2:rate=30:duration=$3" \
      -f lavfi -i "sine=frequency=$6:sample_rate=48000:duration=$3" \
      -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -shortest "$o"
  else
    ffmpeg -nostdin -y -v error -f lavfi -i "$5=size=$2:rate=30:duration=$3" \
      -c:v libx264 -preset ultrafast -pix_fmt yuv420p "$o"
  fi
}
fx horiz.mp4     640x360 4  1 testsrc2   440
fx horiz2.mp4    640x360 8  1 smptebars  330
fx horiz3.mp4    640x360 3  1 rgbtestsrc 550
fx vert.mp4      360x640 4  1 testsrc2   440
fx semaudio.mp4  640x360 3  0 smptebars  0
fx longo.mp4     640x360 30 1 testsrc    220
# Rotacao por metadado: 640x360 no pixel, 360x640 na tela. Esta e a fixture que
# DISCRIMINA - quem olha so largura/altura acerta vert.mp4 e erra esta.
# `-metadata rotate=90` NAO grava display matrix nesse ffmpeg; `-display_rotation` grava.
ffmpeg -nostdin -y -v error -display_rotation 90 -i "$SANDBOX/src/horiz.mp4" -c copy \
  "$SANDBOX/src/rot90.mp4" 2>/dev/null || cp "$SANDBOX/src/horiz.mp4" "$SANDBOX/src/rot90.mp4"
if [ -z "$(ffprobe -v error -select_streams v:0 -show_entries stream_side_data=rotation \
           -of default=nw=1:nk=1 "$SANDBOX/src/rot90.mp4" 2>/dev/null)" ]; then
  echo "   AVISO: fixture rot90 saiu sem display matrix; o caso de rotacao nao discrimina nada"
fi
ffmpeg -nostdin -y -v error -f lavfi -i "color=c=red:size=640x360:duration=1" -frames:v 1 \
  "$SANDBOX/src/foto.jpg"
# Dinamica MODERADA (LRA ~9, abaixo do alvo de 11): e a unica faixa em que o
# modo linear do loudnorm de fato se aplica. Com LRA acima do alvo o ffmpeg
# desliga o linear sozinho e os dois modos coincidem - fixture assim nao testa nada.
ffmpeg -nostdin -y -v error -f lavfi -i "testsrc2=size=640x360:rate=30:duration=20" \
  -f lavfi -i "sine=frequency=440:duration=20:sample_rate=48000" \
  -filter_complex "[1:a]volume='0.35+0.3*sin(2*PI*t/6)':eval=frame[a]" \
  -map 0:v -map '[a]' -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac \
  "$SANDBOX/src/dinamica.mp4"
echo "   $(ls "$SANDBOX/src" | wc -l) fixtures"

export PROJ="$SANDBOX/proj"
export SRC="$SANDBOX/src"
mkdir -p "$PROJ"
edl() { printf "$1" > "$PROJ/_build/edl.txt"; }

echo
echo "== portao"

# ---------------------------------------------------------------- 1. ingest
roda bash "$AQUI/ingest.sh"
n="$(awk 'NR>1' "$PROJ/_build/manifest.tsv" 2>/dev/null | wc -l | tr -d ' ')"
aval "ingest le toda midia da pasta" "$n" "9"

# ---------------------------------------------------------------- 2. CONTAGEM
# Invariante mais importante do pipeline: todo corte do roteiro tem que chegar no
# concat. Qualquer coisa que interrompa o loop no meio (`set -e` num subshell de
# pipe, ffmpeg consumindo stdin, erro de parse) sai com exit 0 e video incompleto.
# Nao testa uma CAUSA, testa a CONSEQUENCIA - pega causa que ainda nao conhecemos.
edl 'horiz.mp4\t0\t1\nhoriz2.mp4\t0\t1\nhoriz3.mp4\t0\t1\nvert.mp4\t0\t1\nsemaudio.mp4\t0\t1\n'
roda bash "$AQUI/build.sh"
n="$(grep -c '^file ' "$PROJ/_build/clips/concat.ultimo.txt" 2>/dev/null || echo 0)"
aval "todo corte do roteiro chega no concat (5 de 5)" "$n" "5"

# ---------------------------------------------------------------- 3. CACHE
# Chave de cache por POSICAO (001.mp4) reaproveita o corte de um roteiro velho
# pra um clipe diferente: video errado, silencioso.
edl 'horiz.mp4\t0\t1\n'
roda bash "$AQUI/build.sh" ; h1="$(md5sum "$PROJ/_out/vlog.mp4" | cut -d' ' -f1)"
edl 'horiz2.mp4\t0\t1\n'
roda bash "$AQUI/build.sh" ; h2="$(md5sum "$PROJ/_out/vlog.mp4" | cut -d' ' -f1)"
if [ "$h1" != "$h2" ]; then passou "clipe diferente no mesmo slot re-encoda"
else falha "clipe diferente no mesmo slot re-encoda" "saiu video identico: cache colidiu por posicao"; fi

edl 'horiz.mp4\t0\t1\n'
saida="$(bash "$AQUI/build.sh" 2>&1)"
if printf '%s' "$saida" | grep -q '(cache)'; then passou "corte repetido acerta o cache"
else falha "corte repetido acerta o cache" "re-encodou o que era identico"; fi

# ---------------------------------------------------------------- 4. ROTACAO
# Clipe vertical cortado pra 16:9 tem o enquadramento destruido. A decisao
# depende de ler o display matrix, nao a largura do pixel.
# Limpa o cache antes: linha de cache nao imprime a decisao de fill.
rm -rf "$PROJ/_build/clips"
edl 'vert.mp4\t0\t1\n'
out="$(bash "$AQUI/build.sh" 2>&1 | grep -E '^  \+ ')"
if printf '%s' "$out" | grep -q 'fill=blur'; then passou "vertical entra com blur, nao crop"
else falha "vertical entra com blur, nao crop" "escolheu: $(printf '%s' "$out" | grep -o 'fill=[a-z]*' | head -1)"; fi

rm -rf "$PROJ/_build/clips"
edl 'horiz.mp4\t0\t1\n'
out="$(bash "$AQUI/build.sh" 2>&1 | grep -E '^  \+ ')"
if printf '%s' "$out" | grep -q 'fill=crop'; then passou "horizontal enche a tela com crop"
else falha "horizontal enche a tela com crop" "escolheu: $(printf '%s' "$out" | grep -o 'fill=[a-z]*' | head -1)"; fi

# O CASO QUE DISCRIMINA: 640x360 no pixel, vertical na tela. Ler largura/altura
# sem o display matrix acerta vert.mp4 por sorte e erra este.
rm -rf "$PROJ/_build/clips"
edl 'rot90.mp4\t0\t1\n'
out="$(bash "$AQUI/build.sh" 2>&1 | grep -E '^  \+ ')"
if printf '%s' "$out" | grep -q 'fill=blur'; then passou "rotacao por metadado tratada como vertical"
else falha "rotacao por metadado tratada como vertical" "leu o pixel e nao o display matrix: $(printf '%s' "$out" | grep -o 'fill=[a-z]*' | head -1)"; fi

# ---------------------------------------------------------------- 5. SEM AUDIO
# Clipe sem faixa de audio nao pode derrubar o concat nem dessincronizar o resto.
edl 'semaudio.mp4\t0\t2\nhoriz.mp4\t0\t2\n'
roda bash "$AQUI/build.sh"
na="$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "$PROJ/_out/vlog.mp4" 2>/dev/null | wc -l | tr -d ' ')"
aval "clipe sem audio nao quebra: master sai com 1 faixa" "$na" "1"

# ---------------------------------------------------------------- 5b. TAXA UNIFORME
# O concat demuxer exige parametros IDENTICOS entre os cortes. O loudnorm reamostra
# pra 192 kHz por dentro e o AAC trava em 96 kHz, entao corte com loudnorm saia a
# 96 kHz e corte pelo fallback a 48 kHz. Resultado: 843 erros "Invalid data found"
# e audio corrompido num master de 14 min - com exit 0.
# A mistura so aparece quando os cortes tomam CAMINHOS DIFERENTES de audio:
# por isso o roteiro aqui junta clipe com audio e clipe sem.
rm -rf "$PROJ/_build/clips"
edl 'horiz.mp4\t0\t2\nsemaudio.mp4\t0\t2\ndinamica.mp4\t0\t3\nfoto.jpg\t0\t2\n'
roda bash "$AQUI/build.sh"
taxas="$(for c in "$PROJ"/_build/clips/*.mp4; do
           ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate \
             -of default=nw=1:nk=1 "$c" 2>/dev/null
         done | sort -u | tr '\n' ' ')"
aval "todo corte sai na mesma taxa de amostragem (veio: ${taxas:-nenhuma})" "$(echo $taxas)" "48000"

# E o master nao pode ter erro de decodificacao na juncao.
erros="$(ffmpeg -nostdin -v error -i "$PROJ/_out/vlog.mp4" -f null - 2>&1 \
          | grep -c "Invalid data\|scalefactor" || true)"
aval "master decodifica sem erro de audio" "$erros" "0"

# ---------------------------------------------------------------- 5c. NARRACAO
# Coluna 4/5 do EDL: video de um arquivo, voz de outro. O caso discrimina de
# forma dura - o video e um clipe SEM faixa de audio. Se a narracao nao entrar,
# o corte sai mudo, e mudo e exatamente como a falha apareceria no vlog.
rm -rf "$PROJ/_build/clips"
printf 'semaudio.mp4\t0\t3\tdinamica.mp4\t2\n' > "$PROJ/_build/edl.txt"
roda bash "$AQUI/build.sh"
vol="$(ffmpeg -nostdin -hide_banner -nostats -i "$PROJ/_out/vlog.mp4" -af volumedetect -f null - 2>&1 \
        | awk -F': ' '/mean_volume/{gsub(/ dB/,"",$2); print $2; exit}')"
ok="$(awk -v v="${vol:--99}" 'BEGIN{print (v > -50) ? "sim" : "nao"}')"
aval "narracao entra em video mudo (mean_volume=${vol:-?} dB)" "$ok" "sim"

# e o EDL antigo, de 3 colunas, continua valendo
rm -rf "$PROJ/_build/clips"
edl 'horiz.mp4\t0\t2\n'
roda bash "$AQUI/build.sh"
n="$(grep -c '^file ' "$PROJ/_build/clips/concat.ultimo.txt" 2>/dev/null || echo 0)"
aval "EDL de 3 colunas segue funcionando (retrocompativel)" "$n" "1"

# ---------------------------------------------------------------- 5d. CRLF
# O EDL e editado por gente, e editor de Windows grava \r no fim da linha. O \r
# gruda no ultimo campo e o ffmpeg recusa o argumento. Sem tratamento, a narracao
# falhava em TODO corte e a mensagem nao dizia por que.
rm -rf "$PROJ/_build/clips"
printf 'semaudio.mp4\t0\t3\tdinamica.mp4\t2\r\nhoriz.mp4\t0\t2\r\n' > "$PROJ/_build/edl.txt"
roda bash "$AQUI/build.sh"
n="$(grep -c '^file ' "$PROJ/_build/clips/concat.ultimo.txt" 2>/dev/null || echo 0)"
aval "EDL com CRLF monta os 2 cortes" "$n" "2"
vol="$(ffmpeg -nostdin -hide_banner -nostats -i "$PROJ/_out/vlog.mp4" -af volumedetect -f null - 2>&1 \
        | awk -F': ' '/mean_volume/{gsub(/ dB/,"",$2); print $2; exit}')"
ok="$(awk -v v="${vol:--99}" 'BEGIN{print (v > -50) ? "sim" : "nao"}')"
aval "narracao sobrevive ao CRLF (mean_volume=${vol:-?} dB)" "$ok" "sim"

# ---------------------------------------------------------------- 6. DURACAO
# concat demuxer com caminho msys falha nesse ffmpeg nativo de Windows.
# Se a duracao nao fecha com a soma dos cortes, algum corte sumiu.
edl 'horiz.mp4\t0\t2\nhoriz2.mp4\t0\t3\nhoriz3.mp4\t0\t1\n'
roda bash "$AQUI/build.sh"
d="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$PROJ/_out/vlog.mp4" 2>/dev/null)"
ok="$(awk -v d="${d:-0}" 'BEGIN{print (d>5.4 && d<6.6) ? "sim" : "nao"}')"
aval "duracao do master = soma dos cortes (6s +-0.6)" "$ok" "sim"

# ---------------------------------------------------------------- 7. AUDIO
# Alvo de streaming. Se nao bate, take fica inaudivel no meio do vlog.
i="$(ffmpeg -hide_banner -nostats -i "$PROJ/_out/vlog.mp4" -af ebur128 -f null - 2>&1 \
      | awk '/I:/{v=$2} END{print v}')"
ok="$(awk -v i="${i:-99}" 'BEGIN{d=i-(-16); if(d<0)d=-d; print (d<=2.5) ? "sim" : "nao"}')"
aval "loudness em -16 LUFS +-2.5 (veio ${i:-?})" "$ok" "sim"

# ---------------------------------------------------------------- 7b. DOIS PASSOS
# O loudnorm imprime a medicao em nivel INFO. Com `-v error` o ffmpeg engole o
# JSON, a medicao volta vazia, o codigo cai no fallback de um passo e o LOUD=2
# vira no-op SILENCIOSO: mesmo comando, mesma saida, nenhum erro. Ja aconteceu.
# O teste mede a consequencia: dois passos preserva a dinamica da fonte.
lra_de() { ffmpeg -hide_banner -nostats -i "$1" -af ebur128 -f null - 2>&1 \
            | tail -14 | awk '/^ *LRA:/{l=$2} END{print l+0}'; }
lra_src="$(lra_de "$SRC/dinamica.mp4")"
for modo in 1 2; do
  rm -rf "$PROJ/_build/clips"
  edl 'dinamica.mp4\t0\t20\n'
  LOUD=$modo OUT="loud$modo" roda bash "$AQUI/build.sh"
done
lra1="$(lra_de "$PROJ/_out/loud1.mp4")"
lra2="$(lra_de "$PROJ/_out/loud2.mp4")"
ok="$(awk -v s="$lra_src" -v a="$lra1" -v b="$lra2" 'BEGIN{
  da=s-a; if(da<0)da=-da; db=s-b; if(db<0)db=-db
  print (db<=0.3 && db<da) ? "sim" : "nao" }')"
aval "LOUD=2 preserva dinamica (fonte=$lra_src 1passo=$lra1 2passos=$lra2)" "$ok" "sim"

# ---------------------------------------------------------------- 8. FADE
# Abre do preto. Frame 0 claro = fade nao foi aplicado.
y="$(ffmpeg -hide_banner -nostats -i "$PROJ/_out/vlog.mp4" \
      -vf "select=eq(n\,0),signalstats,metadata=print:key=lavfi.signalstats.YAVG" \
      -f null - 2>&1 | awk -F= '/YAVG/{print int($2); exit}')"
ok="$(awk -v y="${y:-255}" 'BEGIN{print (y<40) ? "sim" : "nao"}')"
aval "master abre do preto (YAVG frame 0 = ${y:-?})" "$ok" "sim"

# ---------------------------------------------------------------- 9. ROTEIRO
# Teto de duracao respeitado, e take longo (narrativa) nunca descartado.
roda bash "$AQUI/ingest.sh"
TETO_MIN=1 roda bash "$AQUI/roteiro.sh"
if grep -q 'longo.mp4' "$PROJ/_build/edl.txt"; then passou "roteiro preserva take longo sob teto apertado"
else falha "roteiro preserva take longo sob teto apertado" "o take de narrativa foi descartado"; fi

# TETO E TETO. Duas regressoes ja fizeram o teto ser ignorado: (a) o laco de
# aperto mexia so no cap enquanto a INCLINACAO era o limitador; (b) o afinamento
# do b-roll arredondava pra baixo e nao tirava nada. TETO_MIN=15 entregou 16.0.
# Narrativa pode estourar o teto (nunca e sacrificada); b-roll, nao.
TETO_MIN=2 COMP_LONG=0.9 MAX_LONG=90 roda bash "$AQUI/roteiro.sh"
tot="$(grep -v '^#' "$PROJ/_build/edl.txt" | awk -F'\t' '{t+=$3-$2} END{printf "%.1f", t/60}')"
ok="$(awk -v t="${tot:-99}" 'BEGIN{print (t <= 2.4) ? "sim" : "nao"}')"
aval "teto de 2 min respeitado mesmo com inclinacao agressiva (veio ${tot} min)" "$ok" "sim"

TETO_MIN=0 roda bash "$AQUI/roteiro.sh"
n="$(grep -vc '^#' "$PROJ/_build/edl.txt")"
ok="$(awk -v n="$n" 'BEGIN{print (n>=6) ? "sim" : "nao"}')"
aval "sem teto o roteiro nao zera o b-roll (veio $n cortes)" "$ok" "sim"

# ---------------------------------------------------------------- 10. DECUPAGEM
# tile= exige thumb de tamanho uniforme e numeracao sem buraco; esse ffmpeg
# de Windows tambem nao tem glob. Foto com -ss falha e abre buraco.
edl 'horiz.mp4\t0\t1\nvert.mp4\t0\t1\nfoto.jpg\t0\t2\n'
roda bash "$AQUI/decupagem.sh"
THUMBS=1 roda bash "$AQUI/decupagem.sh"
n="$(ls "$PROJ/_build/contato"/[0-9]*.jpg 2>/dev/null | wc -l | tr -d ' ')"
aval "thumb pra todo corte, foto incluida" "$n" "3"
if ls "$PROJ/_build/contato"/folha-*.jpg >/dev/null 2>&1; then passou "folha de contato monta (sem glob, thumb uniforme)"
else falha "folha de contato monta (sem glob, thumb uniforme)" "nenhuma folha-*.jpg gerada"; fi
if [ -s "$PROJ/DECUPAGEM.md" ] && grep -q '| 1 |' "$PROJ/DECUPAGEM.md"; then passou "DECUPAGEM.md tem linha de corte"
else falha "DECUPAGEM.md tem linha de corte" "tabela vazia: o join arquivo x manifest falhou"; fi
if [ -s "$PROJ/CAPITULOS.txt" ] && grep -q '00:00:00' "$PROJ/CAPITULOS.txt"; then passou "CAPITULOS.txt comeca em 00:00:00"
else falha "CAPITULOS.txt comeca em 00:00:00" "YouTube recusa capitulo que nao comeca em zero"; fi

# ---------------------------------------------------------------- 11. CONCORRENCIA
# CAUSA RAIZ REAL do abort em campo: roteiro.sh e decupagem.sh escreviam o mesmo
# `_build/.edl.tmp`. Rodando junto (um em background), um leu o arquivo do outro
# pela metade, as colunas desalinharam e o `set -e` matou o loop no meio - com
# exit 0 e decupagem truncada. Nao era ffmpeg comendo stdin, como parecia.
roda bash "$AQUI/ingest.sh"
edl 'horiz.mp4\t0\t1\nhoriz2.mp4\t0\t1\nhoriz3.mp4\t0\t1\n'
( TETO_MIN=0 bash "$AQUI/roteiro.sh" >/dev/null 2>&1 ) &
p1=$!
( bash "$AQUI/decupagem.sh" >/dev/null 2>&1 ) &
p2=$!
wait $p1 $p2
sobrou="$(ls "$PROJ/_build"/.*.tmp 2>/dev/null | wc -l | tr -d ' ')"
aval "scripts concorrentes nao deixam temporario orfao" "$sobrou" "0"
if [ -s "$PROJ/DECUPAGEM.md" ] && grep -q '^| [0-9]' "$PROJ/DECUPAGEM.md"; then
  passou "decupagem sobrevive a roteiro.sh rodando junto"
else
  falha "decupagem sobrevive a roteiro.sh rodando junto" "tabela truncada: temporario colidiu"
fi

# ---------------------------------------------------------------- 12. FONTE
# O pipeline nunca pode escrever na pasta de midia do cliente.
antes="$(ls -la "$SANDBOX/src" | md5sum)"
edl 'horiz.mp4\t0\t1\n'
roda bash "$AQUI/build.sh"
depois="$(ls -la "$SANDBOX/src" | md5sum)"
aval "pasta de origem intocada" "$depois" "$antes"

# ---------------------------------------------------------------- resultado
echo
if [ "$FALHOU" = 0 ]; then
  printf '\033[32m== PORTAO ABERTO\033[0m  %d/%d\n' "$OK" "$((OK+FALHOU))"
  exit 0
else
  printf '\033[31m== PORTAO FECHADO\033[0m  %d/%d passaram%b\n' "$OK" "$((OK+FALHOU))" "$FALHAS"
  echo
  echo "Nao monte video de cliente com o portao fechado: essas falhas sao silenciosas."
  exit 1
fi
