"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, CircleDashed, Fingerprint, Loader2, PauseCircle, Radar, RotateCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { clearPendingScan, completeScan, isScannable, peekPendingScan, useDemo } from "@/lib/store";
import { PEOPLE } from "@/lib/mock-data";
import type { LastScan, Source, Tender } from "@/lib/types";
import { fitScore, recommendation } from "@/lib/scoring";
import { formatDateTime, formatValue } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { RecommendationBadge, ScoreBar } from "@/components/shared";

interface Step {
  key: string;
  label: string;
  description: string;
  duration: number;
  logs: string[];
}

function buildSteps(ready: Source[], blocked: Source[]): Step[] {
  return [
    {
      key: "connect",
      label: "Connecting to sources",
      description: "Opening simulated connections to configured portals",
      duration: 1600,
      logs: [
        ...ready.map((s) =>
          s.access === "CAPTCHA"
            ? `✓ ${s.name}: CAPTCHA on portal, read via email alerts`
            : `✓ ${s.name}: simulated connection ready`,
        ),
        ...blocked.map((s) => `⏸ ${s.name}: ${s.access} sign-in needed, skipped. Reminder sent to ${PEOPLE.analyst.name}`),
      ],
    },
    {
      key: "discover",
      label: "Discovering new notices",
      description: "Listing notices published since the last scan",
      duration: 1500,
      logs: ["Found 7 notices published in the last 24 h", "Filtered 0 notices outside FM categories"],
    },
    {
      key: "extract",
      label: "Extracting RFP details",
      description: "Reading scope, value, deadline and eligibility from sample documents",
      duration: 1800,
      logs: [
        "Parsed 7 tender notices and 5 sample RFP packs",
        "Extracted value, deadline, geography and mandatory requirements",
      ],
    },
    {
      key: "dedupe",
      label: "Deduplicating",
      description: "Matching against tenders already in the pipeline",
      duration: 1200,
      logs: ["Matched on buyer reference and title similarity", "Merged cross-posted notices"],
    },
    {
      key: "score",
      label: "Scoring against AGFS criteria",
      description: "Service, geography, contract size, eligibility, strategy and capacity",
      duration: 1600,
      logs: ["Applied AGFS criteria v2.3 (demo)", "Generated recommendations and evidence links"],
    },
  ];
}

/**
 * The scan, played out on the Scan Portal screen: run → live steps → results, then on to Opportunities.
 * Nothing is applied until a run completes, so leaving mid-run changes nothing.
 */
export function ScanPanel({ onOpenSources }: { onOpenSources: () => void }) {
  const demo = useDemo()!;
  // A scan requested by sign-in or first-time setup. Read once into state so re-renders can't lose it.
  const [autoStart] = useState(peekPendingScan);
  // Open on the previous run's results when there is one.
  const [phase, setPhase] = useState<"idle" | "running" | "done">(
    autoStart ? "running" : demo.lastScan ? "done" : "idle",
  );
  const [step, setStep] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [runCount, setRunCount] = useState(0);
  const timers = useRef<number[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => clearTimers, []);
  // Arriving from "Start scanning" in first-time setup: run straight away.
  useEffect(() => {
    if (!autoStart) return;
    clearPendingScan();
    const t = window.setTimeout(() => start(autoStart === "discover"), 150);
    return () => window.clearTimeout(t);
    // Run once on arrival only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [logs]);

  const portals = demo.sources.filter((s) => s.kind !== "Upload");
  const ready = portals.filter(isScannable);
  const blocked = portals.filter((s) => s.status !== "Paused" && s.accessState === "Action needed");

  function start(discover = true) {
    clearTimers();
    const plan = buildSteps(ready, blocked);
    setSteps(plan);
    setPhase("running");
    setStep(0);
    setLogs([]);
    setRunCount((n) => n + 1);
    let t = 0;
    plan.forEach((s, i) => {
      const gap = s.duration / (s.logs.length + 1);
      timers.current.push(window.setTimeout(() => setStep(i), t));
      s.logs.forEach((line, j) => {
        timers.current.push(window.setTimeout(() => setLogs((l) => [...l, line]), t + gap * (j + 1)));
      });
      t += s.duration;
    });
    timers.current.push(
      window.setTimeout(() => {
        const r = completeScan({ discover });
        setStep(plan.length);
        setPhase("done");
        toast.success(
          r.newTenders.length ? `${r.newTenders.length} new opportunities added` : "Scan complete: portals checked",
          { description: `${r.duplicates} duplicates skipped · simulated scan` },
        );
      }, t + 300),
    );
  }

  function cancel() {
    clearTimers();
    setPhase(demo.lastScan ? "done" : "idle");
  }

  const progress = phase === "done" ? 100 : steps.length ? Math.round(((step + 0.5) / steps.length) * 100) : 0;

  if (phase === "idle") {
    return (
      <section className="flex flex-col items-center rounded-3xl bg-card px-6 py-12 text-center shadow-soft">
        <span className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Radar className="size-8" />
        </span>
        <h2 className="mt-5 text-xl font-semibold tracking-tight">Scan connected portals</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {ready.length} portals ready
          {demo.lastScanAt && <> · last scan {formatDateTime(demo.lastScanAt)}</>}
        </p>
        {blocked.length > 0 && (
          <button
            onClick={onOpenSources}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200 transition-colors hover:bg-amber-100"
          >
            <Fingerprint className="size-3.5" />
            {blocked.length} portal{blocked.length === 1 ? "" : "s"} need sign-in and will be skipped · Sign in
          </button>
        )}
        <Button
          size="lg"
          className="mt-6 h-12 gap-2 rounded-xl px-6 text-[15px] shadow-md shadow-primary/20 [&_svg:not([class*='size-'])]:size-[18px]"
          onClick={() => start(true)}
        >
          <Sparkles /> Run AI Scan
        </Button>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl bg-card shadow-soft">
      <header className="border-b px-6 pt-5 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Radar className="size-4" />
            </span>
            <h2 className="text-base font-semibold">
              {phase === "done" && demo.lastScan ? (
                <>
                  Last scan results{" "}
                  <span className="font-normal text-muted-foreground">· {formatDateTime(demo.lastScan.at)}</span>
                </>
              ) : (
                "Scanning portals…"
              )}
            </h2>
          </div>
          {phase === "running" ? (
            <span className="tabular text-xs text-muted-foreground">{progress}%</span>
          ) : (
            blocked.length > 0 && (
              <button
                onClick={onOpenSources}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
              >
                <Fingerprint className="size-3.5" /> {blocked.length} need sign-in
              </button>
            )
          )}
        </div>
        {phase === "running" && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut", duration: 0.5 }}
            />
          </div>
        )}
      </header>

      <div className="px-6 py-5">
        {phase === "running" ? (
          <div className="grid gap-6 md:grid-cols-[240px_1fr]">
            <ol className="space-y-3">
              {steps.map((s, i) => {
                const state = i < step ? "done" : i === step ? "active" : "todo";
                return (
                  <li key={s.key} className="flex items-center gap-2.5 text-sm">
                    <span
                      className={cn(
                        "grid size-5 place-items-center rounded-full",
                        state === "done" && "bg-primary text-primary-foreground",
                        state === "active" && "bg-primary/10 text-primary",
                        state === "todo" && "text-muted-foreground/50",
                      )}
                    >
                      {state === "done" ? (
                        <Check className="size-3" />
                      ) : state === "active" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <CircleDashed className="size-4" />
                      )}
                    </span>
                    <span className={cn(state === "todo" && "text-muted-foreground", state === "active" && "font-medium")}>
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div
              ref={logRef}
              className="h-52 overflow-y-auto rounded-xl bg-muted/50 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground"
            >
              <AnimatePresence initial={false}>
                {logs.map((l, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                    <span className="text-primary/70">›</span> {l}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          demo.lastScan && <ScanResults key={runCount} scan={demo.lastScan} />
        )}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t bg-muted/30 px-6 py-3">
        {phase === "done" ? (
          <>
            <Button variant="outline" onClick={() => start(true)}>
              <RotateCw /> Run again
            </Button>
            <Button size="lg" nativeButton={false} render={<Link href="/pipeline" />}>
              Next: Review opportunities <ArrowRight />
            </Button>
          </>
        ) : (
          <Button variant="outline" className="ml-auto" onClick={cancel}>
            Cancel scan
          </Button>
        )}
      </footer>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="tabular text-lg font-semibold">{value}</div>
    </div>
  );
}

function ScanResults({ scan }: { scan: LastScan }) {
  const demo = useDemo()!;
  const newTenders = scan.newIds.map((id) => demo.tenders.find((t) => t.id === id)).filter((t): t is Tender => !!t);
  const runs = scan.runs
    .map((r) => ({ ...r, source: demo.sources.find((src) => src.id === r.sourceId) }))
    .filter((r): r is typeof r & { source: Source } => !!r.source);
  const tracked = (scan.foundIds ?? []).map((id) => demo.tenders.find((t) => t.id === id)).filter((t): t is Tender => !!t);
  const found = (id: string) => newTenders.filter((t) => t.sourceId === id).length;
  const list = newTenders.length ? newTenders : tracked;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Scanned" value={scan.scanned} />
        <Stat label="New" value={newTenders.length} />
        <Stat label="Duplicates" value={scan.duplicates} />
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">By source</h3>
        <ul className="divide-y rounded-xl bg-card ring-1 ring-border">
          {runs.map(({ source, outcome }) => (
            <li key={source.id} className="flex items-center gap-2.5 px-3 py-2.5 text-sm">
              {outcome === "scanned" ? (
                <Check className="size-4 shrink-0 text-emerald-600" />
              ) : (
                <PauseCircle className="size-4 shrink-0 text-amber-600" />
              )}
              <span className="min-w-0 flex-1 truncate">{source.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {outcome === "scanned"
                  ? found(source.id)
                    ? `${found(source.id)} new`
                    : "No new"
                  : outcome === "sign-in"
                    ? "Skipped · sign-in needed"
                    : "Paused"}
              </span>
            </li>
          ))}
        </ul>
      </section>
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {newTenders.length ? "New opportunities" : "Opportunities found"}
        </h3>
        {list.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nothing new since the last scan.
          </p>
        ) : (
          [...list]
            .sort((a, b) => fitScore(b) - fitScore(a))
            .map((t, i) => (
              <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Link
                  href={`/opportunity?id=${encodeURIComponent(t.id)}&from=sources`}
                  className="group block rounded-xl bg-card p-3 ring-1 ring-border transition-all hover:shadow-soft-lg hover:ring-primary/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium group-hover:text-primary">{t.title}</span>
                    {!newTenders.length && (
                      <span className="shrink-0 rounded bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                        In pipeline
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {t.buyer} · {formatValue(t)}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <ScoreBar score={fitScore(t)} />
                      <RecommendationBadge rec={recommendation(t)} />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))
        )}
      </section>
    </div>
  );
}
