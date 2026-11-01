"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useDemo } from "@/lib/store";
import { isActive } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import { boldD365 } from "@/components/shared";

export const STEP_ROUTES = ["/sources", "/pipeline", "/approvals"];

/** Dots gliding along the line between two circles, so the journey reads left to right. */
function FlowLine() {
  return (
    <div aria-hidden className="relative mt-8 h-0.5 min-w-4 flex-1 sm:mt-12 md:mt-14 overflow-hidden rounded-full bg-zinc-300/70">
      {[0, 0.6, 1.2].map((delay) => (
        <motion.span
          key={delay}
          className="absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-primary/70"
          initial={{ left: "-4%" }}
          animate={{ left: "104%" }}
          transition={{ duration: 1.8, delay, repeat: Infinity, ease: "linear" }}
        />
      ))}
    </div>
  );
}

/**
 * Scan Portal → Prospects → Approval Center. Each circle shows its key number and opens its screen below.
 */
export function StepTabs() {
  // First-time setup belongs to step 1, so Scan Portal shows as selected there.
  const path = usePathname();
  const pathname = path.startsWith("/onboarding") ? "/sources" : path;
  const demo = useDemo();
  if (!demo) return null;

  const { tenders } = demo;
  const open = tenders.filter(isActive).length;
  const awaiting = tenders.filter((t) => t.status === "Awaiting HoD").length;
  const portals = demo.sources.filter((s) => s.kind !== "Upload");
  const connected = portals.filter((s) => s.status === "Connected").length;

  const steps = [
    {
      href: "/sources",
      title: "Scan Portal",
      action: "Connect & scan",
      value: connected,
      unit: "sources",
    },
    {
      href: "/pipeline",
      title: "Prospects",
      action: "Review & send for approval",
      value: open,
      unit: "open",
    },
    {
      href: "/approvals",
      title: "Approval Center",
      action: "HoD approves → D365",
      value: awaiting,
      unit: "awaiting",
    },
  ];

  return (
    <div className="dot-grid shrink-0 border-b bg-zinc-50/60 pt-4 pb-2 sm:pt-5 sm:pb-3">
      <ol className="mx-auto flex max-w-4xl items-start px-1 pt-2 pb-1 sm:px-2">
        {steps.map((s, i) => {
          const on = pathname.startsWith(s.href);
          return (
            <li key={s.href} className="contents">
              <Link
                href={s.href}
                aria-current={on ? "page" : undefined}
                className="group flex w-24 shrink-0 flex-col items-center text-center sm:w-36 md:w-48"
              >
                <span
                  className={cn(
                    "relative grid size-16 place-items-center rounded-full transition-all duration-300 sm:size-24 md:size-28",
                    on
                      ? "bg-primary text-primary-foreground shadow-soft-lg ring-4 ring-primary/10 md:ring-8"
                      : "bg-card text-foreground shadow-soft group-hover:-translate-y-0.5",
                  )}
                >
                  {!on && <DashedRing />}
                  <span className="flex flex-col items-center leading-none">
                    <span
                      className={cn(
                        "tabular text-xl font-extrabold tracking-tight sm:text-3xl md:text-[2.25rem]",
                        // Open prospects and awaiting approvals are the counts to act on, so they stand out in dark purple.
                        !on && i > 0 && "text-primary",
                      )}
                    >
                      {s.value}
                    </span>
                    <span className={cn("mt-0.5 text-[8px] font-medium uppercase sm:mt-1 sm:text-[10px]", on ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {s.unit}
                    </span>
                  </span>
                </span>
                <span className={cn("mt-2 text-xs font-bold sm:mt-3 sm:text-sm", on ? "text-primary" : "text-foreground")}>{s.title}</span>
                <span className="mt-0.5 hidden text-xs text-muted-foreground sm:block">{boldD365(s.action)}</span>
                {on && (
                  <motion.span
                    layoutId="step-tab"
                    className="mt-2 h-[3px] w-8 rounded-full bg-magenta sm:mt-2.5 sm:w-10"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
              </Link>
              {i < steps.length - 1 && <FlowLine />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Evenly spaced, round-capped dashes drawn as SVG (CSS dashed borders bunch
 * up unevenly on circles). Turns primary and drifts slowly on hover.
 */
function DashedRing() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 size-full text-zinc-300 transition-colors duration-300 group-hover:animate-[spin_24s_linear_infinite] group-hover:text-primary/60 motion-reduce:group-hover:animate-none"
    >
      {/* pathLength 120 with a 1.4 + 2.6 pattern gives exactly 30 dashes, so the seam is invisible. */}
      <circle cx="50" cy="50" r="48.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" pathLength={120} strokeDasharray="1.4 2.6" />
    </svg>
  );
}
