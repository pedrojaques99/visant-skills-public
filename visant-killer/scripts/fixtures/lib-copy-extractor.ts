/* Fixture of the `.ts` copy extractor (`extractLibCopy`). NOT a real lib.
 *
 * Same contract as the `.tsx` fixture:
 *   every line whose copy MUST be extracted contains the word EXTRAI, INSIDE the string;
 *   every line that must NOT be extracted contains the word IGNORA.
 *
 * This file exists because of a real false NEGATIVE, the serious kind: the
 * extractor only looked at `.tsx`, so a sentence written in a lib and RENDERED
 * by the screen was never scanned. In mockup-store (2026-08-05) `art-classify.ts`
 * returned a `reason:` string with a dash (written here as <dash>), and the
 * render panel sent that string straight to the user's eye. The gate said
 * "copy zero" with a language tic on screen.
 *
 * The rule is the CONTRACT, not the extension: `.ts` gets in through the property
 * that exists to become screen text (`label`, `title`, `reason`, `message`...).
 * Logs, keys, ids and server messages stay out on purpose: scanning all of `.ts`
 * would make the gate shout at code, and a gate that shouts at code gets turned off.
 *
 * Every case below has bitten or bounds the rule. Do not delete any: add.
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

// Template with interpolation: the `${}` goes and what is left is still copy.
export const AVISO = {
  message: `EXTRAI a fonte é ampliada ${1.9} vezes para caber na superfície`,
};

// IGNORA: a file path is not copy, even in a label property.
export const ORIGEM = { title: "src/lib/art-classify.ts" };

// IGNORA: `url` is not a property that becomes screen text.
export const ENDPOINT = { url: "https://api.visantlabs.com/v1/render" };

// IGNORA: no space, it is an identifier and not a sentence.
export const CHAVE = { label: "cover_mode" };

// IGNORA: a control constant, not a copy property.
export const DELAY = 4000;

// IGNORA: className is a string, and a class string is not copy.
export const ESTILO = { label: "flex items-center gap-2 text-xs" };
