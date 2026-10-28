/*
 * Clean twin of `signals-dirty.tsx`: the legitimate use of each signal 47-57.
 * EXPECTED: zero hits for every one of those rules in this file. Each block
 * locks one way the rule could turn into noise.
 *
 * Run: node ruido-scan.mjs --self-test
 */
import * as React from 'react';

declare const Badge: React.FC<{ children?: React.ReactNode }>;
declare const CopyButton: React.FC<{ text: string }>;

/* 47. Five tags (below the floor of 6) and an avatar pill with a fixed size. */
export function TagsComMotivo() {
  return (
    <section>
      <Badge>Pago</Badge>
      <Badge>Pendente</Badge>
      <Badge>Atrasado</Badge>
      <Badge>Cancelado</Badge>
      <Badge>Rascunho</Badge>
      <span className="rounded-full px-2 text-xs w-8 h-8 bg-muted">PJ</span>
    </section>
  );
}

/* 48. Heading italic as a whole, an icon font inside a heading, em in body text. */
export function ItalicoLegitimo() {
  return (
    <header>
      <h1 className="italic">Manifesto</h1>
      <h2>Avaliações <i className="fa-solid fa-star" /></h2>
      <p>O livro <em>Grande Sertão</em> abre a coleção.</p>
    </header>
  );
}

/* 49. Serif without tight tracking; tight tracking on a sans. */
export function SerifSemAperto() {
  return (
    <div>
      <p className="font-serif text-5xl">Estúdio de marca</p>
      <p className="font-sans text-5xl tracking-tight">Feito à mão</p>
      <p style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>Caixa de texto</p>
    </div>
  );
}

/* 51. Seven dividers (below the floor of 8), plus table rows and a sticky bar that do not count. */
export function DivisoresNoLimite() {
  return (
    <main>
      <nav className="sticky top-0 border-b">Menu</nav>
      <div className="border-t pt-8">Bloco um</div>
      <hr />
      <div className="border-b pb-8">Bloco dois</div>
      <div className="divide-y">Bloco três</div>
      <div className="border-t pt-6">Bloco quatro</div>
      <div className="border-b pb-6">Bloco cinco</div>
      <hr className="my-10" />
      <table>
        <tbody>
          <tr className="border-b"><td className="border-t">Linha</td></tr>
          <tr className="border-b"><td className="border-t">Outra</td></tr>
        </tbody>
      </table>
    </main>
  );
}

/* 52. Three steps (the catalog allows three), hover states, and text-sm/6 line height. */
export function TresTons() {
  return (
    <div>
      <p className="text-white/90 text-sm/6">Título do bloco</p>
      <p className="text-white/60 text-base/7">Linha de apoio</p>
      <p className="text-white/40 text-lg/8">Legenda menor</p>
      <button className="bg-primary/5 hover:bg-primary/10 focus:bg-primary/20 active:bg-primary/30">Salvar</button>
    </div>
  );
}

/*
 * 53. One nested box (an inset preview), one released by a written exception,
 * and real limits inside a box (input, button, pill). Below the floor of 2.
 */
export function CaixaComLimiteReal() {
  return (
    <div className="border rounded-xl p-6">
      <div className="border rounded-lg p-4">Prévia do e-mail</div>
      {/* EXCEÇÃO ao ruido-scan/box-in-box: o recibo impresso é uma folha dentro do card, a borda é o papel. */}
      <div className="border rounded-md p-4">Recibo</div>
      <input className="border rounded-md px-3" />
      <button className="border rounded-md px-3">Enviar</button>
      <span className="border rounded-full px-2">Ativo</span>
    </div>
  );
}

/* 55. Command marked as code, a path in <pre>, and a real command next to a copy button. */
export function ComandoDeVerdade() {
  return (
    <div>
      <code>$ npm install visant</code>
      <pre>~/projetos/visant</pre>
      <p>$ npx shadcn add @visant/chip</p>
      <CopyButton text="npx shadcn add @visant/chip" />
      <p>Visite https://visant.co para saber mais</p>
    </div>
  );
}

/* 56. A single step number (below the floor of 2), a clock and a date. */
export function NumeroQueImporta() {
  return (
    <div>
      <span>01 — Briefing</span>
      <time>01:30</time>
      <time>01/12</time>
    </div>
  );
}

/* 57. Nine mono labels (below the floor of 10), plus mono on code and on IDs that do not count. */
export function MonoNoCodigo({ item }: { item: { id: string; hash: string } }) {
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
      <code className="font-mono">npm run build</code>
      <span className="font-mono">{item.id}</span>
      <span className="font-mono">{item.hash}</span>
    </div>
  );
}
