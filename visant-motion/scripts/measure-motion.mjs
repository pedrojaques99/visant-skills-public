#!/usr/bin/env node
/**
 * measure-motion — the feel-check, on the published URL, with numbers.
 *
 * "DevTools at 25%, look again tomorrow" is not repeatable and does not survive
 * a handoff. This drives the real page and reports what the user's device
 * actually did: INP (with attribution) and Long Animation Frames (with the
 * script that blocked them). Source scans pass clean on pages that are broken —
 * measure the URL, not the repo.
 *
 *   node scripts/measure-motion.mjs https://app.example.com
 *   node scripts/measure-motion.mjs <url> --click "[data-testid=row],#open"
 *   node scripts/measure-motion.mjs <url> --reduced-motion   # a11y audit pass
 *   node scripts/measure-motion.mjs <url> --json --budget-inp 200
 *
 * Exit 1 when INP or a blocking frame busts budget (or reduced-motion leaks).
 *
 * Requires Playwright. If it isn't in the project:
 *   npm i -D playwright && npx playwright install chromium
 * INP uses the web-vitals library (loaded from unpkg) — pass --no-inp offline.
 */

import { join } from "node:path";

/* -------------------------------------------------------------------------- */
/* Args                                                                       */
/* -------------------------------------------------------------------------- */

const argv = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};
const has = (name) => argv.includes(name);

const url = argv.find((a) => /^https?:\/\//.test(a) || a.startsWith("file://"));
if (!url) {
  console.error("usage: node measure-motion.mjs <url> [--click sel,sel] [--reduced-motion] [--json]");
  process.exit(2);
}

const json = has("--json");
const reducedMotion = has("--reduced-motion");
const wantInp = !has("--no-inp");
const budgetInp = Number(flag("--budget-inp", 200));
const budgetBlocking = Number(flag("--budget-blocking", 100));
const clickSelectors = (flag("--click", "") || "").split(",").filter(Boolean);

/* -------------------------------------------------------------------------- */
/* Playwright                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * This script lives in the skill, but Playwright lives in the *project*. A bare
 * `import("playwright")` resolves relative to this file and would never find
 * it — resolve from the cwd instead, then fall back to a bare import for the
 * case where the script was copied into the repo.
 */
async function loadPlaywright() {
  const { createRequire } = await import("node:module");
  const { pathToFileURL } = await import("node:url");
  const requireFromCwd = createRequire(join(process.cwd(), "__motion-lint__.js"));

  // Playwright's entry is CJS, so importing it by file URL puts the exports on
  // `.default` — unwrap, or `chromium` reads as undefined.
  const unwrap = (mod) => mod?.chromium ? mod : mod?.default?.chromium ? mod.default : null;

  for (const pkg of ["playwright", "playwright-core"]) {
    for (const load of [
      () => import(pathToFileURL(requireFromCwd.resolve(pkg)).href),
      () => import(pkg),
    ]) {
      try {
        const mod = unwrap(await load());
        if (mod) return mod;
      } catch {
        /* try the next resolution strategy */
      }
    }
  }
  console.error(
    "measure-motion: Playwright not found in this project.\n" +
      "  npm i -D playwright && npx playwright install chromium",
  );
  process.exit(2);
}

const { chromium } = await loadPlaywright();

/* -------------------------------------------------------------------------- */
/* Collector — injected before any app code runs                              */
/* -------------------------------------------------------------------------- */

const collector = () => {
  window.__motion = { loaf: [], inp: null };

  // Long Animation Frames: frames that blew past the ~50ms budget, with the
  // script that caused it. This is the jank the user feels but never reports.
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__motion.loaf.push({
          duration: Math.round(entry.duration),
          blockingDuration: Math.round(entry.blockingDuration ?? 0),
          renderStart: Math.round(entry.renderStart ? entry.renderStart - entry.startTime : 0),
          styleAndLayout: Math.round(
            entry.styleAndLayoutStart ? entry.duration - (entry.styleAndLayoutStart - entry.startTime) : 0,
          ),
          scripts: (entry.scripts ?? []).slice(0, 3).map((s) => ({
            name: s.name,
            duration: Math.round(s.duration),
            source: `${s.sourceURL ?? "?"}${s.sourceFunctionName ? ` › ${s.sourceFunctionName}` : ""}`,
            invoker: s.invoker ?? s.invokerType ?? "",
          })),
        });
      }
    }).observe({ type: "long-animation-frame", buffered: true });
  } catch {
    window.__motion.loafUnsupported = true; // Chromium 123+ only
  }
};

/* -------------------------------------------------------------------------- */
/* Run                                                                        */
/* -------------------------------------------------------------------------- */

const browser = await chromium.launch();
const context = await browser.newContext(reducedMotion ? { reducedMotion: "reduce" } : {});
const page = await context.newPage();
await page.addInitScript(collector);

const notes = [];
await page.goto(url, { waitUntil: "networkidle" }).catch(async (e) => {
  notes.push(`navigation: ${e.message.split("\n")[0]}`);
  await page.goto(url, { waitUntil: "domcontentloaded" });
});

// INP via web-vitals (the validated implementation — p98 of interactions, not
// "the slowest event", which is a different and wronger number).
if (wantInp) {
  try {
    await page.addScriptTag({
      url: "https://unpkg.com/web-vitals@5/dist/web-vitals.attribution.iife.js",
    });
    await page.evaluate(() => {
      webVitals.onINP((metric) => {
        window.__motion.inp = {
          value: Math.round(metric.value),
          rating: metric.rating,
          target: metric.attribution?.interactionTarget ?? "",
          type: metric.attribution?.interactionType ?? "",
          inputDelay: Math.round(metric.attribution?.inputDelay ?? 0),
          processing: Math.round(metric.attribution?.processingDuration ?? 0),
          presentation: Math.round(metric.attribution?.presentationDelay ?? 0),
          loafCount: metric.attribution?.longAnimationFrameEntries?.length ?? 0,
        };
      }, { reportAllChanges: true });
    });
  } catch (e) {
    notes.push(`INP skipped (web-vitals unreachable — use --no-inp offline): ${e.message.split("\n")[0]}`);
  }
}

/* Interactions. Explicit selectors if given, otherwise the first handful of
   visible controls — enough to make the page do its work. */
const targets = clickSelectors.length
  ? clickSelectors
  : ["button", "[role='button']", "a[href]", "[data-testid]"];

let interactions = 0;
for (const sel of targets) {
  const els = await page.locator(sel).all().catch(() => []);
  for (const el of els.slice(0, clickSelectors.length ? 3 : 4)) {
    if (!(await el.isVisible().catch(() => false))) continue;
    await el.hover({ timeout: 1000 }).catch(() => {});
    await page.waitForTimeout(120);
    await el.click({ timeout: 1500, trial: false }).catch(() => {});
    interactions++;
    await page.waitForTimeout(350);
    await page.keyboard.press("Escape").catch(() => {}); // close whatever opened
    if (interactions >= 10) break;
  }
  if (interactions >= 10) break;
}

await page.mouse.wheel(0, 1200);
await page.waitForTimeout(400);
await page.mouse.wheel(0, -1200);
await page.waitForTimeout(600);

/* Reduced-motion audit: with `reduce` on, nothing should still be running a
   long animation. This is the check nobody does by hand. */
let reducedLeaks = [];
if (reducedMotion) {
  reducedLeaks = await page.evaluate(() =>
    document
      .getAnimations()
      .map((a) => {
        const t = a.effect?.getTiming?.() ?? {};
        const dur = typeof t.duration === "number" ? t.duration : 0;
        return {
          duration: Math.round(dur),
          iterations: t.iterations === Infinity ? "infinite" : t.iterations,
          name: a.animationName ?? a.transitionProperty ?? "(unnamed)",
          target: a.effect?.target?.tagName
            ? `${a.effect.target.tagName.toLowerCase()}${a.effect.target.className ? "." + String(a.effect.target.className).split(" ")[0] : ""}`
            : "?",
        };
      })
      .filter((a) => a.duration > 100),
  );
}

const data = await page.evaluate(() => window.__motion);
await browser.close();

/* -------------------------------------------------------------------------- */
/* Report                                                                     */
/* -------------------------------------------------------------------------- */

const loaf = (data.loaf ?? []).sort((a, b) => b.duration - a.duration);
const worst = loaf[0] ?? null;
const blocking = loaf.filter((f) => f.blockingDuration > 0);
const totalBlocking = blocking.reduce((s, f) => s + f.blockingDuration, 0);

const failures = [];
if (data.inp && data.inp.value > budgetInp) failures.push(`INP ${data.inp.value}ms > ${budgetInp}ms`);
if (worst && worst.blockingDuration > budgetBlocking)
  failures.push(`blocking frame ${worst.blockingDuration}ms > ${budgetBlocking}ms`);
if (reducedLeaks.length) failures.push(`${reducedLeaks.length} animation(s) still running under prefers-reduced-motion`);

if (json) {
  console.log(JSON.stringify({ url, interactions, inp: data.inp, loaf, reducedLeaks, notes, failures }, null, 2));
} else {
  console.log(`\nmeasure-motion — ${url}`);
  console.log(`  ${interactions} interaction(s)${reducedMotion ? ", prefers-reduced-motion: reduce" : ""}`);
  for (const n of notes) console.log(`  note: ${n}`);

  if (data.loafUnsupported) console.log("\n  LoAF unsupported in this browser build (needs Chromium 123+).");
  else {
    console.log(`\n  Long animation frames (>50ms): ${loaf.length}   total blocking: ${totalBlocking}ms`);
    for (const f of loaf.slice(0, 3)) {
      console.log(`    ${f.duration}ms (blocking ${f.blockingDuration}ms, render ${f.renderStart}ms)`);
      for (const s of f.scripts) console.log(`       ← ${s.duration}ms  ${s.source} ${s.invoker}`);
    }
  }

  if (data.inp) {
    const i = data.inp;
    console.log(`\n  INP: ${i.value}ms (${i.rating}) on ${i.type} → ${i.target || "?"}`);
    console.log(`       input delay ${i.inputDelay}ms · processing ${i.processing}ms · presentation ${i.presentation}ms`);
    if (i.presentation > i.processing)
      console.log("       presentation dominates → the animation/render is the cost, not the handler.");
  } else if (wantInp) {
    console.log("\n  INP: no interaction was measured (nothing clickable found, or the page ignored it).");
  }

  if (reducedMotion) {
    console.log(
      reducedLeaks.length
        ? `\n  reduced-motion LEAKS (${reducedLeaks.length}):`
        : "\n  reduced-motion: clean — nothing long still animating.",
    );
    for (const a of reducedLeaks.slice(0, 5))
      console.log(`    ${a.duration}ms ×${a.iterations}  ${a.name}  on ${a.target}`);
  }

  console.log(failures.length ? `\n  FAIL: ${failures.join("; ")}\n` : "\n  within budget\n");
}

process.exit(failures.length ? 1 : 0);
