"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, CircleDashed, Fingerprint, Loader2, Mail, PauseCircle, Radar, Repeat2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { alreadyLeadsFromEmail, clearPendingScan, completeScan, isScannable, peekPendingScan, useDemo } from "@/lib/store";
import { PEOPLE } from "@/lib/mock-data";
import type { LastScan, Source, Tender } from "@/lib/types";
import { aiPrequalified, fitScore } from "@/lib/scoring";
import { formatDateTime, formatTime, isToday } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PrequalBadge } from "@/components/shared";

interface Step {
  key: string;
  label: string;
  description: string;
  duration: number;
  logs: string[];
}

/**
 * The run follows the to-be process: tenders come in by email alert (main path) or portal scan, are matched against
 * existing leads, become D365 leads, are summarised with their dates, fees and NDAs logged as actions, then scored.
 */
function buildSteps(ready: Source[], blocked: Source[], alreadyLeads: Tender[]): Step[] {
  return [
    {
      key: "connect",
      label: "Reading alerts & portals",
      description: "Tender alert emails first, then the daily scan of each portal",
      duration: 1600,
      logs: [
        ...ready.map((s) =>
          s.kind === "Email"
            ? `✉ ${s.name}: reading tender alerts (email with link)`
            : s.access === "CAPTCHA"
              ? `✓ ${s.name}: CAPTCHA on portal, read via email alerts`
              : `✓ ${s.name}: daily scan, simulated connection ready`,
        ),
        ...blocked.map((s) => `⏸ ${s.name}: ${s.access} sign-in needed, skipped. Reminder sent to ${PEOPLE.analyst.name}`),
      ],
    },
    {
      key: "discover",
      label: "Discovering new tenders",
      description: "Alerts received and notices published since the last run",
      duration: 1400,
      logs: ["Found 7 tenders: 4 from email alerts, 3 from portal scans", "Filtered 0 notices outside FM categories"],
    },
    {
      key: "dedupe",
      label: "Matching existing leads",
      description: "A tender seen by email and on a portal becomes one lead",
      duration: 1400,
      logs: [
        "Matched on buyer reference and title similarity",
        ...alreadyLeads.map((t) => `↺ ${t.id}: also on portal; already lead ${t.lead.leadId} from email alert, no second lead`),
      ],
    },
    {
      key: "lead",
      label: "Creating D365 leads",
      description: "Every new tender becomes a lead, documents and links attached",
      duration: 1400,
      logs: ["Created a D365 lead for each new tender (simulated)", "Attached tender documents and portal links"],
    },
    {
      key: "extract",
      label: "Summarising & logging actions",
      description: "Scope, deadlines, site visits, fees and NDAs on the lead",
      duration: 1700,
      logs: [
        "One summary per tender: scope, deadlines, site visit, fees",
        "Logged dates, tender fees and NDAs as actions on each lead",
        "Flagged items the AI could not read clearly for the Bid Analyst",
      ],
    },
    {
      key: "score",
      label: "Scoring against AGFS criteria",
      description: "Service, geography and ISO",
      duration: 1400,
      logs: ["Applied AGFS criteria v2.3 (demo)", "Generated recommendations and evidence links"],
    },
  ];
}

/**
 * The scan, played out on the Scan Portal screen: run → live steps → results, then on to Prospects.
 * Nothing is applied until a run completes, so leaving mid-run changes nothing.
 */
export function ScanPanel({
  onOpenSources,
  sourcesAction,
  stats,
}: {
  onOpenSources: () => void;
  /** The "Sources" button, shown in the card header next to Run AI Scan. */
  sourcesAction: React.ReactNode;
  /** Overall pipeline numbers, shown in the card's top bar. */
  stats?: React.ReactNode;
}) {
  const demo = useDemo()!;
  // A scan requested by sign-in or first-time setup. Read once into state so re-renders can't lose it.
  // The agent scans daily, so a first visit on a new day runs today's scan instead of showing an older one.
  const [autoStart] = useState<"discover" | "checkin" | null>(
    () => peekPendingScan() ?? (demo.lastScan && !isToday(demo.lastScan.at) ? "discover" : null),
  );
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
    const plan = buildSteps(ready, blocked, discover ? alreadyLeadsFromEmail(demo.tenders) : []);
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
          r.newTenders.length ? `${r.newTenders.length} new leads created in D365` : "Run complete: alerts and portals checked",
          { description: `${r.duplicates} duplicates matched to existing leads · simulated` },
        );
      }, t + 300),
    );
  }

  function cancel() {
    clearTimers();
    setPhase(demo.lastScan ? "done" : "idle");
  }

  const progress = phase === "done" ? 100 : steps.length ? Math.round(((step + 0.5) / steps.length) * 100) : 0;

  const runButton = (
    <Button size="lg" onClick={() => start(true)}>
      <Sparkles /> Run AI Scan
    </Button>
  );

  if (phase === "idle") {
    return (
      <section className="relative flex flex-1 flex-col items-center justify-center rounded-3xl bg-card px-4 py-8 text-center sm:px-6 sm:py-12 shadow-soft in-data-step-section:rounded-none in-data-step-section:shadow-none">
        <div className="mb-8 flex w-full flex-wrap items-center justify-between gap-3 sm:absolute sm:top-4 sm:right-4 sm:left-4 sm:mb-0 sm:w-auto">
          {stats ?? <span />}
          {sourcesAction}
        </div>
        <span className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Radar className="size-8" />
        </span>
        <h2 className="mt-5 text-xl font-bold text-primary tracking-tight">Check tender alerts & scan portals</h2>
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
        <Button size="xl" className="mt-6" onClick={() => start(true)}>
          <Sparkles /> Run AI Scan
        </Button>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-card shadow-soft in-data-step-section:rounded-none in-data-step-section:shadow-none">
      <header className="shrink-0 border-b px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Radar className="size-4" />
            </span>
            <h2 className="text-base font-bold text-primary">
              {phase === "done" && demo.lastScan ? (
                isToday(demo.lastScan.at) ? (
                  <>
                    Today&apos;s scan results{" "}
                    <span className="font-normal text-muted-foreground">· {formatTime(demo.lastScan.at)}</span>
                  </>
                ) : (
                  <>
                    Last scan results{" "}
                    <span className="font-normal text-muted-foreground">· {formatDateTime(demo.lastScan.at)}</span>
                  </>
                )
              ) : (
                "Reading alerts & scanning portals…"
              )}
            </h2>
          </div>
          {stats && <div className="sm:mr-auto sm:ml-2">{stats}</div>}
          {phase === "running" ? (
            <span className="tabular text-xs text-muted-foreground">{progress}%</span>
          ) : (
            <div className="flex items-center gap-2">
              {sourcesAction}
              {runButton}
            </div>
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

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
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
              className="h-52 overflow-y-auto rounded-xl bg-muted/50 p-3 tabular-nums text-[11px] leading-relaxed text-muted-foreground"
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

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t bg-muted/30 px-6 py-3">
        {phase === "done" ? (
          <Button variant="secondary" size="lg" className="ml-auto" nativeButton={false} render={<Link href="/pipeline" />}>
            Next: Review prospects <ArrowRight />
          </Button>
        ) : (
          <Button variant="outline" size="lg" className="ml-auto" onClick={cancel}>
            Cancel scan
          </Button>
        )}
      </footer>
    </section>
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
  const alreadyLeads = (scan.alreadyLeadIds ?? []).map((id) => demo.tenders.find((t) => t.id === id)).filter((t): t is Tender => !!t);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-xs font-bold tracking-wide text-primary uppercase">By source</h3>
        <ul className="divide-y rounded-xl bg-card ring-1 ring-border">
          {runs.map(({ source, outcome }) => (
            <li key={source.id} className="flex items-center gap-2.5 px-3 py-2.5 text-sm">
              {outcome === "scanned" && source.kind === "Email" ? (
                <Mail className="size-4 shrink-0 text-emerald-600" />
              ) : outcome === "scanned" ? (
                <Check className="size-4 shrink-0 text-emerald-600" />
              ) : (
                <PauseCircle className="size-4 shrink-0 text-amber-600" />
              )}
              <span className="min-w-0 flex-1 truncate">{source.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {outcome === "scanned"
                  ? found(source.id)
                    ? <><span className="tabular font-bold text-foreground">{found(source.id)}</span> new</>
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
        <h3 className="text-xs font-bold tracking-wide text-primary uppercase">
          {newTenders.length ? "New leads in D365" : "Prospects found"}
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
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-muted-foreground">
                      {t.buyer}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      Pre-qual <PrequalBadge yes={aiPrequalified(t)} />
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="tabular-nums font-medium text-teal-700">{t.lead.leadId}</span>
                    <span>·</span>
                    {t.intake === "Email alert" ? <Mail className="size-3" /> : <Radar className="size-3" />}
                    {t.intake === "Email alert" ? "from email alert" : "from portal scan"}
                    <span>·</span>
                    {t.actions.length} actions logged
                  </div>
                </Link>
              </motion.div>
            ))
        )}
        {alreadyLeads.length > 0 && (
          <div className="space-y-1.5 pt-3">
            <h3 className="text-xs font-bold tracking-wide text-primary uppercase">Already leads from email</h3>
            {alreadyLeads.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <Repeat2 className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <span className="shrink-0">
                  also on portal · <span className="tabular-nums font-medium text-teal-700">{t.lead.leadId}</span>, no second lead
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
