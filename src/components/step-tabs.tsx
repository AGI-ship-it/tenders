"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import { useDemo } from "@/lib/store";
import { aiPrequalified, isActive } from "@/lib/scoring";
import { daysSince } from "@/lib/format";
import { cn } from "@/lib/utils";
import { boldD365 } from "@/components/shared";

export const STEP_ROUTES = ["/sources", "/pipeline", "/approvals"];

/** Days an HoD has to decide before a prospect counts as overdue. */
const DECISION_SLA_DAYS = 3;

/**
 * The line between two circles. Steps already passed fill with the purple-to-magenta gradient;
 * small comets glide along it so the journey reads left to right.
 */
function FlowLine({ filled }: { filled: boolean }) {
  return (
    <div aria-hidden className="relative mt-8 h-[3px] min-w-4 flex-1 overflow-hidden rounded-full bg-zinc-300/60 sm:mt-12 md:mt-14">
      <motion.span
        className="absolute inset-0 origin-left rounded-full bg-linear-to-r from-primary/80 to-magenta/70"
        initial={false}
        animate={{ scaleX: filled ? 1 : 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />
      {[0, 0.6, 1.2].map((delay) => (
        <motion.span
          key={delay}
          className={cn(
            "absolute top-1/2 h-[3px] w-5 -translate-y-1/2 rounded-full bg-linear-to-r from-transparent",
            filled ? "to-white/90" : "to-primary/80",
          )}
          initial={{ left: "-10%" }}
          animate={{ left: "106%" }}
          transition={{ duration: 1.8, delay, repeat: Infinity, ease: "linear" }}
        />
      ))}
    </div>
  );
}

/** Counts up to the value on arrival and pops briefly whenever it changes. */
function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (reduce) return;
    const controls = animate(from.current, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, reduce]);
  return (
    <motion.span
      key={value}
      initial={reduce ? false : { scale: 1.15 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 18 }}
      className="inline-block"
    >
      {reduce ? value : shown}
    </motion.span>
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
  const openList = tenders.filter(isActive);
  const open = openList.length;
  const aiYes = openList.filter(aiPrequalified).length;
  const awaitingList = tenders.filter((t) => t.status === "Awaiting HoD");
  const awaiting = awaitingList.length;
  const routed = tenders.filter((t) => t.approval);
  const decided = routed.filter((t) => t.status !== "Awaiting HoD").length;
  const overdue = awaitingList.filter(
    (t) => t.approval && daysSince(t.approval.submittedAt) > DECISION_SLA_DAYS,
  ).length;
  const portals = demo.sources.filter((s) => s.kind !== "Upload");
  const connected = portals.filter((s) => s.status === "Connected").length;
  const needSignIn = portals.filter((s) => s.status !== "Paused" && s.accessState === "Action needed").length;
  const fresh = tenders.filter((t) => t.fromLatestScan).length;
  const ratio = (n: number, d: number) => (d ? n / d : 0);

  const steps = [
    {
      href: "/sources",
      title: "Scan Portal",
      action: "Connect & scan",
      value: connected,
      unit: "sources",
      progress: ratio(connected, portals.length),
      gauge: `${connected} of ${portals.length} portals connected`,
      badge: needSignIn ? { text: `${needSignIn} sign-in`, tone: "amber" as const } : null,
    },
    {
      href: "/pipeline",
      title: "Prospects",
      action: "Review & send for approval",
      value: open,
      unit: "open",
      progress: ratio(aiYes, open),
      gauge: `${aiYes} of ${open} open prospects recommended by AI`,
      badge: fresh ? { text: `+${fresh} new`, tone: "teal" as const } : null,
    },
    {
      href: "/approvals",
      title: "Approval Center",
      action: "HoD approves → D365",
      value: awaiting,
      unit: "awaiting",
      progress: ratio(decided, routed.length),
      gauge: `${decided} of ${routed.length} routed prospects decided`,
      badge: overdue ? { text: `${overdue} overdue`, tone: "coral" as const } : null,
    },
  ];

  return (
    <div className="dot-grid shrink-0 border-b bg-zinc-50/60 pt-4 pb-2 sm:pt-5 sm:pb-3">
      <ol className="mx-auto flex max-w-4xl items-start px-1 pt-2 pb-1 sm:px-2">
        {steps.map((s, i) => {
          const on = pathname.startsWith(s.href);
          const current = steps.findIndex((x) => pathname.startsWith(x.href));
          return (
            <li key={s.href} className="contents">
              <Link
                href={s.href}
                aria-current={on ? "page" : undefined}
                title={s.gauge}
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
                  {on && <Breathe />}
                  <ProgressRing progress={s.progress} selected={on} />
                  {s.badge && <StepBadge {...s.badge} />}
                  <span className="flex flex-col items-center leading-none">
                    <span
                      className={cn(
                        "tabular text-xl font-extrabold tracking-tight sm:text-3xl md:text-[2.25rem]",
                        // Open prospects and awaiting approvals are the counts to act on, so they stand out in dark purple.
                        !on && i > 0 && "text-primary",
                      )}
                    >
                      <CountUp value={s.value} />
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
              {i < steps.length - 1 && <FlowLine filled={i < current} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * A dashed track with a progress arc on top, so each circle doubles as a gauge.
 * The dashes are drawn in SVG (CSS dashed borders bunch up on circles).
 */
function ProgressRing({ progress, selected }: { progress: number; selected: boolean }) {
  const id = useId();
  const reduce = useReducedMotion();
  return (
    <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full -rotate-90">
      <defs>
        <linearGradient id={`${id}-arc`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--magenta)" />
        </linearGradient>
      </defs>
      {/* pathLength 120 with a 1.4 + 2.6 pattern gives exactly 30 dashes, so the seam is invisible. */}
      <circle
        cx="50"
        cy="50"
        r="48"
        fill="none"
        strokeWidth="1.6"
        strokeLinecap="round"
        pathLength={120}
        strokeDasharray="1.4 2.6"
        className={cn("transition-colors duration-300", selected ? "stroke-white/25" : "stroke-zinc-300 group-hover:stroke-primary/40")}
      />
      <motion.circle
        cx="50"
        cy="50"
        r="48"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        stroke={selected ? "rgb(255 255 255 / 0.85)" : `url(#${id}-arc)`}
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: Math.max(progress, 0.001) }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      />
    </svg>
  );
}

/** A soft halo that slowly breathes around the selected step. */
function Breathe() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-full bg-primary/30"
      initial={{ scale: 1, opacity: 0.5 }}
      animate={{ scale: 1.22, opacity: 0 }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
    />
  );
}

const BADGE_TONE = {
  amber: "bg-amber-100 text-amber-800 ring-amber-200",
  teal: "bg-sky-100 text-sky-700 ring-sky-200",
  coral: "bg-[#FBEDEA] text-[#A9473D] ring-[#F1D1CB] dark:bg-[#3A2220] dark:text-[#F0A79E] dark:ring-[#58302C]",
};

/** Small status pill on the circle's shoulder: sign-ins needed, new from the last scan, overdue decisions. */
function StepBadge({ text, tone }: { text: string; tone: keyof typeof BADGE_TONE }) {
  return (
    <motion.span
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 22, delay: 0.5 }}
      className={cn(
        "absolute -top-1 -right-3 z-10 hidden rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap shadow-sm ring-1 ring-inset sm:block",
        BADGE_TONE[tone],
      )}
    >
      {tone === "coral" && (
        <motion.span
          aria-hidden
          className="mr-1 inline-block size-1.5 rounded-full bg-current align-middle"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
      )}
      {text}
    </motion.span>
  );
}
