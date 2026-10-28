/*
 * Fixture for the design-slop signals 47-57 (slop-catalog.md): every block
 * here MUST fire. Each block says how many hits it promises (EXPECTED). The
 * clean twin is `signals-clean.tsx`, which must stay silent for the same rules.
 *
 * Run: node ruido-scan.mjs --self-test
 */
import * as React from 'react';

declare const Badge: React.FC<{ children?: React.ReactNode }>;

/* 47. EXPECTED tag-everywhere: 6 (four <Badge> + two hand-made pills). */
export function CardsComTag() {
  return (
    <section>
      <article><Badge>Novo</Badge><p>Plano mensal</p></article>
      <article><Badge>IA</Badge><p>Gerador de nomes</p></article>
      <article><Badge>Beta</Badge><p>Editor de vídeo</p></article>
      <article><Badge>Pro</Badge><p>Exportar em lote</p></article>
      <span className="rounded-full px-2 text-xs bg-muted">Design</span>
      <span className="rounded-full px-2.5 text-[11px] border">Branding</span>
    </section>
  );
}

/* 48. EXPECTED italic-headline-word: 2 (em in h1, italic span in display text). */
export function HeadlineComItalico() {
  return (
    <header>
      <h1 className="font-semibold">Design que <em>converte</em></h1>
      <div className="text-6xl font-bold">Marca que <span className="italic">respira</span></div>
    </header>
  );
}

/* 49. EXPECTED display-serif-tight: 2 (font-serif + tracking-tight, Instrument Serif + negative letterSpacing). */
export function SerifApertada() {
  return (
    <div>
      <p className="font-serif text-5xl tracking-tight">Estúdio de marca</p>
      <p style={{ fontFamily: '"Instrument Serif", serif', letterSpacing: '-0.04em' }}>Feito à mão</p>
    </div>
  );
}

/* 51. EXPECTED divider-everywhere: 8 (floor is 8). */
export function DivisorEntreTudo() {
  return (
    <main>
      <div className="border-t pt-8">Bloco um</div>
      <hr />
      <div className="border-b pb-8">Bloco dois</div>
      <div className="divide-y">Bloco três</div>
      <Separator />
      <div className="border-t pt-6">Bloco quatro</div>
      <div className="border-b pb-6">Bloco cinco</div>
      <hr className="my-10" />
    </main>
  );
}
declare const Separator: React.FC;

/* 52. EXPECTED opacity-ladder: 1 (text-white in four steps). */
export function EscadaDeOpacidade() {
  return (
    <div>
      <p className="text-white/90">Título do bloco</p>
      <p className="text-white/70">Linha de apoio</p>
      <p className="text-white/50">Legenda menor</p>
      <p className="text-white/40">Rodapé quase sumido</p>
    </div>
  );
}

/* 53. EXPECTED box-in-box: 2 (two boxes inside a box; floor is 2). */
export function CaixaDentroDeCaixa() {
  return (
    <div className="border rounded-xl p-6">
      <div className="border rounded-lg p-4">Resumo do pedido</div>
      <div className="rounded-md border p-4">Entrega prevista</div>
    </div>
  );
}

/* 55. EXPECTED code-crumb: 4 (home path, shell prompt, code comment, source path). */
export function MigalhaDeCodigo() {
  return (
    <div>
      <span>~/projetos/visant</span>
      <p>$ npm install visant</p>
      <h3>// serviços</h3>
      <small>src/app/page.tsx</small>
    </div>
  );
}

/* 56. EXPECTED numbered-section: 3. */
export function SecoesNumeradas() {
  return (
    <div>
      <section><span>01 — Serviços</span><h2>O que fazemos</h2></section>
      <section><span>/02</span><h2>Como trabalhamos</h2></section>
      <section><span>§3</span><h2>Quem somos</h2></section>
    </div>
  );
}

/* 57. EXPECTED mono-everywhere: 10 (floor is 10): eyebrow, nav, button, date, counter. */
export function MonoEmTudo() {
  return (
    <div>
      <span className="font-mono">Estúdio</span>
      <a className="font-mono" href="/sobre">Sobre</a>
      <a className="font-mono" href="/casos">Casos</a>
      <button className="font-mono">Enviar</button>
      <time className="font-mono">12 out 2026</time>
      <span className="font-mono">42 projetos</span>
      <p className="font-mono">Legenda do card</p>
      <span className="font-mono">Rio de Janeiro</span>
      <span className="font-mono">Disponível</span>
      <span className="font-mono">Versão atual</span>
    </div>
  );
}
