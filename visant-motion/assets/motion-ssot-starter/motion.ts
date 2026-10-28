/**
 * Motion SSoT — the single source of truth for all animation in the app.
 *
 * These easing curves + durations mirror the `--ease-*` / `--dur-*` CSS tokens
 * in `app/globals.css` (CSS side) so JS-driven (framer-motion) and CSS-driven
 * (Tailwind / Radix data-state) motion stay in lockstep. Never hardcode a
 * cubic-bezier or a duration in a component again — import from here.
 *
 * Values come from Emil Kowalski's animation philosophy (animations.dev):
 * strong ease-out for entrances (built-in CSS easings are too weak), UI motion
 * under ~300ms, springs only for momentum/gesture-driven interactions.
 */
import type { Transition, Variants } from "framer-motion";

/* -------------------------------------------------------------------------- */
/* Easing — mirror of --ease-* in globals.css                                 */
/* -------------------------------------------------------------------------- */

/** Strong ease-out. Default for anything entering/exiting or responding to input. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
/** Strong ease-in-out. For elements moving/morphing on-screen (not enter/exit). */
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
/** iOS-like drawer/sheet curve (Ionic). For bottom sheets and drawers. */
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;

/* -------------------------------------------------------------------------- */
/* Durations (seconds — framer-motion unit). Mirror of --dur-* in globals.css */
/* -------------------------------------------------------------------------- */

export const DUR = {
  /** Button/press feedback. */
  press: 0.12,
  /** Tooltips, small popovers, hovers. */
  fast: 0.16,
  /** Dropdowns, selects, cards, list items. */
  base: 0.2,
  /** Modals, drawers, larger surfaces. */
  slow: 0.3,
} as const;

/* -------------------------------------------------------------------------- */
/* Ready-made transitions                                                     */
/* -------------------------------------------------------------------------- */

export const transitions = {
  fast: { duration: DUR.fast, ease: EASE_OUT },
  base: { duration: DUR.base, ease: EASE_OUT },
  slow: { duration: DUR.slow, ease: EASE_OUT },
  /** Critically-ish damped spring. Use only for momentum / gesture-driven UI. */
  spring: { type: "spring", bounce: 0.2, duration: 0.4 },
  /** No overshoot — a calm settle for non-gesture reveals that still want physics. */
  springSoft: { type: "spring", bounce: 0, duration: 0.4 },
} satisfies Record<string, Transition>;

/* -------------------------------------------------------------------------- */
/* Reusable variants                                                          */
/* -------------------------------------------------------------------------- */

/** Fade + rise. The house entrance for cards, list items, empty states. */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: transitions.slow },
};

/** Plain fade — for crossfades and reduced-motion-friendly reveals. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: transitions.base },
};

/**
 * Per-item entrance for a mapped list (cards, columns). Staggers by index with
 * a short, capped delay — long stagger makes a UI feel slow (Emil: 30-80ms).
 */
export function itemEnter(index = 0, step = 0.04, cap = 0.4) {
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: DUR.slow, delay: Math.min(index * step, cap), ease: EASE_OUT },
  } as const;
}

/** Subtle press feedback for a clickable motion element (cards, tiles). */
export const pressable = {
  whileTap: { scale: 0.985 },
  transition: { duration: DUR.press, ease: EASE_OUT },
} as const;

/* -------------------------------------------------------------------------- */
/* Waiting — thresholds for pending/loading states (SKILL §3)                  */
/* -------------------------------------------------------------------------- */

/**
 * Perception thresholds, in MILLISECONDS (not seconds — these feed timers and
 * `useDelayedFlag`, not framer-motion transitions).
 *
 * They answer "what does the user see while waiting?", which is a different
 * question from "how long does the animation run?" (that's DUR).
 */
export const WAIT = {
  /** Below this, the wait reads as instant — render nothing, no loader. */
  instant: 100,
  /** Don't mount a loader before this, or it only flashes. */
  loaderDelay: 300,
  /** Once mounted, keep it at least this long — a blinking loader reads as a bug. */
  loaderMinVisible: 500,
  /** Past this, the wait needs narration: which step is running, what's next. */
  narrate: 5000,
  /** Past this, the wait needs an out: cancel, background it, or notify me. */
  escapeHatch: 10000,
} as const;

/**
 * Skeleton → content handoff. Crossfade with a 4px rise; apply to the FIRST
 * block only, never to every row (the rest is already in place — SKILL §3.4).
 */
export const revealContent: Variants = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: transitions.base },
};

/**
 * The wait tier for a given expected/elapsed duration in ms. Use it to pick the
 * treatment, not to branch mid-flight (switching treatment while the user
 * watches is itself a flicker).
 */
export function waitTier(ms: number) {
  if (ms < WAIT.instant) return "none" as const; // optimistic write + undo
  if (ms < WAIT.loaderDelay) return "hold" as const; // keep current UI
  if (ms < 1000) return "skeleton" as const; // skeleton in the final layout
  if (ms < WAIT.narrate) return "progressive" as const; // skeleton + progressive reveal
  return "narrated" as const; // steps + illustration, and an out past 10s
}
