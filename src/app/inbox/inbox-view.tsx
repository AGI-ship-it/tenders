"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, ArrowRight, Check, Copy, Inbox, Loader2, Mail, MailX, Paperclip, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { clearPendingScan, peekPendingScan, useDemo } from "@/lib/store";
import { buildMailbox, mailboxFor, shortMailbox, type MailItem } from "@/lib/mailbox";
import { aiPrequalified, fitScore } from "@/lib/scoring";
import { daysUntil, formatAED, formatDate, formatTime, isToday } from "@/lib/format";
import type { MailboxConnection, Tender, TenderAction } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PrequalBadge, boldD365 } from "@/components/shared";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { EmailView, MailboxTag } from "@/components/email-view";
import { MailboxOnboarding } from "@/components/mailbox-connect";

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
  const workflow = {
    phase,
    step,
    sorted,
    mail,
    addresses,
    tenderOf,
    toConfirm: demo.tenders.filter((t) => t.status === "Draft").length,
    toApprove: demo.tenders.filter((t) => t.status === "Awaiting HoD" || t.status === "BD Head review" || t.status === "Bid Head approval")
      .length,
  };

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
      <header className="shrink-0 border-b px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Mail className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-primary">
                {phase === "running" ? "AI is reading the mailbox…" : "Tenders found in the mailbox"}
              </h2>
              <p className="truncate text-xs text-muted-foreground">Outlook · {addresses.join(" · ")}</p>
            </div>
          </div>
          {phase === "running" ? (
            <span className="tabular text-xs text-muted-foreground">{progress}%</span>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="lg" nativeButton={false} render={<Link href="/settings" />}>
                <Mail /> Emails · {addresses.length} connected
              </Button>
              <Button size="lg" onClick={() => start()}>
                <Sparkles /> Run again
              </Button>
            </div>
          )}
        </div>
        {phase === "running" && (
          <>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-linear-to-r from-primary to-magenta"
                animate={{ width: `${progress}%` }}
                transition={{ ease: "easeOut", duration: 0.4 }}
              />
            </div>
          </>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <WorkflowPanel {...workflow} />
          <div className="min-w-0">
            {phase === "running" ? (
              <SortingBoard mail={mail} sorted={sorted} step={step} tenderOf={tenderOf} ticker={ticker} />
            ) : (
              <Results mail={mail} addresses={addresses} tenderOf={tenderOf} onOpen={setOpenId} />
            )}
          </div>
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t bg-muted/30 px-6 py-3">
        {phase === "done" ? (
          <Button variant="secondary" size="lg" className="ml-auto" nativeButton={false} render={<Link href="/lead" />}>
            Next: Review drafts <ArrowRight />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="lg"
            className="ml-auto"
            onClick={() => {
              clearTimers();
              setPhase("done");
            }}
          >
            Skip to results
          </Button>
        )}
      </footer>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent
          // Return focus to the row only when closed from the keyboard, so a mouse close leaves no focus ring behind.
          finalFocus={(closeType) => closeType === "keyboard"}
          className="w-full overflow-hidden p-0 sm:max-w-3xl data-[side=right]:sm:max-w-3xl"
        >
          <SheetTitle className="sr-only">{open?.subject ?? "Email"}</SheetTitle>
          {open && <EmailView m={open} t={tenderOf(open)} className="h-full" />}
        </SheetContent>
      </Sheet>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The workflow: the AI's automated steps, then the decisions people make

type RowState = "done" | "running" | "queued";

function WorkflowPanel({
  phase,
  step,
  sorted,
  mail,
  addresses,
  tenderOf,
  toConfirm,
  toApprove,
}: {
  phase: "running" | "done";
  step: number;
  sorted: number;
  mail: MailItem[];
  addresses: string[];
  tenderOf: (m: MailItem) => Tender | undefined;
  toConfirm: number;
  toApprove: number;
}) {
  const tenders = mail.filter(isTenderMail);
  const files = tenders.reduce((n, m) => n + m.attachments.length, 0);
  const dups = mail.filter((m) => m.kind === "duplicate").length;
  const yes = tenders.filter((m) => {
    const t = tenderOf(m);
    return t && aiPrequalified(t);
  }).length;
  const results: Record<StepKey, string> = {
    read: `${mail.length} new emails · ${addresses.map(shortMailbox).join(", ")}`,
    sort: `${tenders.length} tenders · ${dups} already a lead`,
    files: files ? `${files} attachments read` : "No attachments",
    extract: `Details extracted from ${tenders.length} tenders`,
    match: dups ? `${dups} linked to an existing lead` : "No duplicates",
    lead: `${tenders.length} drafts ready to review`,
    prequal: `${yes} pre-qualified · ${tenders.length - yes} not`,
  };
  const stateOf = (i: number): RowState => (phase === "done" || i < step ? "done" : i === step ? "running" : "queued");
  const aiDone = phase === "done";
  const aiRows = STEPS.map((s, i) => {
    const st = stateOf(i);
    const detail =
      st === "done"
        ? results[s.key]
        : st === "running" && s.key === "sort"
          ? `Sorting ${Math.min(sorted, mail.length)} of ${mail.length} emails…`
          : st === "running"
            ? s.hint
            : "";
    return <WorkflowRow key={s.key} compact state={st} title={s.label} detail={detail} last={false} kind="ai" />;
  });

  return (
    <section aria-label="Progress" className="self-start rounded-2xl bg-card p-4 ring-1 ring-border xl:sticky xl:top-0">
      <h3 className="text-sm font-bold text-primary">Where things stand</h3>
      <ol className="mt-3">
        {/* While the AI runs, its steps show live; once done they fold into one line. */}
        {aiDone ? (
          <WorkflowRow
            compact
            kind="ai"
            state="done"
            title="AI checked your emails"
            detail={`Found ${tenders.length} tenders · ${yes} look like a fit`}
            last={false}
          />
        ) : (
          aiRows
        )}
        <WorkflowRow
          compact
          kind="human"
          state={aiDone ? (toConfirm ? "running" : "done") : "queued"}
          title={aiDone && toConfirm ? "Your turn: create the leads" : "You create the leads"}
          detail={
            aiDone
              ? toConfirm
                ? `${toConfirm} ${toConfirm === 1 ? "draft" : "drafts"} to check`
                : "All done"
              : "Next, you check each draft"
          }
          href={aiDone && toConfirm ? "/lead" : undefined}
          last={false}
        />
        <WorkflowRow
          compact
          kind="human"
          state={aiDone && toApprove ? "running" : "queued"}
          title="Managers approve"
          detail={
            aiDone && toApprove
              ? `${toApprove} ${toApprove === 1 ? "lead" : "leads"} with HoD, BD Head or Bid Head`
              : "HoD, then BD Head, then Bid Head"
          }
          last
        />
      </ol>
    </section>
  );
}

function WorkflowRow({
  compact,
  state,
  title,
  detail,
  kind,
  who,
  href,
  last,
}: {
  /** In the narrow rail: the icon shows the state, so no status badge. */
  compact?: boolean;
  state: RowState;
  title: string;
  detail: string;
  kind: "ai" | "human";
  who?: string;
  href?: string;
  last: boolean;
}) {
  const human = kind === "human";
  const badge =
    state === "done"
      ? { text: "Done", cls: "bg-emerald-50 text-emerald-700" }
      : state === "running"
        ? human
          ? {
              text: who?.includes("you") ? "Your turn" : "Waiting",
              cls: "bg-amber-50 text-amber-800",
            }
          : { text: "Running", cls: "bg-primary/10 text-primary" }
        : { text: "Queued", cls: "bg-muted text-muted-foreground" };
  const body = (
    <>
      <span className="relative flex flex-col items-center">
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full",
            state === "done" && "bg-emerald-50 text-emerald-700",
            state === "running" && (human ? "bg-amber-50 text-amber-700 ring-2 ring-amber-300" : "bg-primary/10 text-primary"),
            state === "queued" && "bg-muted text-muted-foreground",
          )}
        >
          {state === "done" ? (
            <Check className="size-3.5" />
          ) : human ? (
            <UserRound className="size-3.5" />
          ) : state === "running" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <span className="size-2 rounded-full bg-current opacity-50" />
          )}
        </span>
        {!last && <span className={cn("mt-1 w-px flex-1", state === "done" ? "bg-emerald-200" : "bg-border")} />}
      </span>
      <span className="min-w-0 flex-1 pb-2.5">
        <span className="flex items-start gap-2">
          <span className={cn("min-w-0 flex-1 text-[13px] leading-tight font-semibold", state === "queued" && "text-muted-foreground")}>
            {title}
            {who && <span className="block text-[11px] font-medium text-amber-800">{who}</span>}
          </span>
          {!compact && <span className={cn("shrink-0 rounded-full px-2 py-px text-[10px] font-semibold", badge.cls)}>{badge.text}</span>}
        </span>
        <AnimatePresence mode="wait" initial={false}>
          {detail && (
            <motion.span
              key={detail}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn("mt-0.5 block text-[11px] leading-snug", state === "done" ? "text-foreground/80" : "text-muted-foreground")}
            >
              {detail}
              {href && <ArrowRight className="ml-1 inline size-3 text-primary" />}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="-mx-1.5 flex gap-2.5 rounded-lg px-1.5 pt-1 transition-colors hover:bg-amber-50/60">
          {body}
        </Link>
      ) : (
        <div className="flex gap-2.5 pt-1">{body}</div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// The live sorting board

function SortingBoard({
  mail,
  sorted,
  step,
  tenderOf,
  ticker,
}: {
  mail: MailItem[];
  sorted: number;
  step: number;
  tenderOf: (m: MailItem) => Tender | undefined;
  ticker: string;
}) {
  const reduce = useReducedMotion();
  const incoming = mail.slice(sorted);
  const done = mail.slice(0, sorted);
  const lane = (f: (m: MailItem) => boolean) => done.filter(f).reverse();
  const reading = step === at("read") || step === at("sort");

  return (
    <div className="dot-wave -m-3 space-y-4 rounded-2xl p-3">
      <LayoutGroup>
        <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)_220px]">
          {/* Incoming */}
          <Lane title="Incoming" count={incoming.length} icon={<Inbox className="size-3.5" />}>
            {incoming.map((m, i) =>
              i === 0 && reading && !reduce ? (
                <ReadingCard key={m.id} m={m} />
              ) : (
                <motion.div
                  key={m.id}
                  layoutId={m.id}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  // The queue behind the email being read sits back a little.
                  style={{ opacity: reading ? Math.max(0.45, 1 - i * 0.12) : 1 }}
                  className="relative shrink-0 overflow-hidden rounded-lg bg-card px-3 py-2 text-xs ring-1 ring-border"
                >
                  <MailLines m={m} />
                </motion.div>
              ),
            )}
            {incoming.length === 0 && <EmptyLane text="All emails sorted" />}
          </Lane>

          {/* Tenders → lead drafts */}
          <Lane title="Tenders → lead drafts" count={lane(isTenderMail).length} icon={<Sparkles className="size-3.5" />} tone="primary">
            {lane(isTenderMail).map((m) => (
              <TenderCard key={m.id} m={m} t={tenderOf(m)!} step={step} />
            ))}
            {lane(isTenderMail).length === 0 && <EmptyLane text="Tenders land here" />}
          </Lane>

          {/* Already a lead / not tenders */}
          <div className="space-y-4">
            <Lane title="Already a lead" count={lane((m) => m.kind === "duplicate").length} icon={<Copy className="size-3.5" />}>
              {lane((m) => m.kind === "duplicate").map((m) => (
                <motion.div
                  key={m.id}
                  layoutId={m.id}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="rounded-lg bg-card px-3 py-2 text-xs ring-1 ring-border"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate font-medium">{m.subject}</span>
                    <MailboxTag address={m.mailbox} />
                  </div>
                  <div className="text-muted-foreground">
                    {step >= at("match") ? (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        Linked to <span className="font-mono font-medium text-teal-700">{tenderOf(m)?.lead.leadId}</span>
                      </motion.span>
                    ) : (
                      "Checking tender no.…"
                    )}
                  </div>
                </motion.div>
              ))}
            </Lane>
            {/* Everyday mail is set aside quietly: it is not the focus. */}
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] text-muted-foreground border border-dashed">
              <MailX className="size-3.5" /> Set aside · not tenders
              <span className="tabular ml-auto">{lane((m) => m.kind === "other").length}</span>
            </div>
          </div>
        </div>
      </LayoutGroup>

      {/* What the agent is doing right now */}
      <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 font-mono text-[11px] text-muted-foreground">
        <span className="text-primary/70">›</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={ticker}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="truncate"
          >
            {ticker}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

function MailLines({ m }: { m: MailItem }) {
  return (
    <>
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate font-medium">{m.from}</span>
        {m.attachments.length > 0 && <Paperclip className="size-3 shrink-0 text-muted-foreground" />}
        <MailboxTag address={m.mailbox} />
      </div>
      <div className="truncate text-muted-foreground">{m.subject}</div>
    </>
  );
}

/**
 * The email the AI is reading right now: a rotating gradient border, a scan beam sweeping down with a bright leading
 * edge, a shimmer across the text, and an "AI reading" line.
 */
function ReadingCard({ m }: { m: MailItem }) {
  return (
    <motion.div
      layoutId={m.id}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="relative z-10 shrink-0 overflow-hidden rounded-lg p-px text-xs shadow-soft"
    >
      {/* Rotating gradient border */}
      <motion.span
        aria-hidden
        className="absolute top-1/2 left-1/2 aspect-square w-[260%] -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(from_0deg,transparent_0deg,color-mix(in_oklch,var(--primary)_45%,transparent)_70deg,color-mix(in_oklch,var(--magenta)_40%,transparent)_130deg,transparent_190deg)]"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
      />
      <div className="relative overflow-hidden rounded-[7px] bg-card px-3 py-2">
        {/* Scan beam: a soft glow trailing a bright edge */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 h-10"
          initial={{ top: "-45%" }}
          animate={{ top: "105%" }}
          transition={{ duration: 0.9, repeat: Infinity, ease: [0.4, 0, 0.6, 1] }}
        >
          <span className="absolute inset-0 bg-linear-to-b from-transparent to-primary/6" />
          <span className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-magenta/45 to-transparent" />
        </motion.span>
        <div className="relative">
          <MailLines m={m} />
          {/* Shimmer across the text */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-white/40 to-transparent"
            initial={{ left: "-40%" }}
            animate={{ left: "120%" }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.2 }}
          />
        </div>
        <div className="relative mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-primary">
          <motion.span animate={{ rotate: [0, 20, -10, 0], scale: [1, 1.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
            <Sparkles className="size-3" />
          </motion.span>
          AI reading
          <span className="flex gap-0.5">
            {[0, 1, 2].map((d) => (
              <motion.span
                key={d}
                className="size-1 rounded-full bg-primary"
                animate={{ opacity: [0.2, 1, 0.2], y: [0, -2, 0] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
              />
            ))}
          </span>
          {m.attachments.length > 0 && (
            <span className="ml-auto flex items-center gap-0.5 font-medium text-muted-foreground">
              <Paperclip className="size-2.5" /> {m.attachments.length}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Lane({
  title,
  count,
  icon,
  tone,
  children,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  tone?: "primary";
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-2 rounded-2xl p-3",
        tone === "primary" ? "bg-secondary/50 ring-1 ring-primary/15" : "bg-muted/30 ring-1 ring-border",
      )}
    >
      <h3 className={cn("flex items-center gap-1.5 text-xs font-bold", tone === "primary" ? "text-primary" : "text-foreground")}>
        {icon} {title}
        <span className="tabular ml-auto rounded-full bg-card px-2 py-px text-[11px] ring-1 ring-border">{count}</span>
      </h3>
      <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto p-0.5 *:shrink-0">{children}</div>
    </section>
  );
}

function EmptyLane({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed px-3 py-4 text-center text-[11px] text-muted-foreground">{text}</p>;
}

/** A tender as it moves through the run: details pop in, then the lead number and the AI pre-qualification. */
function TenderCard({ m, t, step }: { m: MailItem; t: Tender; step: number }) {
  const fee = t.actions.find((a) => a.kind === "Tender fee");
  const chips = [
    t.buyer.split(" ").slice(0, 3).join(" "),
    `Closes ${formatDate(t.deadline)}`,
    t.category,
    ...(fee?.amountAED ? [`Fee ${formatAED(fee.amountAED, false)}`] : []),
    ...(t.actions.some((a) => a.kind === "NDA") ? ["NDA"] : []),
    ...(t.actions.some((a) => a.kind === "Site visit") ? ["Site visit"] : []),
  ];
  return (
    <motion.div
      layoutId={m.id}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="rounded-xl bg-card p-3 text-xs ring-1 ring-border"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{t.title}</div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="min-w-0 truncate">{m.from}</span>
            <MailboxTag address={m.mailbox} />
          </div>
        </div>
        <AnimatePresence>
          {step >= at("lead") && (
            <motion.span
              initial={{ scale: 2, opacity: 0, rotate: -12 }}
              animate={{ scale: 1, opacity: 1, rotate: -4 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
              className="shrink-0 rounded-md border-2 border-sky-600/70 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-sky-700 uppercase"
            >
              Draft
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {m.kind === "possible" && (
        <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-px text-[10px] font-semibold text-amber-800">
          <AlertTriangle className="size-3" /> Possible tender · flagged for you to check
        </div>
      )}

      {m.attachments.length > 0 && step === at("files") && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-primary">
          <Paperclip className="size-3 animate-pulse" /> Reading {m.attachments[0].name}…
        </div>
      )}

      {step >= at("extract") && (
        <div className="mt-2 flex flex-wrap gap-1">
          {chips.map((c, i) => (
            <motion.span
              key={c}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.12 }}
              className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
            >
              {c}
            </motion.span>
          ))}
        </div>
      )}

      {step >= at("prequal") && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"
        >
          AI pre-qual <PrequalBadge yes={aiPrequalified(t)} />
        </motion.div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Results

function Results({
  mail: allMail,
  addresses,
  tenderOf,
  onOpen,
}: {
  mail: MailItem[];
  addresses: string[];
  tenderOf: (m: MailItem) => Tender | undefined;
  onOpen: (id: string) => void;
}) {
  // With several mailboxes connected, show them all or one at a time.
  const [box, setBox] = useState<string | null>(null);
  const shown = box && addresses.includes(box) ? box : null;
  const mail = shown ? allMail.filter((m) => m.mailbox === shown) : allMail;
  const tenderMail = mail.filter(isTenderMail);
  const dupMail = mail.filter((m) => m.kind === "duplicate");
  const when = (iso: string) => (isToday(iso) ? formatTime(iso) : formatDate(iso));
  const leads = [...tenderMail].sort((a, b) => fitScore(tenderOf(b)!) - fitScore(tenderOf(a)!));
  return (
    <div className="space-y-6">
      {/* Mailbox tabs on the left, the run in numbers on one line on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {addresses.length > 1 ? (
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
        ) : (
          <span />
        )}
        <RunKpis mail={mail} tenderMail={tenderMail} dupMail={dupMail} tenderOf={tenderOf} />
      </div>

      <div className="space-y-6">
        <section className="space-y-2">
          <h3 className="text-xs font-bold tracking-wide text-foreground uppercase">Lead drafts · to review and push to D365</h3>
          {leads.length === 0 && <EmptyLane text="No new tenders in the mailbox." />}
          <div className="grid gap-2.5 2xl:grid-cols-2">
            {leads.map((m, i) => {
              const t = tenderOf(m)!;
              const confirmed = t.status !== "Draft";
              const dismissed = t.status === "Not a tender";
              return (
                <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                  {/* Two lines: the tender and its pre-qual, then where it came from and the next action. Click opens the email. */}
                  <div className="group flex items-center gap-4 rounded-xl bg-card px-4 py-2.5 ring-1 ring-border transition-all hover:shadow-soft-lg hover:ring-primary/30">
                    <button onClick={() => onOpen(m.id)} title="See email & extracted details" className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{t.title}</span>
                        {m.kind === "possible" && !confirmed && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-50 px-1.5 py-px text-[10px] font-semibold text-amber-800">
                            <AlertTriangle className="size-3" /> Please check
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex min-w-0 items-center gap-x-1.5 text-[11px] whitespace-nowrap text-muted-foreground">
                        <MailboxTag address={m.mailbox} />
                        {confirmed && !dismissed ? (
                          <span className="font-mono font-medium text-teal-700">{t.lead.leadId}</span>
                        ) : (
                          <span className="font-semibold text-sky-700">{dismissed ? "Not a tender" : "Draft"}</span>
                        )}
                        <span>·</span>
                        <span className="truncate">{t.buyer}</span>
                        <span>·</span>
                        <span className="truncate">from {m.from}</span>
                        <span>·</span>
                        <NextDeadline t={t} />
                      </div>
                    </button>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        Pre-qual <PrequalBadge yes={aiPrequalified(t)} />
                      </span>
                      {dismissed ? (
                        <span className="text-xs font-medium text-muted-foreground">Dismissed · no lead</span>
                      ) : confirmed ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <Check className="size-3.5" /> Lead created in D365
                        </span>
                      ) : (
                        <Link
                          href={`/lead?id=${encodeURIComponent(t.id)}`}
                          className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          Review & create lead <ArrowRight className="size-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="space-y-5">
          {dupMail.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold tracking-wide text-foreground uppercase">Already a lead</h3>
              {dupMail.map((m) => (
                <MailRow
                  key={m.id}
                  m={m}
                  icon={<Copy className="size-3.5" />}
                  note={`Linked to ${tenderOf(m)?.lead.leadId}, no second lead`}
                  time={when(m.at)}
                  onOpen={onOpen}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** The run in numbers, on one line: drafts (with the way to review them), emails read, already a lead. */
function RunKpis({
  mail,
  tenderMail,
  dupMail,
  tenderOf,
}: {
  mail: MailItem[];
  tenderMail: MailItem[];
  dupMail: MailItem[];
  tenderOf: (m: MailItem) => Tender | undefined;
}) {
  const tenders = tenderMail.map(tenderOf).filter((t): t is Tender => !!t);
  const yes = tenders.filter(aiPrequalified).length;
  const toReview = tenders.filter((t) => t.status === "Draft").length;
  const stat = (n: number, label: string) => (
    <span className="whitespace-nowrap">
      <b className="tabular text-sm font-extrabold text-foreground">{n}</b> {label}
    </span>
  );
  return (
    <dl className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="whitespace-nowrap">
        <b className="tabular text-sm font-extrabold text-primary">{tenderMail.length}</b>{" "}
        <span className="font-semibold text-primary">lead drafts</span> · {yes} pre-qualified
      </span>
      <span aria-hidden className="text-border">
        |
      </span>
      {stat(mail.length, "emails read")}
      <span aria-hidden className="text-border">
        |
      </span>
      {stat(dupMail.length, "already a lead")}
      {toReview > 0 && (
        <Link
          href="/lead"
          className="ml-1 flex items-center gap-1 rounded-full bg-linear-to-r from-primary to-magenta px-3 py-1 text-xs font-semibold text-primary-foreground shadow-soft hover:opacity-90"
        >
          Review {toReview} <ArrowRight className="size-3.5" />
        </Link>
      )}
    </dl>
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
    <button
      onClick={() => onOpen(m.id)}
      className="flex w-full items-start gap-2.5 rounded-xl bg-muted/40 px-3 py-2.5 text-left text-xs transition-colors hover:bg-muted"
    >
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium text-foreground">{m.subject}</span>
          <MailboxTag address={m.mailbox} />
          <span className="ml-auto shrink-0 text-muted-foreground">{time}</span>
        </span>
        <span className="block truncate text-muted-foreground">
          {m.from} · {note}
        </span>
      </span>
    </button>
  );
}

const DEADLINE_VERB: Record<TenderAction["kind"], string> = {
  "Submission deadline": "Submit",
  "Clarification deadline": "Questions",
  "Site visit": "Site visit",
  "Tender fee": "Pay fee",
  NDA: "Sign NDA",
};

/** The soonest date the AI found in the tender (fee, site visit, questions, submission), plus how many tasks there are in all. */
function NextDeadline({ t }: { t: Tender }) {
  const next = t.actions.filter((a) => a.due && daysUntil(a.due) >= 0).sort((a, b) => a.due!.localeCompare(b.due!))[0];
  const tasks = `${t.actions.length} ${t.actions.length === 1 ? "task" : "tasks"}`;
  if (!next) return <span className="shrink-0">{tasks}</span>;
  const days = daysUntil(next.due!);
  const date = new Date(next.due!).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return (
    <span className="shrink-0" title={`${next.label} · ${formatDate(next.due!)}`}>
      <span className={cn("font-semibold", days <= 7 ? "text-amber-700" : "text-foreground")}>
        {DEADLINE_VERB[next.kind]} by {date}
        {days <= 7 && ` · ${days === 0 ? "today" : `${days}d left`}`}
      </span>{" "}
      · {tasks}
    </span>
  );
}
