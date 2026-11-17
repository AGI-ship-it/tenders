"use client";

import { motion, useReducedMotion } from "motion/react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** The small animated AI mark: a gradient sparkle that ripples, with the AI's note on hover. */
export function AiSpark({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <Tooltip>
      <TooltipTrigger
        render={<button aria-label={label} />}
        className={cn(
          "group/ai relative grid size-8 shrink-0 place-items-center rounded-full bg-linear-to-br from-primary to-magenta text-white shadow-md shadow-primary/30 transition-transform hover:scale-110",
          className,
        )}
      >
        {/* Soft ripple and a twinkling sparkle, so the AI note invites a look */}
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full bg-primary/40"
          animate={reduce ? undefined : { scale: [1, 1.7], opacity: [0.55, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
        />
        <motion.span
          className="relative"
          animate={reduce ? undefined : { rotate: [0, 18, -10, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 0.6, ease: "easeInOut" }}
        >
          <Sparkles className="size-4" />
        </motion.span>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" className="max-w-80 flex-col items-start gap-1 text-left">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
