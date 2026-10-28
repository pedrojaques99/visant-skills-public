#!/usr/bin/env python3
# Monta o EDL por ARGUMENTO (nao por data), com pool global de planos e zero
# repeticao. E o componente que separa "log cronologico" de ensaio narrado.
#
# Espera:
#   _build/manifest.tsv     de ingest.sh
#   _build/frames.tsv       de frames.sh   (ponto de entrada de cada clipe)
#   _build/falas4/<bloco>.m4a   narracao tratada (audio)
#   _build/falasv/<bloco>.mp4   idem COM VIDEO, pros momentos de rosto
#
# Edite a lista B: (bloco, b-roll preferido, respiro depois?).
#
# Tres regras que custaram caro pra aprender:
#  1. RESPIRO de ambiente so entre blocos de FONTE diferente. Entre trechos da
#     mesma fala, soa como corte no meio da frase.
#  2. Pool GLOBAL sem repeticao. Voltar ao inicio da lista quando acaba o b-roll
#     do bloco faz o video inteiro girar nos mesmos 6 clipes.
#  3. Momento de ROSTO sai do clipe em falasv/ (3 colunas). Como video e audio
#     foram cortados juntos pelo auto-editor, o labio fica em sincronia e a
#     narracao nao tem emenda. Rosto com audio tratado por fora dessincroniza.
#
# O erro da versao anterior: quando a lista de b-roll de um bloco acabava, ela
# voltava ao comeco (i % len). Resultado: os mesmos 6 clipes o video inteiro,
# enquanto 130 arquivos e 342 s de percurso ficavam parados.
import os, subprocess, sys

BASE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(BASE)
MIN_PLANO, MAX_PLANO = 2.5, 4.0      # pulso medio: o plano respira
# Respiro de ambiente SO entre blocos de fonte diferente. Entre trechos da mesma
# fala ele soava como corte no meio da frase - foi a queixa mais justa que recebi.

def dur(p):
    out = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
                          "-of","csv=p=0",p], capture_output=True, text=True).stdout.strip()
    try: return float(out)
    except: return 0.0

manifest, best = {}, {}
for ln in open(f"{BASE}/manifest.tsv", encoding="utf-8").read().splitlines()[1:]:
    c = ln.split("\t")
    if len(c) > 2: manifest[c[0]] = float(c[2])
for ln in open(f"{BASE}/frames.tsv", encoding="utf-8").read().splitlines()[1:]:
    c = ln.split("\t")
    if len(c) > 1: best[c[0]] = float(c[1])

# ---- pool de planos ------------------------------------------------------
# Take de percurso vira MUITOS planos (ele anda, entao cada trecho e outra cena).
PERCURSO = ["IMG_4479.MOV","IMG_4379.MOV","IMG_4508.MOV","IMG_4481.MOV","IMG_4392.MOV"]

def fatia_percurso(f, passo=3.4):
    d = manifest.get(f, 0); out = []
    t = 2.0
    while t + MAX_PLANO < d - 1.0:
        out.append((f, round(t,2), round(t+passo,2)))
        t += passo + 0.6          # pula um pedaco pra dois planos seguidos nao serem iguais
    return out

pool_percurso = []
for f in PERCURSO: pool_percurso += fatia_percurso(f)

pool_curto = {}
for f, d in manifest.items():
    if f in PERCURSO or not f.lower().endswith(".mov"): continue
    t = best.get(f, max(0.0, d*0.2))
    if d - t < MIN_PLANO: t = max(0.0, d - MAX_PLANO)
    take = min(MAX_PLANO, d - t)
    if take >= 1.6: pool_curto[f] = (f, round(t,2), round(t+take,2))

usados = set()
def pega(prefs, n):
    """n planos, preferindo os arquivos de prefs, sem repetir nunca."""
    saida = []
    for f in prefs:
        if len(saida) >= n: break
        if f in pool_curto and f not in usados:
            usados.add(f); saida.append(pool_curto[f]); continue
        # Preferencia tambem vale pra take de PERCURSO: o 4379 e a chegada de
        # carro inteira, e sem isso ele nunca entrava onde devia (a abertura).
        for (pf, a, b) in pool_percurso:
            if len(saida) >= n: break
            if pf != f or (pf, a) in usados: continue
            usados.add((pf, a)); saida.append((pf, a, b))
    for f, a, b in pool_percurso:      # completa com percurso
        if len(saida) >= n: break
        k = (f, a)
        if k in usados: continue
        usados.add(k); saida.append((f, a, b))
    for f, plano in pool_curto.items(): # ultimo recurso: qualquer clipe livre
        if len(saida) >= n: break
        if f in usados: continue
        usados.add(f); saida.append(plano)
    return saida

def percurso(n=1):
    return pega([], n)

# ---- blocos: voz + de onde vem a imagem ---------------------------------
B = [
 # (bloco, b-roll preferido, respiro depois?)
 # A CHEGADA abre o video: carro, estrada, o pavilhao surgindo
 ("01frio",      ["IMG_4377.MOV","IMG_4378.MOV","IMG_4379.MOV","IMG_4381.MOV"], False),
 # A MONTAGEM logo em seguida: adesivo na fachada, escada, guindaste com a lona
 ("02noite",     ["IMG_4290.MOV","IMG_4315.MOV","IMG_4289.MOV","IMG_4316.MOV",
                  "IMG_4322.MOV","IMG_4323.MOV","IMG_4324.MOV"], False),
 # mesma fala (4521) segue direto: nenhum respiro no meio
 ("03materiais", ["IMG_4413.MOV","IMG_4415.MOV","IMG_4417.MOV","IMG_4414.MOV",
                  "IMG_4418.MOV","IMG_4491.MOV","IMG_4486.MOV","IMG_4493.MOV",
                  "IMG_4408.MOV","IMG_4409.MOV","IMG_4410.MOV","IMG_4401.MOV",
                  "IMG_4429.MOV","IMG_4484.MOV"], False),
 ("04processo",  ["IMG_4422.MOV","IMG_4427.MOV","IMG_4412.MOV","IMG_4411.MOV"], True),
 ("05marca",     ["IMG_4421.MOV","IMG_4425.MOV","IMG_4480.MOV","IMG_4393.MOV",
                  "IMG_4390.MOV","IMG_4388.MOV","IMG_4420.MOV"], True),
 ("06gigantes",  ["IMG_4383.MOV","IMG_4384.MOV","IMG_4385.MOV","IMG_4382.MOV",
                  "IMG_4392.MOV","IMG_4395.MOV"], True),
 ("07ninguem",   ["IMG_4477.MOV"], True),
 ("08quarenta",  ["IMG_4464.MOV","IMG_4496.MOV","IMG_4498.MOV","IMG_4402.MOV"], True),
 ("09magnitude", ["IMG_4405.MOV","IMG_4426.MOV","IMG_4494.MOV","IMG_4485.MOV"], True),
 ("10real",      ["IMG_4466.MOV","IMG_4505.MOV","IMG_4506.MOV","IMG_4467.MOV",
                  "IMG_4499.MOV","IMG_4462.MOV","IMG_4458.MOV","IMG_4492.MOV"], True),
 ("11fecho",     ["IMG_4503.MOV","IMG_4471.MOV","IMG_4469.MOV","IMG_4470.MOV"], False),
]

# Blocos cujo take mostra rosto. 4521 e 4522 sao gravacao de tela: nao entram.
# O clipe em falasv/ tem video E audio cortados juntos pelo auto-editor, entao
# usar ele direto (3 colunas) mantem o labio em sincronia. Inserir o rosto com o
# audio tratado por fora dessincronizaria - por isso nao dava pra fazer antes.
COM_ROSTO = {"05marca","06gigantes","07ninguem","09magnitude","10real"}
ROSTO_CADA = 15.0     # um momento de rosto a cada ~15s de narracao
ROSTO_DUR  = 3.5

linhas = ["# VLOG - sem cartelas, voz conduz, percurso costura, nenhum plano repete"]
for idx, (voz, prefs, respiro) in enumerate(B):
    vp = f"{BASE}/falas4/{voz}.m4a"
    if not os.path.exists(vp):
        print(f"  ! falta {voz}", file=sys.stderr); continue
    d = dur(vp)
    # Aloca GULOSO ate cobrir a fala inteira. Dividir em fatias iguais truncava o
    # bloco quando um plano tinha menos capacidade que a fatia - e o que se perdia
    # era sempre o FIM da frase.
    off = 0.0
    planos = pega(prefs, max(1, round(d / 3.2)))
    fila = list(planos)
    # Alvos calculados PELO TAMANHO do bloco: a regra fixa "a cada 15s" nunca
    # disparava em bloco curto, e a checagem de sobra matava o ultimo alvo.
    alvos = []
    if voz in COM_ROSTO:
        t0 = min(10.0, d * 0.35)
        t = t0
        while t <= d - (ROSTO_DUR + 0.5):
            alvos.append(t); t += ROSTO_CADA
    prox_rosto = alvos.pop(0) if alvos else 1e9
    while off < d - 0.05:
        # momento de ROSTO: video e audio saem do proprio clipe de fala, na mesma
        # posicao. Linha de 3 colunas = o build usa o audio dele, e a narracao
        # continua sem emenda porque e o mesmo arquivo e o mesmo relogio.
        if off >= prox_rosto and d - off >= ROSTO_DUR:
            dur_r = min(ROSTO_DUR, d - off)
            linhas.append(f"_build/falasv/{voz}.mp4	{off:.2f}	{off+dur_r:.2f}")
            off += dur_r
            prox_rosto = alvos.pop(0) if alvos else 1e9
            continue
        # Sobra menor que o plano minimo: estica o ultimo plano em vez de pedir
        # outro. Sem isso o laco descartava plano atras de plano (cap < 0.8) e
        # drenava o pool inteiro, deixando os blocos seguintes sem imagem.
        if d - off < 0.8 and linhas and linhas[-1].count("	") == 4:
            c = linhas[-1].split("	")
            fim = float(c[2]) + (d - off)
            lim = manifest.get(c[0], fim)
            c[2] = f"{min(fim, lim):.2f}"
            linhas[-1] = "	".join(c)
            off = d
            break
        if not fila:
            fila = pega(prefs, 4)   # reabastece AINDA preferindo o tema do bloco
            if not fila: break
        f, a, b = fila.pop(0)
        cap = min(MAX_PLANO, b - a, d - off)
        if cap < 0.8: continue
        linhas.append(f"{f}\t{a:.2f}\t{a+cap:.2f}\t_build/falas4/{voz}.m4a\t{off:.2f}")
        off += cap
    # RESPIRO: so quando a proxima fala vem de outra fonte/assunto
    if respiro and idx < len(B) - 1:
        for (f, a, b) in percurso(1):
            linhas.append(f"{f}\t{a:.2f}\t{min(b, a+3.0):.2f}")

open(f"{BASE}/edl.txt","w",encoding="utf-8",newline="\n").write("\n".join(linhas)+"\n")
cortes = [l for l in linhas if not l.startswith("#")]
tot = sum(float(l.split("\t")[2]) - float(l.split("\t")[1]) for l in cortes)
arquivos = len(set(l.split("\t")[0] for l in cortes))
print(f"  {len(cortes)} cortes | {arquivos} arquivos distintos | {tot:.1f}s ({tot/60:.1f} min)")
