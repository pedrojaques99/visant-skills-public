// Fixture: every defect here is deliberate AND suppressed with a reason.
// The self-test asserts this file reports ZERO findings — if suppression ever
// breaks, an audit starts drowning in noise it was told to ignore.
import { motion } from "framer-motion";

export function DeliberateMarketingHero({ isPending }) {
  return (
    <section>
      {/* motion-lint-disable-next-line slow-ui-duration  scroll-driven hero, deliberate and audited */}
      <div className="duration-[900ms] transition-transform" />

      {/* motion-lint-disable-next-line hardcoded-curve  one-off brand curve signed off by design */}
      <div style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }} />

      {/* motion-lint-disable-next-line whiletap-inherits-transition  press handled by the shared Button underneath */}
      <motion.div whileTap={{ scale: 0.99 }} />

      {/* motion-lint-disable-next-line loader-without-guard  server-rendered, never flashes client-side */}
      {isPending && <Spinner />}

      {/* motion-lint-disable-next-line transition-all
          A reason long enough to WRAP, which is the whole point of this case:
          blanking only the comment body left the closing `}` of the JSX wrapper
          sitting on this line, the suppression climb read that `}` as the end of
          a block, and every multi-line reason in JSX was silently discarded.
          Single-line reasons passed by luck — the marker is found before the
          brace is ever reached — so the bug hid behind a green self-test. */}
      <div className="transition-all" />
    </section>
  );
}
