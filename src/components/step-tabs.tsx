"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import { useDemo } from "@/lib/store";
import { aiPrequalified, inD365 } from "@/lib/scoring";
import { daysSince } from "@/lib/format";
import { cn } from "@/lib/utils";
import { boldD365 } from "@/components/shared";

export const STEP_ROUTES = ["/inbox", "/lead", "/pipeline", "/approvals"];

/** Days VP Commercial has to decide before a prospect counts as overdue. */
const DECISION_SLA_DAYS = 3;

/**
 * The line between two circles. Steps already passed fill with the purple-to-magenta gradient;
 * small comets glide along it so the journey reads left to right.
 */
function FlowLine({ filled }: { filled: boolean }) {
  return (
    <div aria-hidden className="relative mt-[27px] h-[3px] min-w-4 flex-1 overflow-hidden rounded-full bg-zinc-300/60 sm:mt-[31px] md:mt-[35px]">
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
export function CountUp({ value }: { value: number }) {
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
 * Tender discovery → D365 lead → Lead pipeline → Approvals. Each circle shows its key number and opens its screen below.
 */
export function StepTabs() {
  const pathname = usePathname();
  const demo = useDemo();
  if (!demo) return null;

  const { tenders } = demo;
  const alerts = tenders.filter((t) => t.status === "Draft").length;
  // Leads exist in D365 only once the Bid Analyst creates them from a draft.
  const leads = tenders.filter(inD365);
  const found = tenders.filter((t) => t.status !== "Not a tender");
  const aiYes = leads.filter(aiPrequalified).length;
  const awaitingList = tenders.filter((t) => t.status === "Awaiting HoD" || t.status === "BD Head review" || t.status === "Bid Head approval");
  const awaiting = awaitingList.length;
  const decided = leads.filter((t) => t.status === "Opportunity created" || t.status === "Rejected").length;
  const opportunities = tenders.filter((t) => t.status === "Opportunity created").length;
  const overdue = awaitingList.filter(
    (t) => t.approval && daysSince(t.approval.submittedAt) > DECISION_SLA_DAYS,
  ).length;
  const ratio = (n: number, d: number) => (d ? n / d : 0);

  const steps = [
    {
      href: "/inbox",
      title: "Tender discovery",
      action: "AI reads mailboxes · prepares drafts",
      short: "Finds tenders · drafts leads",
      value: alerts,
      unit: "drafts",
      progress: ratio(leads.length, found.length),
      gauge: `${alerts} lead drafts prepared from the connected mailboxes`,
      badge: null,
      who: "AI agent",
    },
    {
      href: "/lead",
      title: "D365 lead",
      action: "Review · create in D365",
      short: "Review draft · create in D365",
      value: alerts,
      unit: "to review",
      progress: ratio(leads.length, found.length),
      gauge: `${alerts} drafts to review and push to D365`,
      badge: null,
      who: "Bid Analyst",
      verb: "creates",
    },
    {
      href: "/pipeline",
      title: "Lead pipeline",
      action: "AI pre-qualification",
      short: "AI pre-qualification",
      value: leads.length,
      unit: "leads",
      progress: ratio(aiYes, leads.length),
      gauge: `${aiYes} of ${leads.length} D365 leads recommended by AI`,
      badge: null,
      who: "AI agent",
    },
    {
      href: "/approvals",
      title: "Approvals",
      action: "HoD → BD Head → Bid Head",
      short: "HoD → BD Head → Bid Head",
      value: awaiting,
      unit: "pending",
      progress: ratio(decided, leads.length),
      gauge: `${decided} of ${leads.length} leads decided · ${opportunities} opportunities`,
      badge: overdue ? { text: `${overdue} overdue`, tone: "coral" as const } : null,
      who: "HoD · BD · Bid Head",
      verb: "decide",
    },
  ];
  const current = steps.findIndex((x) => pathname.startsWith(x.href));

  return (
    // One root, so first-time setup can hide it.
    <div className="dot-grid shrink-0 border-b bg-zinc-50/60">
      <div className="py-2.5">
      <ol className="mx-auto flex max-w-4xl items-start px-1 pt-1 sm:px-2">
        {steps.map((s, i) => {
          const on = pathname.startsWith(s.href);
          return (
            <li key={s.href} className="contents">
              <Link
                href={s.href}
                aria-current={on ? "page" : undefined}
                title={s.gauge}
                className="group flex w-20 shrink-0 flex-col items-center text-center sm:w-32 md:w-44"
              >
                <span
                  className={cn(
                    "relative grid size-14 place-items-center rounded-full transition-all duration-300 sm:size-16 md:size-[72px]",
                    on
                      ? "bg-primary text-primary-foreground shadow-soft-lg ring-4 ring-primary/10 md:ring-4"
                      : "bg-card text-foreground shadow-soft group-hover:-translate-y-0.5",
                  )}
                >
                  {on && <Breathe />}
                  <ProgressRing progress={s.progress} selected={on} />
                  {s.badge && <StepBadge {...s.badge} />}
                  <span className="flex flex-col items-center leading-none">
                    <span
                      className={cn(
                        "tabular text-lg font-extrabold tracking-tight sm:text-xl md:text-2xl",
                        // Open prospects and awaiting approvals are the counts to act on, so they stand out in dark purple.
                        !on && i > 0 && "text-primary",
                      )}
                    >
                      <CountUp value={s.value} />
                    </span>
                    <span className={cn("mt-0.5 text-[7px] font-medium uppercase sm:text-[8px]", on ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {s.unit}
                    </span>
                  </span>
                </span>
                <span className={cn("mt-1.5 text-xs font-bold sm:text-sm", on ? "text-primary" : "text-foreground")}>{s.title}</span>
                <span className="hidden text-[11px] whitespace-nowrap text-muted-foreground md:block">{boldD365(s.short)}</span>
                {on && (
                  <motion.span
                    layoutId="step-tab"
                    className="mt-1.5 h-[3px] w-8 rounded-full bg-magenta"
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
