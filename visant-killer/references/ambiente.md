# Ambiente — como saber que a tela está pronta antes de medir

Existe porque metade dos achados iniciais de uma sessão real não eram da tela,
eram do ambiente: dev server compilando 115s, hidratação parcial lida como bug,
CDP cortando em 45s. Medir antes da hora produz achado que some sozinho, e a
rodada inteira vai atrás de fantasma.

A regra: **nenhuma medida vale antes destes quatro sinais.** Se você mediu antes,
o número não é da tela — é do compilador.

## 1. A rota compilou (o erro nº1)

O dev server do Next compila **sob demanda, na primeira visita**. A primeira
carga de uma rota pesada leva de 30s a 2min. Nesse intervalo você mede:

- `scrollWidth` de um DOM que ainda é o esqueleto do layout
- LCP e INP de uma página que está esperando o bundler, não a rede
- "elemento sumiu" de um componente que ainda não foi entregue

**Aqueça antes de medir.** Visite a rota, espere terminar, e só então recarregue
para medir. A segunda carga é a que representa a experiência real.

```bash
# aquece as rotas do alvo antes de qualquer medição
for r in / /painel /painel/fiscal; do curl -s -o /dev/null -w "%{http_code} %{time_total}s $r\n" "http://localhost:3000$r"; done
```

Se o `time_total` da segunda passada não cair pra menos de 1s, não é a tela: é
build ou uma chamada de rede lenta no server component.

Melhor ainda para auditoria de aparência e de estouro: **meça no build de
produção**, não no dev. `next build && next start`. O dev injeta HMR, source maps
e overlay, e nada disso existe pro usuário.

> Nunca rode `next build` com o dev server de pé — os dois escrevem no `.next` e
> o resultado é um erro que parece bug de código.

## 2. A página hidratou

Antes de hidratar, o HTML está na tela mas nada responde: clique não faz nada,
`useState` ainda está no valor inicial do servidor, `AnimatePresence` não montou.
Uma tela nesse estado parece **quebrada** e não está.

Sinal confiável, do próprio React, no console da página:

```js
// true quando o React já assumiu o DOM
!!document.querySelector('#__next, #root, body > div')
  ?.[Object.keys(document.querySelector('#__next, #root, body > div') ?? {})
    .find(k => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'))]
```

Mais simples e suficiente na prática — plante uma marca no app e espere por ela:

```js
// no layout raiz, dentro de um useEffect
useEffect(() => { document.documentElement.dataset.hydrated = "1" }, []);
```

```js
// no medidor
await new Promise(r => {
  if (document.documentElement.dataset.hydrated) return r();
  new MutationObserver((_, o) => {
    if (document.documentElement.dataset.hydrated) { o.disconnect(); r(); }
  }).observe(document.documentElement, { attributes: true });
});
```

Sem uma marca dessas, os substitutos honestos, em ordem de confiabilidade:

1. um elemento que **só existe depois do efeito** (um `data-state` de Radix, um
   contador que começa vazio) aparecer no DOM
2. `document.readyState === "complete"` **mais** dois `requestAnimationFrame`
3. `networkidle` do Playwright/Puppeteer — só como piso, não como prova

`document.readyState` sozinho **não** significa hidratado. Ele fecha quando os
recursos carregaram, e a hidratação acontece depois.

## 3. O dado é real, e é o pior dado

Tela vazia esconde todo estouro horizontal, todo texto que quebra, toda coluna
que não cabe. Meça sempre com:

- o **melhor** registro (nome curto, poucos itens)
- o **pior** registro (nome longo, muitos itens, valor de 7 dígitos, e-mail sem
  espaço, que é o que estoura layout)

E uma vez com o **backend parado**. O zero silencioso é a mentira dominante da
casa: um fetch que falha e pinta "0" é indistinguível de um zero verdadeiro, e
essa tela passa por todos os detectores.

## 4. A ferramenta de medição não cortou

CDP (Chrome DevTools Protocol) e drivers headless têm timeout padrão curto —
30s a 45s é comum. Numa rota que compila em 115s, o driver **desiste antes** e
devolve um DOM parcial, sem erro nenhum. O resultado é um achado inventado.

- suba os timeouts pro dobro do pior tempo de compilação observado
- **sempre** compare a contagem de nós: `document.querySelectorAll('*').length`
  na medição contra a mesma contagem com a página aberta à mão. Divergência
  grande significa que você mediu meia página.
- se a medição devolver 0 achado E 0 nó de conteúdo, trate como **falha da
  medição**, nunca como tela limpa

## Falso positivo clássico de medição

Já aconteceu e vai acontecer de novo: um blob decorativo com `overflow-hidden`
no pai foi lido como 64px de estouro a 390px. O elemento realmente é mais largo
que a viewport — e é recortado, então não estoura nada.

Meça o estouro no **documento**, não no elemento:

```js
document.documentElement.scrollWidth - document.documentElement.clientWidth
```

Se der 0, não há estouro, por mais largo que algum filho pareça. Para achar o
culpado quando dá > 0, ande no DOM comparando `getBoundingClientRect().right`
contra `innerWidth` **e** confira se algum ancestral tem `overflow` diferente de
`visible` antes de acusar.

## Quando a janela MENTE que redimensionou (390px sem device emulation)

Verificado em 2026-08-12, no visant-board: `resize_window` do harness de browser
devolveu **"Successfully resized to 420x900"** e o `innerWidth` da página
continuou em **1920**. Sem `innerWidth`, nenhuma media query do Tailwind muda —
a medida sai do layout desktop com nome de mobile, que é pior que não medir.

**Sempre confirme o redimensionamento pelo lado da PÁGINA**, nunca pela resposta
da ferramenta:

```js
innerWidth // é este número que as media queries leem, não o da janela
```

Se ele não mudou, o caminho é o iframe — media query responde à largura do
**iframe**, não à da janela:

```js
const f = document.createElement('iframe');
f.style.cssText = 'position:fixed;left:0;top:0;width:390px;height:844px;z-index:2147483647';
f.src = 'about:blank';                       // about:blank herda a origem
document.body.appendChild(f);
// X-Frame-Options: DENY (comum em app sério) impede apontar o src pra rota.
// Buscar o HTML e ESCREVER dentro do frame contorna sem afrouxar o header:
const html = await fetch('/rota', { credentials: 'include' }).then(r => r.text());
const d = f.contentDocument; d.open();
d.write(html.replace(/<head([^>]*)>/i, `<head$1><base href="${location.origin}/">`));
d.close();                                    // <base> pro Next achar os chunks
```

Três armadilhas, todas já pagas:

- **`f.src = '/rota'` falha com `SecurityError`** quando o app manda
  `X-Frame-Options: DENY`: o frame vira página de erro, que é outra origem, e
  ler `contentWindow.innerWidth` estoura. O sintoma engana — parece bug de
  cross-origin num mesmo host.
- **Sem `<base href>`**, o Next não resolve os chunks e o frame fica no HTML
  cru: você mede o servidor, não o app.
- **Confirme a hidratação DENTRO do frame** (`body.innerText.length`, contagem
  de linhas, um texto que só existe depois do dado) antes de acreditar no
  número. Esqueleto não estoura: um `overflowPx: 0` com 260 caracteres de texto
  é medição de placeholder.

Em repo Visant, isto já existe pronto: `scripts/audit-mobile-overflow.js`
(`auditRoute('/rota')`, `auditDialogs()`, `auditScrollers()`). Procure o script
antes de escrever o seu — ele já reduz o culpado ao elemento **mais externo** e
descarta o que está clipado por ancestral.

## Checklist, para colar no relatório

```
[ ] rota aquecida (segunda carga < 1s) ou medida em `next start`
[ ] hidratação confirmada (marca no DOM, não readyState)
[ ] largura confirmada por `innerWidth` da PÁGINA, não pela resposta do resize
[ ] dado real: melhor registro, pior registro, e backend parado
[ ] contagem de nós bate com a página aberta à mão
[ ] estouro medido no documento, com overflow do ancestral verificado
```

Achado levantado sem essas cinco linhas fechadas entra no relatório como
**suspeita**, não como defeito.
