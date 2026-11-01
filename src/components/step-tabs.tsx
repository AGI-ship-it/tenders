"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useDemo } from "@/lib/store";
import { isActive } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export const STEP_ROUTES = ["/sources", "/pipeline", "/approvals"];

/** Dots gliding along the line between two circles, so the journey reads left to right. */
function FlowLine() {
  return (
    <div aria-hidden className="relative mt-14 h-0.5 flex-1 overflow-hidden rounded-full bg-zinc-300/70">
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
    <div className="mb-6 shrink-0">
      <ol className="mx-auto flex max-w-4xl items-start px-2 pt-2 pb-1">
        {steps.map((s, i) => {
          const on = pathname.startsWith(s.href);
          return (
            <li key={s.href} className="contents">
              <Link
                href={s.href}
                aria-current={on ? "page" : undefined}
                className="group flex w-48 shrink-0 flex-col items-center text-center"
              >
                <span
                  className={cn(
                    "relative grid size-28 place-items-center rounded-full transition-all duration-300",
                    on
                      ? "bg-primary text-primary-foreground shadow-soft-lg ring-8 ring-primary/10"
                      : "bg-card text-foreground shadow-soft group-hover:-translate-y-0.5",
                  )}
                >
                  {!on && <DashedRing />}
                  <span className="flex flex-col items-center leading-none">
                    <span className="tabular text-[2.75rem] font-semibold tracking-tight">{s.value}</span>
                    <span className={cn("mt-1 text-[10px] font-medium uppercase", on ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {s.unit}
                    </span>
                  </span>
                </span>
                <span className={cn("mt-3 text-sm font-semibold", on ? "text-primary" : "text-foreground")}>{s.title}</span>
                <span className="mt-0.5 text-xs text-muted-foreground">{s.action}</span>
                {on && (
                  <motion.span
                    layoutId="step-tab"
                    className="mt-2.5 h-[3px] w-10 rounded-full bg-magenta"
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
