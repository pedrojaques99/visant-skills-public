"use client";

/**
 * useDelayedFlag — the anti-flicker pair for every loading state (SKILL §3.2).
 *
 * Two failure modes it removes:
 *   1. A fast response mounts a loader for 80ms → the UI blinks and reads broken.
 *   2. A loader mounted at 290ms unmounts at 310ms → same blink, one frame later.
 *
 * So: don't show before `delay`, and once shown, hold for at least `minVisible`.
 * The user either sees no loader at all, or sees one long enough to read as
 * intentional. Never a flash.
 *
 *   const showLoader = useDelayedFlag(isPending);
 *   return showLoader ? <RowsSkeleton /> : <Rows data={data} />;
 *
 * Defaults come from WAIT in ./motion.ts — pass overrides only with a reason.
 */
import { useEffect, useRef, useState } from "react";

import { WAIT } from "./motion";

export function useDelayedFlag(
  active: boolean,
  { delay = WAIT.loaderDelay, minVisible = WAIT.loaderMinVisible } = {},
): boolean {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    // Already in the requested state — nothing to schedule.
    if (active === visible) return;

    let timer: ReturnType<typeof setTimeout>;

    if (active) {
      // Turning ON: wait out `delay`. If `active` flips back first, the cleanup
      // cancels this and the loader never mounted at all.
      timer = setTimeout(() => {
        shownAt.current = performance.now();
        setVisible(true);
      }, delay);
    } else {
      // Turning OFF: serve the remainder of `minVisible`, if any.
      const remaining = Math.max(0, minVisible - (performance.now() - shownAt.current));
      timer = setTimeout(() => setVisible(false), remaining);
    }

    return () => clearTimeout(timer);
  }, [active, visible, delay, minVisible]);

  return visible;
}
