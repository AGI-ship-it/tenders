"use client";

import { aiPrequalified } from "@/lib/scoring";
import type { Tender } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A solid four-point AI star. */
export function AiStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={cn("size-3.5 fill-current", className)}>
      <path d="M8 0c.5 4.2 2.8 6.6 8 8-5.2 1.4-7.5 3.8-8 8-.5-4.2-2.8-6.6-8-8 5.2-1.4 7.5-3.8 8-8Z" />
    </svg>
  );
}

/** The AI pre-qualification, Yes or No, as a soft watercolour pill: lavender into blue for Yes, rose for No. */
export function FitPill({ t, className }: { t: Tender; className?: string }) {
  const yes = aiPrequalified(t);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-foreground",
        yes
          ? "bg-[radial-gradient(120%_160%_at_0%_0%,#ddd0ee_0%,transparent_60%),radial-gradient(120%_160%_at_100%_100%,#cfe0ee_0%,transparent_65%),linear-gradient(90deg,#e6ddf2,#dde7f1)] dark:bg-[linear-gradient(90deg,rgb(139_92_246/0.22),rgb(56_189_248/0.16))] "
          : "bg-[linear-gradient(90deg,#f8e1e4,#f4e6ea)] text-rose-900 dark:bg-rose-500/15 dark:text-rose-200 ",
        className,
      )}
      title={yes ? "AI pre-qualified: yes" : "AI pre-qualified: no"}
    >
      <AiStar className={cn("size-2.5", yes ? "text-primary" : "text-rose-600")} />
      {yes ? "Yes" : "No"}
    </span>
  );
}
