/*
 * Fixture do `ruido-scan` — os casos que a regra PRECISA acertar.
 *
 * Cada bloco abaixo saiu de uma rodada real. Os três falsos positivos foram
 * consertados arrumando a REGRA, nunca com ignore por valor, e ficam travados
 * aqui para que a próxima edição do detector não reabra o buraco.
 *
 * Rode: node ruido-scan.mjs --self-test
 *
 * O arquivo não compila como componente de verdade e não deve: é entrada de
 * teste para um detector que lê texto, não árvore.
 */

/* A sala renderiza a caixa: é o que põe as duas portas na mesma tela (R9). */
import { PortaDaCaixa } from './ruido-porta-b';

/* ============================================================== */
/* FALSO POSITIVO 1 — genérico de TypeScript lido como tag        */
/* ============================================================== */
/* `React.useState<string | null>` casa com o padrão `>…<` porque genérico usa
 * os mesmos sinais de uma tag. Duas declarações de estado parecidas viravam
 * "duas frases com 50% das palavras em comum". ESPERADO: zero achado. */
export function FalsoPositivoGenerico() {
  const [dep, setDep] = React.useState<string | null>(null);
  const [tipo, setTipo] = React.useState<TipoFilter>(null);
  const [modo, setModo] = React.useState<Mode>("vitrine");
  return null;
}

/* ============================================================== */
/* FALSO POSITIVO 2 — verbo entre aspas é exemplo, não instrução  */
/* ============================================================== */
/* O placeholder de uma busca tolerante a acento lista termos de teste. A
 * palavra "arrastar" ali não manda ninguém arrastar nada. ESPERADO: zero. */
export function FalsoPositivoExemplo() {
  return <input placeholder={'tente "animacao", "vintage", "arrastar"'} />;
}

/* ============================================================== */
/* FALSO POSITIVO 3 — oração subordinada descreve, não manda      */
/* ============================================================== */
/* "Ao rolar, a barra encosta" é descrição de comportamento, que é o que uma
 * ficha de componente deve dizer. ESPERADO: zero. */
export function FalsoPositivoSubordinada() {
  return <p>Ao rolar, a barra encosta no cabeçalho e o fio conta quanto já passou.</p>;
}

/* ============================================================== */
/* VERDADEIRO 1 — ensina a usar                                   */
/* ============================================================== */
/* Imperativo ao lado de um controle que já tem afordância. ESPERADO: 1. */
export function VerdadeiroInstrucao() {
  return <p>Clique para abrir a ficha da peça no catálogo.</p>;
}

/* ============================================================== */
/* VERDADEIRO 2 — legenda do que vem a seguir                     */
/* ============================================================== */
/* Narra o conteúdo que aparece dois centímetros depois. ESPERADO: 1. */
export function VerdadeiroLegenda() {
  return <p>As dez peças abaixo cobrem esse intervalo inteiro, na ordem de um job.</p>;
}

/* ============================================================== */
/* VERDADEIRO 3 — rótulo gritado, três na mesma tela              */
/* ============================================================== */
/* Um é eyebrow legítimo; três é dashboard genérico. ESPERADO: 3. */
export function VerdadeiroRotulos() {
  return (
    <div>
      <span className="font-mono text-micro uppercase tracking-wider text-muted-foreground">
        tipo
      </span>
      <span className="font-mono text-micro uppercase tracking-wider text-muted-foreground">
        npm
      </span>
      <span className="font-mono text-micro uppercase tracking-widest text-muted-foreground">
        peso
      </span>
    </div>
  );
}

/* ============================================================== */
/* EXCEÇÃO — motivo escrito libera o achado                       */
/* ============================================================== */
/* O `shift` para ajuste fino é invisível por natureza: não existe pixel que
 * anuncie um modificador de teclado. ESPERADO: zero, porque o motivo está
 * escrito e cita a regra pelo nome.
 *
 * EXCEÇÃO ao `ruido-scan/ensina-a-usar`: gesto sem afordância nativa. */
export function ExcecaoComMotivo() {
  return <span>arrasta pra cima e pra baixo, shift para fino</span>;
}

/* ============================================================== */
/* INGLÊS — o mesmo defeito, outra língua                         */
/* ============================================================== */
/* A primeira versão da regra só falava português, e num repo em inglês ela
 * devolvia zero — o que é PIOR que não rodar, porque zero passa por tela limpa.
 * Um repo brasileiro tem as duas: peça de terceiro chega com copy em inglês de
 * fábrica. ESPERADO: 1 em ensina-a-usar, 1 em legenda-do-que-vem. */
export function VerdadeiroIngles() {
  return (
    <div>
      <p>Click to open the component page.</p>
      <p>The three panels below cover the whole flow, in order.</p>
    </div>
  );
}

/* FALSO POSITIVO — subordinada em inglês descreve, não manda.
 * ESPERADO: zero. */
export function FalsoPositivoSubordinadaIngles() {
  return <p>When you scroll, the bar sticks to the header and the wire fills up.</p>;
}

/* ============================================================== */
/* COLISÃO DE LÍNGUA — achados reais de repos de fora             */
/* ============================================================== */
/* Os dois vieram de uma validação em três repos alheios, e são o motivo de a
 * regra ter sido estreitada para exigir verbo COLADO ao mecanismo.
 * ESPERADO: zero nos dois. */
export function FalsoPositivoColisao() {
  return (
    <div>
      <span>Supabase Service Role Key</span>
      <p>Scale down slightly on click.</p>
    </div>
  );
}

/* FALSO POSITIVO — rótulo de campo de formulário descreve o campo, e é a função
 * dele. Não é cromo ao lado de um controle que já se explica. ESPERADO: zero. */
export function FalsoPositivoRotuloDeCampo() {
  return (
    <div>
      <p>Choose the 3D model shown on the Overview tab.</p>
      <p>Selecione o tipo de cache que deseja atualizar.</p>
    </div>
  );
}

/* ============================================================== */
/* ATRIBUIÇÃO NÃO É ATRIBUTO                                      */
/* ============================================================== */
/* Achado real em 2026-08-12 (visant-board, MemberIssuesView): empty states
 * guiados montam a mensagem numa variável, e cada ramo do `if` escreve um
 * `title` diferente. O regex de atributos casava com a ATRIBUIÇÃO, e a R5
 * comparava duas frases que NUNCA aparecem juntas — uma substitui a outra.
 *
 * Variável guarda um valor por vez. ESPERADO: zero, nas quatro frases abaixo. */
export function FalsoPositivoAtribuicaoNaoEhAtributo() {
  let title = "Nenhuma tarefa por aqui ainda";
  let hint = "Quando você receber tarefas no Linear, elas aparecem aqui.";
  if (Math.random() > 0.5) {
    title = "Nenhuma tarefa concluída ainda";
    hint = "Ao marcar tarefas como concluídas, elas ficam guardadas aqui.";
  }
  return <p>{title}</p>;
}

/* POSITIVO do par: o mesmo texto em DOIS atributos de verdade, no mesmo render,
 * continua sendo a mesma informação em dois tamanhos. Os dois precisam ser
 * atributos que a pessoa ENXERGA (`title` é tooltip, `placeholder` é o texto do
 * campo) — o par com `alt` que morava aqui saiu junto com o conserto de
 * 2026-08-19, ver o bloco "TEXTO ALTERNATIVO" logo abaixo.
 * ESPERADO: 1 achado de mesma-info-dois-tamanhos. */
export function PositivoAtributoRepetido() {
  return (
    <div>
      <button type="button" title="O relatório mensal de horas trabalhadas pelo time" />
      <input placeholder="O relatório mensal de horas trabalhadas do time" />
    </div>
  );
}

/* ============================================================== */
/* TEXTO ALTERNATIVO NÃO É CROMO VISUAL                           */
/* ============================================================== */
/* Falso positivo confirmado em 2026-08-19 (visant-club,
 * app/(club)/mural/page.tsx:73): a R3 acusou de "legenda do que vem" o `alt` de
 * uma ilustração de estado vazio, porque a descrição termina em "ao lado". O
 * `alt` é obrigação de acessibilidade, é longo por dever, e ninguém o enxerga na
 * tela — encurtá-lo é piorar o produto. `alt`, `aria-*` e `<title>`/`<desc>` de
 * SVG saem do escopo DESTE detector (seguem no do copy-lint).
 *
 * ESPERADO: zero, nas quatro descrições abaixo. */
export function FalsoPositivoTextoAlternativo() {
  return (
    <div>
      <img
        src="/art/vazio-mural.webp"
        alt="Pintura a óleo de uma parede de galeria com várias molduras penduradas e nenhuma tela dentro delas, e uma escada encostada ao lado"
      />
      <button type="button" aria-label="Clique para abrir o painel de filtros do acervo" />
      <input aria-description="As opções a seguir filtram o acervo por formato e por ano" />
      <svg viewBox="0 0 1017 135" role="img">
        <title>As três colunas abaixo mostram o funil inteiro, na ordem do job</title>
        <desc>Clique para abrir o relatório completo do funil de vendas</desc>
        <path d="M0 0h1017v135H0z" />
      </svg>
    </div>
  );
}

/* ============================================================== */
/* GENÉRICO DE TS + SETA DE FUNÇÃO NÃO SÃO TEXTO DE TELA          */
/* ============================================================== */
/* Falso positivo confirmado em 2026-08-19 (visant-club,
 * components/club/Rail.tsx:142): a R5 acusou "l.142 e l.145 — 50% das palavras
 * em comum" em cima do `>` de um `=>` fechando no `<` de um genérico. O trecho
 * extraído era `Array.from(ref.current?.querySelectorAll` — código, que ninguém
 * lê na tela. As peneiras novas: `>` precedido de `=` não abre tag, e texto de
 * interface tem parêntese equilibrado.
 *
 * ESPERADO: zero. */
export function FalsoPositivoGenericoEmCallback() {
  const itens = useCallback(
    () => Array.from(ref.current?.querySelectorAll<HTMLElement>('[data-item]') ?? []),
    []
  );
  const focaveisDe = (item: HTMLElement) =>
    Array.from(item.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
  return { itens, focaveisDe };
}

/* O contra-exemplo que impede a peneira de virar covardia: parêntese
 * EQUILIBRADO dentro de frase de tela continua sendo frase de tela, e estas duas
 * dizem a mesma coisa. ESPERADO: 1 achado de mesma-info-dois-tamanhos. */
export function PositivoFraseComParenteses() {
  return (
    <div>
      <p>O acervo (por enquanto) guarda toda aula publicada no clube.</p>
      <p>O acervo guarda toda aula publicada no clube, por enquanto.</p>
    </div>
  );
}

/* ============================================================== */
/* ESTADO VAZIO NÃO REPETE ESTADO VAZIO                           */
/* ============================================================== */
/* Achados reais em 2026-08-12 (visant-board, TeamAgendaCard e TimeSheetView):
 * ramos de um mesmo `if/else`. Uma frase SUBSTITUI a outra — a tela mostra no
 * máximo uma. ESPERADO: zero. */
export function FalsoPositivoDoisEstadosVazios() {
  const all: unknown[] = [];
  const mine: unknown[] = [];
  if (all.length === 0) return <p>Nada agendado nos próximos 14 dias.</p>;
  if (mine.length === 0) return <p>Nada seu nos próximos 14 dias.</p>;
  return <p>Nenhuma hora apontada nesta semana.</p>;
}

/* FALSO POSITIVO — `title` e `aria-label` com o mesmo texto é o padrão
 * acessível: mesmo recado, públicos diferentes. Divergir os dois seria o
 * defeito. ESPERADO: zero. */
export function FalsoPositivoNomeAcessivel() {
  return (
    <span
      role="img"
      title="Porte médio da entrega, quatro pontos"
      aria-label="Porte médio da entrega, quatro pontos"
    />
  );
}

/* ============================================================== */
/* MENSAGEM DE FALHA COMPARTILHA A FÓRMULA DE PROPÓSITO           */
/* ============================================================== */
/* Achado real em 2026-08-12 (visant-board, CommentSection): "Não foi possível
 * carregar os comentários" contra "Não foi possível carregar os membros". A
 * fórmula é a linguagem consistente da casa para erro; o que distingue as duas
 * é o complemento. Divergir pra escapar do detector pioraria a UI.
 * ESPERADO: zero. */
export function FalsoPositivoDuasMensagensDeFalha() {
  return (
    <div>
      <p>Não foi possível carregar os comentários.</p>
      <p>Não foi possível carregar os membros.</p>
    </div>
  );
}

/* ============================================================== */
/* DOIS ATRIBUTOS DO MESMO ELEMENTO NÃO SÃO DUAS FRASES DA TELA   */
/* ============================================================== */
/* Achado real em 2026-08-12 (liminal-stage, Hub.tsx:153): o campo de busca põe a
 * mesma frase no `placeholder` e no `aria-label` — uma vez pra quem vê, uma vez
 * pra quem ouve. É um campo só; a pista era a linha repetida no achado
 * ("l.153 e l.153"). Duas frases de JSX que caibam numa linha só continuam
 * sendo duas frases — por isso a exceção pede que AMBAS venham de atributo.
 * ESPERADO: zero. */
export function FalsoPositivoPlaceholderEAriaLabelDoMesmoCampo() {
  return (
    <input type="text" placeholder="buscar sala, mapa ou o que está tocando" aria-label="buscar sala, mapa ou faixa" />
  );
}

/* ============================================================== */
/* R6 · SETA EM CARACTERE — a lei, e o que ela NÃO pega           */
/* ============================================================== */
/* Ícone é ativo de biblioteca. Glifo de seta herda a métrica da fonte,
 * desalinha da linha de base, não tem peso nem tamanho, e o leitor de tela o lê
 * como texto. Aqui são DOIS achados: a seta do botão e a do link de voltar.
 * ESPERADO seta-glifo: 2. */
export function SetaEmCaractere() {
  return (
    <div>
      <a href="/x">
        Ver a proposta <span aria-hidden="true">→</span>
      </a>
      <button type="button">← Voltar</button>
    </div>
  );
}

/* O conserto: ícone importado. Nenhum glifo, nenhum SVG à mão.
 * ESPERADO: zero. */
export function SetaComoIconeDeBiblioteca({ ArrowRight }: { ArrowRight: React.ComponentType<{ className?: string }> }) {
  return (
    <a href="/x">
      Ver a proposta <ArrowRight className="size-4" />
    </a>
  );
}

/* ============================================================== */
/* R6b · SVG DE ÍCONE À MÃO vs. GRAFISMO DE MARCA                 */
/* ============================================================== */
/* A grade 24×24 é a caixa universal de ícone: quem desenha nela está
 * redesenhando algo que já existe em qualquer biblioteca.
 * ESPERADO icone-desenhado-a-mao: 1 (só o de baixo). */
export function IconeDesenhadoAMao() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/* Grafismo de marca tem viewBox próprio e NÃO é substituível por import.
 * A regra não pode acusá-lo, ou vira ruído e o time desliga o detector.
 * ESPERADO: zero. */
export function GrafismoDaMarca() {
  return (
    <svg viewBox="0 0 1017 135" aria-hidden="true">
      <path d="M0 0h1017v135H0z" />
    </svg>
  );
}

/* ============================================================== */
/* R8 · REALCE QUE NÃO DECIDE NADA                                */
/* ============================================================== */
/* `on: true` escrito à mão na fábrica de um card: o realce roda uma vez POR
 * ITEM, então a lista inteira acende e o destaque deixa de destacar.
 * Caso real: jukebox, 2026-09-11 — três discos na caixa, os três na fila, a
 * grade toda em ciano e "no ar" indistinguível de "3º na fila".
 * ESPERADO realce-que-nao-decide: 1. */
export function GradeToraAcesa({ discos }: { discos: { url: string }[] }) {
  return (
    <ul>
      {discos.map((d) => {
        const card = { on: true, flag: 'na fila' };
        return <li key={d.url} data-on={card.on}>{card.flag}</li>;
      })}
    </ul>
  );
}

/* ARGUMENTO DE CHAMADA não é descritor de item — falso positivo confirmado na
 * primeira rodada (Director.tsx:823): `{ on: true }` ali é o interruptor de uma
 * tela de vídeo passado pra um setter, e a janela de oito linhas não distingue
 * o `=> {` de um callback do `=> ({` de uma fábrica. Quem distingue é o
 * caractere antes da chave: `nome(` é chamada.
 * ESPERADO: zero. */
export function InterruptorDaTela({ setScreen }: { setScreen: (v: { on: boolean }) => void }) {
  const itens = [{ key: 'tv' }];
  return itens.map((i) => ({
    key: i.key,
    add: () => { setScreen({ on: true }) },
  }));
}

/* EXCEÇÃO ao `ruido-scan/realce-que-nao-decide`: esta peça é UMA na tela — o
   plano que o cliente já assina — e está acesa de propósito, não uma vez por
   item de lista.
 * ESPERADO: zero. */
export function PlanoAtual() {
  const cartao = { on: true, nome: 'pro' };
  return <div data-on={cartao.on}>{cartao.nome}</div>;
}

/* ============================================================== */
/* R9 · DUAS PORTAS PRO MESMO GESTO (entre arquivos)              */
/* ============================================================== */
/* O rótulo da porta daqui é, LITERALMENTE, o placeholder da porta de
 * `ruido-porta-b.tsx`. Caso real: jukebox × caixa de discos, 2026-09-11 —
 * mesma forma, mesmos ícones, bancos diferentes, e nada na tela dizia qual era
 * qual. Nenhuma regra por arquivo enxerga isto.
 *
 * Desde 2026-10-05 a regra exige a MESMA TELA, e por isso esta sala RENDERIZA a
 * caixa (`<PortaDaCaixa />`, importada no topo do arquivo), como no jukebox:
 * sem o import, as duas pontas seriam telas sem relação e a regra calaria.
 * ESPERADO porta-repetida: 2 (uma ponta aqui, uma ponta lá). */
export function PortaDaSala({ Group }: { Group: React.ComponentType<{ cap: string; children?: React.ReactNode }> }) {
  return (
    <>
      <Group cap="endereço da faixa">{null}</Group>
      <PortaDaCaixa />
    </>
  );
}

/* ============================================================== */
/* NEGATIVOS TRAVADOS EM 2026-09-21 (repo liminal-stage)          */
/* ============================================================== */

/* GLIFO DE TECLA não é seta de navegação. O símbolo impresso na tecla é a única
 * grafia que casa com o objeto físico — nenhum ícone de biblioteca substitui "a
 * tecla Enter" sem virar uma seta genérica. Vale dentro de `<kbd>` e em
 * propriedade que nomeia atalho.
 * ESPERADO seta-glifo: zero destas. */
export function TeclaDeAtalho({ Btn }: { Btn: React.ComponentType<{ hint: string }> }) {
  return (
    <>
      <span>número + <kbd>↵</kbd> anda no eixo</span>
      <Btn hint="⇧i" />
    </>
  );
}

/* OBJETO ANINHADO DENTRO DE ARGUMENTO continua sendo argumento. Antes do conserto
 * de 21/09/2026 a regra subia UM nível e parava: a chave que contém `on: true` é
 * precedida por `? `, não por `nome(`, e um setter de config de sala virava
 * "fábrica de card acesa".
 * ESPERADO realce-que-nao-decide: zero. */
export function LigaJogo({ struct }: { struct: (p: Record<string, unknown>) => void }) {
  const setJogo = (id: string) =>
    struct({ game: id ? { on: true, minigame: id, tempo: 80 } : null });
  return <button onClick={() => setJogo('gartic')}>jogo</button>;
}

/* GENÉRICO DE TS fecha com `>` e abre com `<` igual a uma tag: dois genéricos em
 * linhas vizinhas fazem o extrator ler o CÓDIGO entre eles como frase de tela.
 * O trecho tem parênteses equilibrados e nenhuma palavra reservada — passava por
 * todas as peneiras.
 * ESPERADO mesma-info-dois-tamanhos: zero. */
export function LampadasFalsas({ N }: { N: number }) {
  const falsa = {
    ids: Array<string | null>(N).fill(null),
    pesos: Array<number>(N).fill(0),
  };
  return <span>{falsa.ids.length}</span>;
}

/* NOME ACESSÍVEL IDÊNTICO em controles irmãos é simetria, não repetição: dois
 * botões que fazem a mesma coisa em sentidos opostos precisam do mesmo nome.
 * ESPERADO mesma-info-dois-tamanhos: zero. */
export function MoverNaFileira({ Btn, slot }: { Btn: React.ComponentType<{ label: string }>; slot: number }) {
  return (
    <>
      <Btn label={`mover a peça para a tecla ${slot - 1}`} />
      <Btn label={`mover a peça para a tecla ${slot + 1}`} />
    </>
  );
}
