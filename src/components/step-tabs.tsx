"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { CheckCircle2, ListOrdered, Radar } from "lucide-react";
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
 * Scan Portal → Opportunities → Approval Center. Each circle shows its key number, opens its screen below,
 * and shows an orange mark when work is waiting.
 */
export function StepTabs() {
  // First-time setup belongs to step 1, so Scan Portal shows as selected there.
  const path = usePathname();
  const pathname = path.startsWith("/onboarding") ? "/sources" : path;
  const demo = useDemo();
  if (!demo) return null;

  const { tenders } = demo;
  const open = tenders.filter(isActive).length;
  const newFromScan = tenders.filter((t) => t.fromLatestScan).length;
  const awaiting = tenders.filter((t) => t.status === "Awaiting HoD").length;
  const portals = demo.sources.filter((s) => s.kind !== "Upload");
  const connected = portals.filter((s) => s.status === "Connected").length;
  const needsSignIn = portals.filter((s) => s.accessState === "Action needed" && s.status !== "Paused").length;

  const steps = [
    {
      href: "/sources",
      title: "Scan Portal",
      action: "Connect & scan",
      icon: Radar,
      value: connected,
      unit: "sources",
      alert: needsSignIn ? `${needsSignIn} need sign-in` : undefined,
    },
    {
      href: "/pipeline",
      title: "Opportunities",
      action: "Review & send for approval",
      icon: ListOrdered,
      value: open,
      unit: "open",
      alert: newFromScan ? `${newFromScan} new from latest scan` : undefined,
    },
    {
      href: "/approvals",
      title: "Approval Center",
      action: "HoD approves → D365",
      icon: CheckCircle2,
      value: awaiting,
      unit: "awaiting",
      alert: awaiting ? "Waiting for HoD decision" : undefined,
    },
  ];

  return (
    <div className="mb-6">
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
                      : "border-2 border-dashed border-zinc-300 bg-card text-foreground shadow-soft group-hover:-translate-y-0.5 group-hover:border-primary/50",
                  )}
                >
                  <span className="flex flex-col items-center leading-none">
                    <s.icon className={cn("mb-1.5 size-5", on ? "text-primary-foreground/80" : "text-muted-foreground")} />
                    <span className="tabular text-4xl font-semibold tracking-tight">{s.value}</span>
                    <span className={cn("mt-1 text-[10px] font-medium uppercase", on ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {s.unit}
                    </span>
                  </span>
                  {s.alert && (
                    <span
                      title={s.alert}
                      className="absolute top-0.5 right-0.5 grid size-6 place-items-center rounded-full bg-amber-500 text-[11px] font-bold text-white ring-[3px] ring-card"
                    >
                      !
                    </span>
                  )}
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
