import { motion } from "framer-motion";

export function Bad({ isPending, progress }) {
  const pct = Math.min(progress, 90);
  return (
    <div className="transition-all ease-in duration-[400ms] hover:scale-105">
      <motion.button whileTap={{ scale: 0.98 }} style={{ transition: "cubic-bezier(0.4,0,1,1)" }}>
        go
      </motion.button>
      <motion.div animate={{ width: 200 }} transition={{ duration: 0.45 }} />
      {isPending && <Spinner />}
      <PopoverContent className="data-[state=open]:animate-in">menu</PopoverContent>
      <span style={{ transform: "scale(0)" }} />
    </div>
  );
}
