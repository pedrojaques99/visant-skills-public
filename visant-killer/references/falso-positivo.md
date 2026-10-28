# Falso positivo — quando o defeito está na regra, não no código

Antes de gastar rodada em cima de uma lista de achados, meça a recompensa. Um
detector em `grep` acusa **sintaxe**; a regra que ele tenta defender é sobre
**intenção**, e a diferença aparece como ruído em massa.

Sintoma de que o defeito está na regra, e não no código: **muito achado, quase
nenhum verdadeiro**. No audit do boxy-app o `lint:design` devolveu 104 hex com ~1
verdadeiro. O resto era paleta extraída, ponto de referência do WCAG (`#fff` e
`#000`, que não podem virar token sem quebrar o cálculo de contraste), cor de
marca de terceiro, canvas e WebGL (que não leem CSS custom property), HTML de
e-mail, e uma entidade HTML (`&#9662;`) que o regex leu como cor.

O procedimento, nessa ordem:

1. **Agrupe o achado por pasta antes de ler linha.** Concentração num `lib/`, num
   `__tests__/` ou num motor de canvas é assinatura de regra mal escopada, não
   de dívida técnica.
2. **Leia a intenção escrita na própria regra.** "duration-300+ *on interactive
   elements*" e "backdrop-blur *on cards*" já traziam o escopo no título, e o
   `grep` ignorava esse escopo. Restringir cada regra à intenção que ela mesma
   declara derrubou 20 achados para 4 e 49 para ~20, sem afrouxar nada.
3. **Só então conserte o que sobrou**, que é o achado de verdade.

Regra escopada precisa de **motivo escrito dentro da regra**, com o caso que a
originou. Exclusão sem justificativa é `audit-ignore` com outro nome, e quem ler
depois não distingue decisão de desistência.

Três coisas que isso **não** autoriza: afrouxar detector porque o conserto dá
trabalho; escopar sem verificar o caso na tela (o do blur exigiu abrir a página e
ver o que havia atrás); e tratar volume alto como prova de que a regra está
errada, porque às vezes o repo está sujo mesmo. Quem decide é a taxa de acerto
lida em `arquivo:linha`, nunca o tamanho da lista.

Antes de confiar num "zero" do portão de copy, prove o extrator:

```bash
node ~/.claude/skills/visant-killer/scripts/killer-scan.mjs --self-test
```

Ele roda a extração contra `scripts/fixtures/copy-extractor.tsx`, que carrega o
contrato dentro dele (linha com `EXTRAI` tem que sair, linha com `IGNORA` não), e
falha nos dois sentidos. O falso **negativo** é o que importa: string que nunca
foi extraída faz o portão dizer zero sobre texto que ninguém checou, e isso
parece sucesso. Foi assim que se descobriu que copy dentro de template com
interpolação (`` `Acima de ${x}. Obrigatória.` ``) passava batida. Caso novo que
escapar: acrescente no fixture, nunca substitua.

Portões (todos precisam ficar em zero **no alvo**, nunca no repo inteiro):

| Portão | Zero significa |
|---|---|
| `impeccable detect` | nenhum tell de IA genérica: gradiente em texto, roxo de template, bounce, glow, accent em cima de arredondado |
| `audit:design` errors | nenhuma cor crua nem valor fora do token |
| copy (vício de linguagem) | nenhum travessão, bolinha separadora, "não é X, é Y", "é sobre X", emoji, ponto-e-vírgula, abertura de guru, selo de credibilidade repetido |

Se o repo não tiver `audit:design`, o script diz que pulou. **Portão pulado é
reportado, nunca omitido.** Depois do portão, e só depois, rode `tsc` e o lint.

