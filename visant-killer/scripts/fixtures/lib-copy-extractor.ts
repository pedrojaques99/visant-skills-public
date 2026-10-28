/* Fixture do extrator de copy em `.ts` (`extractLibCopy`). NÃO é lib de verdade.
 *
 * Mesmo contrato do fixture de `.tsx`:
 *   toda linha cuja copy DEVE ser extraída contém a palavra EXTRAI, DENTRO da string;
 *   toda linha que NÃO deve ser extraída contém a palavra IGNORA.
 *
 * Este arquivo existe por um falso NEGATIVO real, que é o grave: o extrator só olhava
 * `.tsx`, então frase escrita numa lib e RENDERIZADA pela tela nunca era varrida. No
 * mockup-store (2026-08-05) o `art-classify.ts` devolvia
 * `reason: "proporção casa com a superfície <travessão> preenche sem cortar"`, e o
 * painel de render mandava essa string direto pro olho do usuário. O portão dizia
 * "copy zero" com vício de linguagem na tela.
 *
 * A regra é o CONTRATO, não a extensão: `.ts` entra pela propriedade que existe para
 * virar texto de tela (`label`, `title`, `reason`, `message`…). Log, chave, id e
 * mensagem de servidor ficam de fora de propósito — varrer `.ts` inteiro faria o portão
 * gritar em código, e portão que grita em código é portão que se desliga.
 *
 * Cada caso abaixo já mordeu ou delimita a regra. Não apague nenhum: acrescente.
 */

export type Decision = { mode: string; reason: string };

export const VETOR: Decision = {
  mode: "contain",
  reason: "EXTRAI a arte é vetor, então foi encaixada inteira para não cortar a marca",
};

export const OPCOES = [
  { value: "cover", label: "EXTRAI preencher corta o que sobra" },
];

export const PASSO = {
  title: "EXTRAI escolha a superfície do mockup",
  description: "EXTRAI cada face do PSD vira um destino possível para a sua arte",
};

// Template com interpolação: o `${}` sai e o que sobra continua sendo copy.
export const AVISO = {
  message: `EXTRAI a fonte é ampliada ${1.9} vezes para caber na superfície`,
};

// IGNORA: caminho de arquivo não é copy, mesmo em propriedade de rótulo.
export const ORIGEM = { title: "src/lib/art-classify.ts" };

// IGNORA: `url` não é propriedade que vira texto de tela.
export const ENDPOINT = { url: "https://api.visantlabs.com/v1/render" };

// IGNORA: sem espaço, é identificador e não frase.
export const CHAVE = { label: "cover_mode" };

// IGNORA: constante de controle, não propriedade de copy.
export const DELAY = 4000;

// IGNORA: className é string, e string de classe não é copy.
export const ESTILO = { label: "flex items-center gap-2 text-xs" };
