# Environment: how to know the screen is ready before you measure

This exists because, in a real session, half of the first findings weren't from
the screen. They were from the environment: a dev server compiling for 115s,
partial hydration read as a bug, CDP cutting off at 45s. Measuring too early
produces findings that vanish on their own, and the whole round chases ghosts.

The rule: **no measurement counts before these four signals.** If you measured
before, the number isn't from the screen, it's from the compiler.

## 1. The route compiled (error #1)

The Next dev server compiles **on demand, on the first visit**. The first load
of a heavy route takes 30s to 2min. In that window you're measuring:

- `scrollWidth` of a DOM that's still the layout skeleton
- LCP and INP of a page waiting on the bundler, not the network
- "element disappeared" on a component that hasn't been delivered yet

**Warm up before measuring.** Visit the route, wait for it to finish, and only
then reload to measure. The second load is the one that represents the real
experience.

```bash
# warm up the target routes before any measurement
for r in / /painel /painel/fiscal; do curl -s -o /dev/null -w "%{http_code} %{time_total}s $r\n" "http://localhost:3000$r"; done
```

If `time_total` on the second pass doesn't drop below 1s, it's not the screen:
it's the build or a slow network call in the server component.

Even better for appearance and overflow audits: **measure on the production
build**, not dev. `next build && next start`. Dev injects HMR, source maps and
the overlay, and none of that exists for the user.

> Never run `next build` with the dev server up: both write to `.next` and the
> result is an error that looks like a code bug.

## 2. The page hydrated

Before hydration, the HTML is on screen but nothing responds: clicks do nothing,
`useState` is still at the server's initial value, `AnimatePresence` hasn't
mounted. A screen in that state looks **broken** and isn't.

Reliable signal, from React itself, in the page console:

```js
// true once React has taken over the DOM
!!document.querySelector('#__next, #root, body > div')
  ?.[Object.keys(document.querySelector('#__next, #root, body > div') ?? {})
    .find(k => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'))]
```

Simpler and good enough in practice: plant a marker in the app and wait for it.

```js
// in the root layout, inside a useEffect
useEffect(() => { document.documentElement.dataset.hydrated = "1" }, []);
```

```js
// in the measurer
await new Promise(r => {
  if (document.documentElement.dataset.hydrated) return r();
  new MutationObserver((_, o) => {
    if (document.documentElement.dataset.hydrated) { o.disconnect(); r(); }
  }).observe(document.documentElement, { attributes: true });
});
```

Without a marker like that, the honest substitutes, in order of reliability:

1. an element that **only exists after the effect** (a Radix `data-state`, a
   counter that starts empty) shows up in the DOM
2. `document.readyState === "complete"` **plus** two `requestAnimationFrame`
3. Playwright/Puppeteer `networkidle`: only as a floor, not as proof

`document.readyState` alone does **not** mean hydrated. It closes when the
resources have loaded, and hydration happens after that.

## 3. The data is real, and it's the worst data

An empty screen hides every horizontal overflow, every text that wraps, every
column that doesn't fit. Always measure with:

- the **best** record (short name, few items)
- the **worst** record (long name, many items, a 7-digit value, an email with no
  spaces, which is what breaks layouts)

And once with the **backend stopped**. The silent zero is the dominant lie: a
fetch that fails and paints "0" is indistinguishable from a true zero, and that
screen passes every detector.

## 4. The measuring tool didn't cut off

CDP (Chrome DevTools Protocol) and headless drivers have short default timeouts,
30s to 45s is common. On a route that compiles in 115s, the driver **gives up
first** and returns a partial DOM, with no error at all. The result is an
invented finding.

- raise the timeouts to twice the worst compile time you've seen
- **always** compare the node count: `document.querySelectorAll('*').length`
  in the measurement against the same count with the page opened by hand. A big
  gap means you measured half a page.
- if the measurement returns 0 findings AND 0 content nodes, treat it as a
  **measurement failure**, never as a clean screen

## Classic measurement false positive

It has happened and will happen again: a decorative blob with `overflow-hidden`
on the parent was read as 64px of overflow at 390px. The element really is wider
than the viewport, and it's clipped, so it doesn't overflow anything.

Measure overflow on the **document**, not the element:

```js
document.documentElement.scrollWidth - document.documentElement.clientWidth
```

If it's 0, there's no overflow, however wide some child looks. To find the
culprit when it's > 0, walk the DOM comparing `getBoundingClientRect().right`
against `innerWidth` **and** check whether any ancestor has `overflow` other than
`visible` before accusing.

## When the window LIES that it resized (390px without device emulation)

Verified in a real session: the browser harness `resize_window` returned
**"Successfully resized to 420x900"** and the page's `innerWidth` stayed at
**1920**. Without `innerWidth`, no Tailwind media query changes: the measurement
comes from the desktop layout with a mobile label, which is worse than not
measuring.

**Always confirm the resize from the PAGE side**, never from the tool's response:

```js
innerWidth // this is the number media queries read, not the window's
```

If it didn't change, the way out is an iframe: media queries respond to the
**iframe's** width, not the window's.

```js
const f = document.createElement('iframe');
f.style.cssText = 'position:fixed;left:0;top:0;width:390px;height:844px;z-index:2147483647';
f.src = 'about:blank';                       // about:blank inherits the origin
document.body.appendChild(f);
// X-Frame-Options: DENY (common in serious apps) blocks pointing src at the route.
// Fetching the HTML and WRITING it into the frame works around it without loosening the header:
const html = await fetch('/rota', { credentials: 'include' }).then(r => r.text());
const d = f.contentDocument; d.open();
d.write(html.replace(/<head([^>]*)>/i, `<head$1><base href="${location.origin}/">`));
d.close();                                    // <base> so Next can find the chunks
```

Three traps, all already paid for:

- **`f.src = '/rota'` fails with `SecurityError`** when the app sends
  `X-Frame-Options: DENY`: the frame becomes an error page, which is another
  origin, and reading `contentWindow.innerWidth` throws. The symptom misleads:
  it looks like a cross-origin bug on the same host.
- **Without `<base href>`**, Next can't resolve the chunks and the frame stays on
  raw HTML: you're measuring the server, not the app.
- **Confirm hydration INSIDE the frame** (`body.innerText.length`, row count, a
  text that only exists after the data) before believing the number. A skeleton
  doesn't overflow: an `overflowPx: 0` with 260 characters of text is a
  placeholder measurement.

Some repos already ship this ready-made (for example a
`scripts/audit-mobile-overflow.js` with `auditRoute('/rota')`, `auditDialogs()`,
`auditScrollers()`). Look for the script before writing your own: a good one
already narrows the culprit to the **outermost** element and discards what an
ancestor clips.

## Checklist, to paste into the report

```
[ ] route warmed up (second load < 1s) or measured on `next start`
[ ] hydration confirmed (marker in the DOM, not readyState)
[ ] width confirmed by the PAGE's `innerWidth`, not the resize response
[ ] real data: best record, worst record, and backend stopped
[ ] node count matches the page opened by hand
[ ] overflow measured on the document, with ancestor overflow checked
```

A finding raised without those lines checked goes into the report as a
**suspicion**, not a defect.
