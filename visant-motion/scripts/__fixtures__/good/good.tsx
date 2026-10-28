import { motion } from "framer-motion";
import { DUR, EASE_OUT } from "@/lib/motion";
import { useDelayedFlag } from "@/lib/use-delayed-flag";

export function Good({ isPending }) {
  const showLoader = useDelayedFlag(isPending);
  return (
    <div className="transition-colors ease-in-out duration-200">
      <motion.button
        whileTap={{ scale: 0.985, transition: { duration: DUR.press, ease: EASE_OUT } }}
      >
        go
      </motion.button>
      {showLoader && <Skeleton />}
      <PopoverContent className="origin-[var(--radix-popover-content-transform-origin)] data-[state=open]:animate-in" />
    </div>
  );
}
