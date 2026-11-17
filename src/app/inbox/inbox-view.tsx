"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, ArrowRight, BadgeCheck, Check, Copy, FileText, Inbox, Layers, Mail, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { clearPendingScan, peekPendingScan, useDemo } from "@/lib/store";
import { buildMailbox, mailboxFor, shortMailbox, type MailItem } from "@/lib/mailbox";
import { aiPrequalified, fitScore } from "@/lib/scoring";
import { daysUntil, formatDate, formatTime, isToday } from "@/lib/format";
import type { MailboxConnection, Tender, TenderAction } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PrequalBadge, boldD365 } from "@/components/shared";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { EmailView } from "@/components/email-view";
import { MailboxOnboarding } from "@/components/mailbox-connect";
import { CountUp } from "@/components/step-tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LeadForm } from "@/components/lead-form";
import outlookIcon from "@/assets/outlook.svg";

/** The agent's run over the mailbox. "sort" moves the emails into lanes one at a time. */
const STEPS = [
  {
    key: "read",
    label: "Connect & scan mailboxes",
    hint: "Read new emails in the connected Outlook mailboxes",
    ms: 1100,
  },
  {
    key: "sort",
    label: "Spot tenders",
    hint: "Separate tender invitations from everyday mail",
    ms: 0,
  },
  {
    key: "files",
    label: "Read attachments",
    hint: "Open the RFPs and bills of quantities sent with the emails",
    ms: 1300,
  },
  {
    key: "extract",
    label: "Analyze tender details",
    hint: "Extract client, scope, location, dates, fees, NDAs and site visits",
    ms: 1600,
  },
  {
    key: "match",
    label: "Match existing leads",
    hint: "Check the tender no. so a tender never becomes two leads",
    ms: 1000,
  },
  {
    key: "lead",
    label: "Prepare lead drafts",
    hint: "One draft per tender, for you to check and push to D365",
    ms: 1300,
  },
  {
    key: "prequal",
    label: "Prequalify",
    hint: "Score against AGFS service lines and qualification rules",
    ms: 1100,
  },
] as const;
type StepKey = (typeof STEPS)[number]["key"];
const SORT_MS = 420;
const at = (k: StepKey) => STEPS.findIndex((s) => s.key === k);

const isTenderMail = (m: MailItem) => m.kind === "tender" || m.kind === "possible";

/**
 * Screen 1 · the agent reads the shared sales mailbox. Emails fly from the incoming stack into lanes: tenders (which
 * become D365 leads), tenders that are already leads, and everyday mail it leaves alone. On each tender it pulls out the
 * details, stamps the new lead number and the AI pre-qualification. Runs on sign-in; "Run again" replays it.
 */
export function InboxView() {
  const demo = useDemo()!;
  const tenderOf = (m: MailItem) => (m.tenderId ? demo.tenders.find((t) => t.id === m.tenderId) : undefined);
  // This run's emails: everything new since the last run. Taken once, so drafts pushed during the visit stay listed.
  const [runIds] = useState(() =>
    buildMailbox(demo.tenders, demo.sources, demo.mailboxes, 0)
      .filter((m) => m.kind === "other" || m.kind === "duplicate" || tenderOf(m)?.status === "Draft")
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((m) => m.id),
  );
  const all = buildMailbox(demo.tenders, demo.sources, demo.mailboxes, 50);
  const mail = runIds.map((id) => all.find((m) => m.id === id)).filter((m): m is MailItem => !!m);
  const tenderMail = mail.filter(isTenderMail);
  const dupMail = mail.filter((m) => m.kind === "duplicate");

  const connected = demo.mailboxes.length > 0;
  const addresses = demo.mailboxes.map((m) => m.address);
  // Sign-in starts a run, but only once a mailbox is connected.
  const [autoStart] = useState(() => peekPendingScan() !== null && connected);
  // First visit with nothing connected: set up one or more mailboxes before the first run.
  const [setup, setSetup] = useState(() => !connected);
  const [phase, setPhase] = useState<"running" | "done">(autoStart ? "running" : "done");
  const [step, setStep] = useState(0);
  const [sorted, setSorted] = useState(0);
  const [ticker, setTicker] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  // Picking a draft from inside the email (its "Review & create lead") closes the email to show the draft.
  const selectedId = useSearchParams().get("id");
  const [lastId, setLastId] = useState(selectedId);
  if (lastId !== selectedId) {
    setLastId(selectedId);
    setOpenId(null);
  }
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  /** Plays the run. Takes the mailboxes to read, for the run that starts right after connecting the first one. */
  function start(boxes: MailboxConnection[] = demo.mailboxes) {
    clearTimers();
    setPhase("running");
    setStep(0);
    setSorted(0);
    const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    const withFiles = tenderMail.filter((m) => m.attachments.length);
    const lines: Record<StepKey, string> = {
      read: `Reading ${boxes
        .map((b) => {
          const n = mail.filter((m) => mailboxFor(m.kind, m.channel, boxes) === b.address).length;
          return `${shortMailbox(b.address)} (${b.folders.join(", ")}) · ${n} new`;
        })
        .join("  |  ")}`,
      sort: "",
      files: withFiles.length
        ? `Reading ${withFiles.flatMap((m) => m.attachments.map((a) => a.name)).join(", ")}`
        : "No attachments to read",
      extract: "Pulling out client, tender no., scope, dates, fees, NDAs and site visits",
      match: dupMail.length ? `Matched ${dupMail.length} email to an existing lead by tender no. · no second lead` : "No duplicates",
      lead: `Preparing ${tenderMail.length} lead drafts · nothing goes to D365 until you create it`,
      prequal: "Scoring each lead against the AGFS criteria",
    };
    let t = 0;
    STEPS.forEach((s, i) => {
      later(t, () => {
        setStep(i);
        if (s.key !== "sort") setTicker(lines[s.key]);
      });
      if (s.key === "sort") {
        mail.forEach((m, j) =>
          later(t + SORT_MS * (j + 0.6), () => {
            setSorted(j + 1);
            setTicker(
              m.kind === "other"
                ? `Not a tender · ${m.subject}`
                : m.kind === "duplicate"
                  ? `Already a lead · ${m.subject}`
                  : m.kind === "possible"
                    ? `Possible tender (flag for a check) · ${m.subject}`
                    : `Tender · ${m.subject}`,
            );
          }),
        );
        t += SORT_MS * (mail.length + 1);
      } else t += s.ms;
    });
    later(t + 300, () => {
      setStep(STEPS.length);
      setPhase("done");
      toast.success(boldD365(`${tenderMail.length} tenders found · ${tenderMail.length} lead drafts ready for you`), {
        description: `${mail.length} emails read · ${dupMail.length} already a lead · simulated`,
      });
    });
  }

  // While the AI runs, the dotted backgrounds animate (see .dot-grid in globals.css).
  useEffect(() => {
    const root = document.documentElement;
    if (phase === "running") root.dataset.scanning = "";
    else delete root.dataset.scanning;
    return () => {
      delete root.dataset.scanning;
    };
  }, [phase]);

  // Arriving from sign-in: run straight away.
  useEffect(() => {
    clearPendingScan();
    if (!autoStart) return;
    const t = window.setTimeout(() => start(), 150);
    return () => window.clearTimeout(t);
    // Run once on arrival only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalMs = STEPS.reduce((n, s) => n + (s.key === "sort" ? SORT_MS * (mail.length + 1) : s.ms), 0);
  const elapsedMs = STEPS.slice(0, step).reduce((n, s) => n + (s.key === "sort" ? SORT_MS * (mail.length + 1) : s.ms), 0);
  const progress =
    phase === "done" ? 100 : Math.min(99, Math.round(((elapsedMs + (step === at("sort") ? sorted * SORT_MS : 0)) / totalMs) * 100));
  const open = mail.find((m) => m.id === openId);
  // Nothing to read until a mailbox is connected.
  if (setup || !connected) {
    return (
      <section
        data-onboarding
        className="flex flex-1 flex-col items-center justify-center rounded-3xl bg-card px-4 py-10 shadow-soft sm:px-6 in-data-step-section:rounded-none in-data-step-section:shadow-none"
      >
        <MailboxOnboarding
          onStart={() => {
            setSetup(false);
            start();
          }}
        />
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-card shadow-soft in-data-step-section:rounded-none in-data-step-section:shadow-none">
      <header className="shrink-0 border-b px-4 py-3.5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Mail className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-primary">Tenders found in your emails</h2>
              <RunSummary mail={mail} tenderOf={tenderOf} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="lg" nativeButton={false} render={<Link href="/settings" />}>
              <Mail /> Emails · {addresses.length} connected
            </Button>
            <Button size="lg" onClick={() => start()}>
              <Sparkles /> Run again
            </Button>
          </div>
        </div>
      </header>

      <Results mail={mail} addresses={addresses} tenderOf={tenderOf} onOpen={setOpenId} onRun={() => start()} />

      {/* The run fills the screen over a frosted view of the inbox; Skip goes straight to the drafts. */}
      <AnimatePresence>
        {phase === "running" && (
          <ScanScreen
            progress={progress}
            step={step}
            sorted={sorted}
            mail={mail}
            ticker={ticker}
            addresses={addresses}
            onSkip={() => {
              clearTimers();
              setPhase("done");
            }}
          />
        )}
      </AnimatePresence>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent
          // Return focus to the row only when closed from the keyboard, so a mouse close leaves no focus ring behind.
          finalFocus={(closeType) => closeType === "keyboard"}
          className="w-full overflow-hidden p-0 sm:max-w-xl data-[side=right]:sm:max-w-xl"
        >
          <SheetTitle className="sr-only">{open?.subject ?? "Email"}</SheetTitle>
          {open && <EmailView m={open} t={tenderOf(open)} className="h-full" />}
        </SheetContent>
      </Sheet>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The scan, as a centred layer over the inbox

/** The run in four stages for the scan card; each AI step belongs to one. */
const STAGES = [
  { label: "Scan emails", icon: Mail, steps: ["read"] },
  { label: "Find tenders", icon: Search, steps: ["sort"] },
  { label: "Create drafts", icon: FileText, steps: ["files", "extract", "match", "lead"] },
  { label: "Pre-qualify", icon: BadgeCheck, steps: ["prequal"] },
] as const;

/**
 * The AI's run as its own screen in place of the drafts: what it is doing, how far it is, and what it has found so far.
 * "Skip" jumps straight to the drafts.
 */
function ScanScreen({
  progress,
  step,
  sorted,
  mail,
  ticker,
  addresses,
  onSkip,
}: {
  progress: number;
  step: number;
  sorted: number;
  mail: MailItem[];
  ticker: string;
  addresses: string[];
  onSkip: () => void;
}) {
  const current = STEPS[Math.min(step, STEPS.length - 1)];
  const stage = STAGES.findIndex((g) => (g.steps as readonly string[]).includes(current.key));
  const seen = step > at("sort") ? mail : mail.slice(0, sorted);
  const drafts = seen.filter(isTenderMail).length;
  const counts = [
    { n: step >= at("sort") ? seen.length : 0, label: "Emails read", icon: Mail },
    { n: drafts, label: "Drafts prepared", icon: FileText },
    { n: seen.filter((m) => m.kind === "duplicate").length, label: "Already a lead", icon: Layers },
  ];
  return (
    <motion.div
      key="scan"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.45 } }}
      className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-white/60 px-6 py-10 backdrop-blur-xl dark:bg-zinc-950/60"
    >
      {/* A soft wash of colour behind everything */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(40_168_234/0.14),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[60%] left-[58%] size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--magenta)_10%,transparent),transparent)]"
      />

      <motion.div
        initial={{ y: 14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
        className="relative flex w-full max-w-md flex-col items-center rounded-[2rem] border border-white/80 bg-white/35 px-8 py-9 text-center shadow-[0_8px_40px_-12px_rgb(15_108_189/0.18)] ring-1 ring-black/[0.04] dark:border-white/10 dark:bg-white/[0.03] dark:ring-0"
      >
        <ScanHero />

        <h2 className="mt-3 text-xl font-bold tracking-tight text-primary">AI drafting from Outlook</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Finding tenders in {addresses.map(shortMailbox).join(" and ")}</p>

        {/* Progress: the step, a hairline bar, and what it is reading */}
        <div className="mt-8 w-full">
          <div className="flex items-baseline justify-center gap-2 text-[13px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={current.key}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.2 }}
                className="font-medium text-foreground"
              >
                {current.label}
              </motion.span>
            </AnimatePresence>
            <span className="tabular text-muted-foreground">· {progress}%</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/[0.07]">
            <motion.div
              className="h-full rounded-full bg-linear-to-r from-[#0f6cbd] via-primary to-magenta"
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut", duration: 0.4 }}
            />
          </div>
          <p className="mt-2 h-4 truncate text-[11px] text-muted-foreground">{ticker}</p>
        </div>

        {/* Four stages as quiet dots */}
        <ol className="mt-6 flex w-full items-center justify-between">
          {STAGES.map((g, i) => {
            const done = i < stage;
            const on = i === stage;
            return (
              <li key={g.label} className="flex flex-1 flex-col items-center gap-2">
                <span className="relative grid size-2.5 place-items-center">
                  {on && (
                    <motion.span
                      aria-hidden
                      className="absolute inset-0 rounded-full bg-primary/40"
                      animate={{ scale: [1, 2.6], opacity: [0.6, 0] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                    />
                  )}
                  <span
                    className={cn(
                      "size-2.5 rounded-full transition-colors",
                      done ? "bg-primary" : on ? "bg-linear-to-br from-primary to-magenta" : "bg-foreground/15",
                    )}
                  />
                </span>
                <span
                  className={cn(
                    "text-[11px]",
                    on ? "font-semibold text-foreground" : done ? "text-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {g.label}
                </span>
              </li>
            );
          })}
        </ol>

        {/* What it has found so far */}
        <dl className="mt-8 grid w-full grid-cols-3">
          {counts.map(({ n, label }, i) => (
            <div key={label} className={cn("flex flex-col items-center", i > 0 && "border-l border-foreground/10")}>
              <dd className="tabular text-2xl font-semibold tracking-tight text-foreground">
                <CountUp value={n} />
              </dd>
              <dt className="mt-0.5 text-[11px] text-muted-foreground">{label}</dt>
            </div>
          ))}
        </dl>

        <button
          onClick={onSkip}
          className="group mt-9 flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium text-primary transition-colors hover:bg-primary/[0.07]"
        >
          Skip to drafts <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </motion.div>
    </motion.div>
  );
}

/**
 * The picture at the top: the Outlook logo in the middle with a glowing ring round it like Saturn's
 * (behind it at the top, in front at the bottom) and a light running round.
 */
function ScanHero() {
  const reduce = useReducedMotion();
  const float = (d: number) =>
    reduce ? {} : { animate: { y: [0, -4, 0] }, transition: { duration: 3.2, delay: d, repeat: Infinity, ease: "easeInOut" as const } };
  return (
    <div className="relative mx-auto h-32 w-72">
      {/* Soft glow under the stack */}
      <div
        aria-hidden
        className="absolute top-1/2 left-1/2 size-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#28a8ea]/25 blur-2xl"
      />

      <OrbitRing half="back" />

      {/* Outlook, like a planet: the ring passes behind it at the top and in front at the bottom */}
      <motion.div {...float(0)} className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
        <OutlookLogo className="size-20 drop-shadow-[0_10px_18px_rgb(15_108_189/0.4)]" />
      </motion.div>

      <OrbitRing half="front" />

      {/* Twinkles */}
      {[
        { c: "top-1 right-8 size-3.5", d: 0, star: true },
        { c: "top-[70%] left-[30%] size-1.5", d: 0.5 },
        { c: "top-3 left-[36%] size-1", d: 1.1 },
        { c: "top-[40%] right-2 size-1.5", d: 0.8 },
      ].map((x) => (
        <motion.span
          key={x.c}
          aria-hidden
          className={cn(
            "absolute z-40",
            x.c,
            x.star ? "text-white drop-shadow-[0_0_6px_rgb(40_168_234)]" : "rounded-full bg-white shadow-[0_0_6px_2px_rgb(125_200_245/0.8)]",
          )}
          animate={reduce ? undefined : { scale: [0.6, 1.2, 0.6], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, delay: x.d, repeat: Infinity }}
        >
          {x.star && <Sparkles className="size-full" />}
        </motion.span>
      ))}
    </div>
  );
}

/**
 * Half of the glowing ring round the envelope stack: "back" is drawn under the stack (the far side), "front" over it,
 * so the ring seems to pass behind and in front. A light runs round it.
 */
function OrbitRing({ half }: { half: "back" | "front" }) {
  const reduce = useReducedMotion();
  const id = useId();
  const front = half === "front";
  const ellipse = { cx: 120, cy: 34, rx: 104, ry: 20 };
  return (
    <svg
      aria-hidden
      viewBox="0 0 240 68"
      className={cn(
        "pointer-events-none absolute top-1/2 left-1/2 h-[68px] w-[240px] -translate-x-1/2 -translate-y-1/2 -rotate-[14deg] overflow-visible",
        front ? "z-30" : "z-0",
      )}
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0" x2="1">
          <stop offset="0" stopColor="#0f6cbd" stopOpacity="0.15" />
          <stop offset="0.5" stopColor="#28a8ea" stopOpacity="1" />
          <stop offset="1" stopColor="#0f6cbd" stopOpacity="0.15" />
        </linearGradient>
        <clipPath id={`${id}-c`}>
          <rect x="-20" y={front ? ellipse.cy : -20} width="280" height={front ? 60 : ellipse.cy + 20} />
        </clipPath>
        <filter id={`${id}-b`} x="-30%" y="-80%" width="160%" height="260%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <g clipPath={`url(#${id}-c)`}>
        {/* Glow */}
        <ellipse {...ellipse} fill="none" stroke={`url(#${id}-g)`} strokeWidth="8" opacity="0.8" filter={`url(#${id}-b)`} />
        {/* Crisp line */}
        <ellipse {...ellipse} fill="none" stroke={`url(#${id}-g)`} strokeWidth={front ? 2 : 1.4} />
        {/* Light running round */}
        {!reduce && (
          <>
            <motion.ellipse
              {...ellipse}
              fill="none"
              stroke="#fff"
              strokeWidth="6"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="6 94"
              filter={`url(#${id}-b)`}
              animate={{ strokeDashoffset: [0, -100] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            <motion.ellipse
              {...ellipse}
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="4 96"
              animate={{ strokeDashoffset: [0, -100] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
          </>
        )}
      </g>
    </svg>
  );
}

/** The Microsoft Outlook app icon (2025). */
function OutlookLogo({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- static export; the SVG needs no optimisation
  return <img src={outlookIcon.src} alt="Outlook" draggable={false} className={cn("object-contain", className)} />;
}

function EmptyLane({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed px-3 py-4 text-center text-[11px] text-muted-foreground">{text}</p>;
}

// ---------------------------------------------------------------------------
// Results

function Results({
  mail: allMail,
  addresses,
  tenderOf,
  onOpen,
  onRun,
}: {
  mail: MailItem[];
  addresses: string[];
  tenderOf: (m: MailItem) => Tender | undefined;
  onOpen: (id: string) => void;
  onRun: () => void;
}) {
  const demo = useDemo()!;
  const router = useRouter();
  const params = useSearchParams();
  // With several mailboxes connected, show them all or one at a time.
  const [box, setBox] = useState<string | null>(null);
  const shown = box && addresses.includes(box) ? box : null;
  const mail = shown ? allMail.filter((m) => m.mailbox === shown) : allMail;
  const dupMail = mail.filter((m) => m.kind === "duplicate");
  const when = (iso: string) => (isToday(iso) ? formatTime(iso) : formatDate(iso));
  // Best fit first. Order is taken from the run, so a draft keeps its place once created.
  const leads = mail
    .filter(isTenderMail)
    .map((m) => ({ m, t: tenderOf(m)! }))
    .sort((a, b) => fitScore(b.t) - fitScore(a.t));

  // The selected draft is in the URL (?id=), so other screens can link straight to one. Default: the first still to review.
  const wanted = params.get("id");
  const selected =
    (wanted ? demo.tenders.find((t) => t.id === wanted) : undefined) ?? leads.find((x) => x.t.status === "Draft")?.t ?? leads[0]?.t;
  const select = (id: string) => router.replace(`/inbox?id=${encodeURIComponent(id)}`, { scroll: false });
  const toReview = leads.filter((x) => x.t.status === "Draft").length;
  const waiting = demo.tenders.filter((t) => t.status === "Draft" && t.id !== selected?.id).length;
  // Every draft from the run is now in D365 (or dismissed): both sides show the all-done state.
  const allDone = !demo.tenders.some((t) => t.status === "Draft");
  const createdCount = leads.filter((x) => x.t.status !== "Draft" && x.t.status !== "Not a tender").length;
  const dismissedCount = leads.filter((x) => x.t.status === "Not a tender").length;

  if (allDone)
    return (
      <AllDone
        created={createdCount}
        dismissed={dismissedCount}
        linked={allMail.filter((m) => m.kind === "duplicate").length}
        onRun={onRun}
      />
    );
  const mailOf = (id: string) => allMail.find((m) => m.tenderId === id && isTenderMail(m));

  /** After creating or dismissing: the next draft below in the list, wrapping round; stays put when none are left. */
  function next() {
    const i = leads.findIndex((x) => x.t.id === selected?.id);
    const after = [...leads.slice(i + 1), ...leads.slice(0, Math.max(i, 0))].find((x) => x.t.status === "Draft");
    if (after) select(after.t.id);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Left: the drafts the AI prepared, one selected. */}
      <aside className="flex shrink-0 flex-col border-b lg:min-h-0 lg:w-[380px] lg:border-r lg:border-b-0 xl:w-[420px]">
        <div className="shrink-0 space-y-3 px-4 pt-4 pb-2">
          <h3 className="text-xs font-bold tracking-wide text-primary uppercase">
            Lead drafts{" "}
            <span className="text-[11px] font-semibold tracking-normal text-muted-foreground normal-case">
              ({toReview ? `${toReview} to review` : "all reviewed"})
            </span>
          </h3>
          {addresses.length > 1 && (
            <div role="tablist" aria-label="Mailbox" className="flex flex-wrap gap-1.5">
              {[null, ...addresses].map((a) => {
                const n = a ? allMail.filter((m) => m.mailbox === a).length : allMail.length;
                const active = shown === a;
                return (
                  <button
                    key={a ?? "all"}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setBox(a)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors",
                      active
                        ? "bg-primary text-primary-foreground ring-primary"
                        : "bg-card text-muted-foreground ring-border hover:text-foreground",
                    )}
                  >
                    {a ? (
                      <span className="font-mono" title={a}>
                        {shortMailbox(a)}
                      </span>
                    ) : (
                      "All"
                    )}
                    <span className={cn("tabular rounded-full px-1.5 text-[10px]", active ? "bg-white/20" : "bg-muted")}>{n}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="max-h-[50vh] min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 pt-1 pb-5 lg:max-h-none">
          {leads.length === 0 && <EmptyLane text="No new tenders in the mailbox." />}
          {leads.map(({ m, t }, i) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <DraftItem m={m} t={t} on={t.id === selected?.id} onSelect={() => select(t.id)} />
            </motion.div>
          ))}
          {dupMail.length > 0 && (
            <div className="space-y-2.5 pt-5">
              <h3 className="px-1 text-xs font-bold tracking-wide text-primary uppercase">Already a lead</h3>
              {dupMail.map((m) => (
                <MailRow
                  key={m.id}
                  m={m}
                  icon={<Copy className="size-3.5" />}
                  note={`Linked to ${tenderOf(m)?.lead.leadId}`}
                  time={when(m.at)}
                  onOpen={onOpen}
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Right: the selected draft, to check and create in D365. */}
      <div className="flex min-h-[640px] min-w-0 flex-1 flex-col lg:min-h-0">
        {selected ? (
          <LeadForm
            key={selected.id}
            tender={selected}
            waiting={waiting}
            onDone={next}
            onOpenEmail={mailOf(selected.id) ? () => onOpen(mailOf(selected.id)!.id) : undefined}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center text-sm text-muted-foreground">
            <Inbox className="size-7" />
            No drafts yet. Run the AI over your emails to prepare them.
          </div>
        )}
      </div>
    </div>
  );
}

/** Shown on both sides once every draft is in D365: the list says it is clear, the detail side says what happened and what is next. */
function AllDone({ created, dismissed, linked, onRun }: { created: number; dismissed: number; linked: number; onRun: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex min-h-0 flex-1 flex-col lg:flex-row"
    >
      <aside className="flex shrink-0 flex-col border-b lg:min-h-0 lg:w-[380px] lg:border-r lg:border-b-0 xl:w-[420px]">
        <div className="shrink-0 px-4 pt-4 pb-2">
          <h3 className="text-xs font-bold tracking-wide text-primary uppercase">
            Lead drafts <span className="text-[11px] font-semibold tracking-normal text-muted-foreground normal-case">(0 to review)</span>
          </h3>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Inbox className="size-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Inbox clear</p>
            <p className="mt-0.5 text-xs text-muted-foreground">No drafts waiting. New ones appear here when the AI finds tenders.</p>
          </div>
        </div>
      </aside>

      <div className="relative flex min-h-[480px] min-w-0 flex-1 flex-col items-center justify-center overflow-hidden px-6 py-14 text-center lg:min-h-0">
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/10 blur-3xl"
        />
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
          className="relative grid size-20 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60 dark:bg-emerald-950/50 dark:text-emerald-400 dark:ring-emerald-950/30"
        >
          <Check className="size-9" strokeWidth={2.5} />
        </motion.span>
        <h3 className="relative mt-6 text-xl font-bold text-primary">
          {created || dismissed ? <>Every draft is in {boldD365("D365")}</> : "You're all caught up"}
        </h3>
        <p className="relative mt-1.5 max-w-sm text-sm text-balance text-muted-foreground">
          {created || dismissed ? (
            <>
              {created} {created === 1 ? "lead" : "leads"} created and sent to the BD Head
              {dismissed > 0 && <> · {dismissed} dismissed as not a tender</>}
              {linked > 0 && <> · {linked} already a lead</>}.
            </>
          ) : (
            <>
              No new tenders in your emails{linked > 0 && <> · {linked} already a lead</>}. The AI prepares a draft here as soon as one
              arrives.
            </>
          )}
        </p>
        <div className="relative mt-6 flex flex-wrap justify-center gap-2">
          <Button size="lg" nativeButton={false} render={<Link href="/pipeline" />}>
            Open Lead pipeline <ArrowRight />
          </Button>
          <Button variant="outline" size="lg" onClick={onRun}>
            <Sparkles /> Run again
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/** One draft in the list, kept light: the tender and its pre-qual, then the client and the next date (or the lead number once created). */
function DraftItem({ m, t, on, onSelect }: { m: MailItem; t: Tender; on: boolean; onSelect: () => void }) {
  const created = t.status !== "Draft" && t.status !== "Not a tender";
  const dismissed = t.status === "Not a tender";
  const next = t.actions.filter((a) => a.due && daysUntil(a.due) >= 0).sort((a, b) => a.due!.localeCompare(b.due!))[0];
  const soon = next && daysUntil(next.due!) <= 7;
  return (
    <Tooltip>
      <TooltipTrigger
        render={<button onClick={onSelect} aria-current={on || undefined} />}
        className={cn(
          "relative w-full rounded-xl px-4 py-3.5 text-left ring-1 transition-all",
          on ? "bg-primary/[0.06] shadow-soft ring-primary/40" : "bg-card ring-border hover:shadow-soft hover:ring-primary/25",
          (created || dismissed) && !on && "opacity-60",
        )}
      >
        {on && <span aria-hidden className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-magenta" />}
        <span className="flex items-center gap-2">
          {m.kind === "possible" && !created && !dismissed && <AlertTriangle className="size-3.5 shrink-0 text-amber-600" />}
          <span className={cn("min-w-0 flex-1 truncate text-[13px] font-semibold", on ? "text-primary" : "text-foreground")}>
            {t.title}
          </span>
          <PrequalBadge yes={aiPrequalified(t)} className="shrink-0" />
        </span>
        <span className="mt-1.5 flex min-w-0 items-center gap-3 text-xs text-muted-foreground">
          <span className="min-w-0 flex-1 truncate">{t.buyer}</span>
          {created ? (
            <span className="flex shrink-0 items-center gap-0.5 font-medium text-emerald-700">
              <Check className="size-3" /> {t.lead.leadId}
            </span>
          ) : dismissed ? (
            <span className="shrink-0">Not a tender</span>
          ) : next ? (
            <span className={cn("shrink-0", soon && "font-medium text-amber-700")}>
              {DEADLINE_VERB[next.kind]} {new Date(next.due!).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
          ) : (
            <span className="shrink-0">No dates</span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" align="start" className="max-w-72 flex-col items-start gap-0.5 text-left">
        <span className="block font-semibold">{t.title}</span>
        <span className="block opacity-80">{t.buyer}</span>
        {next && !created && !dismissed && (
          <span className="block opacity-80">
            {next.label} · {formatDate(next.due!)}
          </span>
        )}
        {m.kind === "possible" && !created && !dismissed && <span className="block opacity-80">Possible tender: please check</span>}
      </TooltipContent>
    </Tooltip>
  );
}

/** The run in numbers, on one line under the title. */
function RunSummary({ mail, tenderOf }: { mail: MailItem[]; tenderOf: (m: MailItem) => Tender | undefined }) {
  const tenders = mail
    .filter(isTenderMail)
    .map(tenderOf)
    .filter((t): t is Tender => !!t);
  const yes = tenders.filter(aiPrequalified).length;
  const dups = mail.filter((m) => m.kind === "duplicate").length;
  return (
    <p className="truncate text-xs text-muted-foreground">
      {mail.length} emails read · <b className="font-semibold text-foreground">{tenders.length} lead drafts</b> · {yes} pre-qualified ·{" "}
      {dups} already a lead
    </p>
  );
}

function MailRow({
  m,
  icon,
  note,
  time,
  onOpen,
}: {
  m: MailItem;
  icon: React.ReactNode;
  note: string;
  time: string;
  onOpen: (id: string) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<button onClick={() => onOpen(m.id)} />}
        className="flex w-full items-start gap-2.5 rounded-xl bg-muted/40 px-3 py-2.5 text-left text-xs transition-colors hover:bg-muted"
      >
        <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="min-w-0 truncate font-medium text-foreground">{m.subject}</span>
            <span className="ml-auto shrink-0 text-muted-foreground">{time}</span>
          </span>
          <span className="block truncate text-muted-foreground">{note}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" align="start" className="max-w-72 flex-col items-start gap-0.5 text-left">
        <span className="block font-semibold">{m.subject}</span>
        <span className="block opacity-80">
          {m.from} · {m.mailbox}
        </span>
        <span className="block opacity-80">{note}</span>
      </TooltipContent>
    </Tooltip>
  );
}

const DEADLINE_VERB: Record<TenderAction["kind"], string> = {
  "Submission deadline": "Submit",
  "Clarification deadline": "Questions",
  "Site visit": "Site visit",
  "Tender fee": "Pay fee",
  NDA: "Sign NDA",
};
