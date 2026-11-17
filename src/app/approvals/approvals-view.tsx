"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ArrowUpRight, CheckCircle2, Clock, Download, Inbox, Mail, X } from "lucide-react";
import { currentUser, useDemo } from "@/lib/store";
import { APPROVAL_STATUSES, IN_APPROVAL, aiPrequalified, prospectStatus } from "@/lib/scoring";
import { downloadCsv } from "@/lib/csv";
import { daysUntil, formatDate, formatDateTime, hoursLeft, timeAgo } from "@/lib/format";
import type { Tender } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AiSpark } from "@/components/ai-spark";
import { Button } from "@/components/ui/button";
import { FilterChips, FilterMenu, TableHeader, useTableFilters, type Facet } from "@/components/table-filters";
import { SortTh, compareBy, nextSort, type SortState } from "@/components/sort-header";
import { TablePagination, usePagination } from "@/components/table-pagination";
import { DecisionPanel } from "@/components/decision-panel";
import { openHodEmail } from "@/components/hod-email";
import { motion } from "motion/react";
import { D365, PageHeader, PrequalBadge, StatusBadge, boldD365 } from "@/components/shared";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { PEOPLE, SERVICE_LINES, serviceLineFor } from "@/lib/mock-data";

const PENDING: readonly Tender["status"][] = IN_APPROVAL;

/** "order" is the default: pending first by due date, then the latest decisions. */
type RegisterSort = "order" | "id" | "deadline" | "ai" | "ops" | "status" | "lead";

const STATUS_RANK: Tender["status"][] = ["BD Head review", "Awaiting HoD", "Opportunity created", "Rejected"];

/** The HoD's prequalification in a few words. */
function opsSummary(t: Tender): { text: string; tone: string } {
  const o = t.opsInput;
  if (!o) return { text: "Not asked", tone: "text-muted-foreground" };
  if (o.reply === "Interested") return { text: "Interested", tone: "text-emerald-700" };
  if (o.reply === "Not interested") return { text: "Not interested", tone: "text-rose-700" };
  if (t.status !== "Awaiting HoD") return { text: "No reply · BD Head decided", tone: "text-muted-foreground" };
  return new Date(o.dueAt).getTime() > Date.now()
    ? { text: `Awaiting · ${hoursLeft(o.dueAt)} h left`, tone: "text-amber-700" }
    : { text: "Overdue", tone: "text-orange-700" };
}

function registerValue(t: Tender, key: Exclude<RegisterSort, "order">): number | string {
  switch (key) {
    case "id":
      return t.id;
    case "deadline":
      return t.deadline;
    case "ai":
      return aiPrequalified(t) ? 1 : 0;
    case "ops":
      return opsSummary(t).text;
    case "status":
      return STATUS_RANK.indexOf(t.status);
    case "lead":
      return t.opportunity?.oppId ?? t.lead.leadId;
  }
}

export function ApprovalsView({ embedded = false }: { embedded?: boolean }) {
  const demo = useDemo()!;
  // Deep link to one lead: /approvals?id=TND-...
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // Mirror the open panel in the URL so returning from a prospect restores it.
  function syncUrl(id: string | null) {
    router.replace(id ? `${pathname}?id=${encodeURIComponent(id)}` : pathname, { scroll: false });
  }
  const [selectedId, setSelectedId] = useState<string | null>(params.get("id"));
  // Arrived by clicking "Review & decide" in VP Commercial's email.
  const [fromEmail, setFromEmail] = useState(params.get("via") === "email");
  // The prospect the email was about, highlighted in the list.
  const [focusId, setFocusId] = useState<string | null>(params.get("focus"));
  // Follow new deep links even when this page is already open.
  const linkKey = params.toString();
  const [seenLink, setSeenLink] = useState(linkKey);
  if (seenLink !== linkKey) {
    setSeenLink(linkKey);
    setSelectedId(params.get("id"));
    if (params.get("via") === "email") setFromEmail(true);
    if (params.get("focus")) setFocusId(params.get("focus"));
  }

  // The people who act here: the BD Head (VP Commercial) decides; an HoD answers the requests sent to them.
  const isHod = demo.role === "vp" || demo.role === "ops";
  const vp = currentUser(demo);
  const asHod = demo.role === "ops";
  // An HoD sees only the leads the BD Head asked them about; everyone else sees every lead in D365.
  const routed = demo.tenders.filter((t) => t.approval && (!asHod || t.opsInput?.person === vp.name));
  const myStatuses: Tender["status"][] = asHod ? ["Awaiting HoD"] : ["BD Head review"];
  const mine = routed;
  const notSubmitted = demo.tenders.filter((t) => t.status === "Draft").length;
  const myAwaiting = mine.filter((t) => myStatuses.includes(t.status)).length;
  const selected = demo.tenders.find((t) => t.id === selectedId);
  const focused = demo.tenders.find((t) => t.id === focusId);
  // This approver's queue, soonest due first, for "Review next".
  const myQueue = mine.filter((t) => myStatuses.includes(t.status)).sort((a, b) => a.deadline.localeCompare(b.deadline));
  const [view, setView] = useState<"register" | "tracker">("register");
  const hodRequests = routed.filter((t) => t.opsInput);
  const hodOpen = hodRequests.filter((t) => t.status === "Awaiting HoD").length;
  // Switch between the register of every lead in the chain and the tracker of HoD requests, in the table header.
  const tabs = (
    <div role="tablist" aria-label="View" className="flex flex-wrap gap-1.5">
      {(
        [
          ["register", "Approval register", routed.length],
          ["tracker", "HoD tracker", hodOpen],
        ] as const
      ).map(([k, label, n]) => (
        <button
          key={k}
          role="tab"
          aria-selected={view === k}
          onClick={() => setView(k)}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors",
            view === k
              ? "bg-primary text-primary-foreground ring-primary"
              : "bg-card text-muted-foreground ring-border hover:text-foreground",
          )}
        >
          {label}
          <span className={cn("tabular rounded-full px-1.5 text-[10px]", view === k ? "bg-white/20" : "bg-muted")}>
            {n}
            {k === "tracker" && " open"}
          </span>
        </button>
      ))}
    </div>
  );

  function open(id: string) {
    setSelectedId(id);
    syncUrl(id);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {!embedded && (
        <PageHeader
          title="Approval for Bidding"
          description={
            <>
              Each lead goes to the BD Head, who can ask the service line&apos;s HoD first (interested or not, 24 h). The BD Head&apos;s
              approval creates the <D365 /> opportunity.
            </>
          }
        />
      )}

      {isHod ? (
        // VP Commercial's view: every prospect sent for approval.
        <>
          <div className="flex shrink-0 items-center gap-3 border-b pb-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-pink-100 text-xs font-semibold text-pink-800">
              {vp.initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">Your approvals · {vp.name}</div>
              <div className="text-xs text-muted-foreground">{vp.title}</div>
            </div>
            {myAwaiting > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">{myAwaiting} for you</span>
            )}
          </div>
          {fromEmail && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex shrink-0 flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground shadow-soft"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary">
                <Mail className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-foreground">Welcome, {vp.name.split(" ")[0]}.</span>{" "}
                {focused ? (
                  <>
                    You opened <span className="font-semibold text-foreground">{focused.title}</span> from your email.
                  </>
                ) : (
                  "Signed in from your email."
                )}
              </span>
              {focused && PENDING.includes(focused.status) && (
                <Button size="lg" onClick={() => open(focused.id)}>
                  Review now <ArrowRight />
                </Button>
              )}
              <button
                onClick={() => setFromEmail(false)}
                aria-label="Dismiss"
                className="rounded-md p-1 hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </motion.div>
          )}
        </>
      ) : null}

      {view === "tracker" ? (
        <HodTracker tenders={hodRequests} onOpen={open} tabs={tabs} />
      ) : routed.length ? (
        <Register
          tenders={routed}
          onOpen={open}
          selectedId={selectedId}
          highlightId={fromEmail ? focusId : null}
          showHod
          mine={isHod ? myStatuses : undefined}
          tabs={tabs}
          notSubmitted={isHod ? undefined : notSubmitted}
        />
      ) : (
        <EmptyState text="No leads have been created in D365 yet." />
      )}

      <Sheet
        open={!!selected}
        onOpenChange={(o) => {
          if (o) return;
          setSelectedId(null);
          syncUrl(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl data-[side=right]:sm:max-w-xl">
          <SheetTitle className="sr-only">{selected?.title ?? "Prospect"}</SheetTitle>
          {selected && (
            <ReviewPanel
              tender={selected}
              isHod={isHod}
              next={myQueue.find((t) => t.id !== selected.id)}
              remaining={myQueue.filter((t) => t.id !== selected.id).length}
              onOpen={open}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

const DONE_LABEL: Partial<Record<Tender["status"], string>> = {
  "Opportunity created": "Opportunity created in D365",
  Rejected: "Rejected",
};

function ReviewPanel({
  tender,
  isHod,
  next,
  remaining,
  onOpen,
}: {
  tender: Tender;
  isHod: boolean;
  next?: Tender;
  remaining: number;
  onOpen: (id: string) => void;
}) {
  const done = isHod ? DONE_LABEL[tender.status] : undefined;
  return (
    <div className="space-y-7 p-7">
      {/* After VP Commercial decides: keep going through the queue without returning to the inbox. */}
      {done && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200 ring-inset"
        >
          <CheckCircle2 className="size-5 shrink-0 text-emerald-700" />
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-bold text-emerald-900">{boldD365(done)}</div>
            <div className="text-emerald-900/80">
              {tender.opportunity ? (
                <>
                  Opportunity <span className="font-mono font-semibold">{tender.opportunity.oppId}</span> handed to the bidding agent.
                </>
              ) : (
                <>
                  Lead <span className="font-mono font-semibold">{tender.lead.leadId}</span> {tender.lead.state.toLowerCase()} in <D365 />.
                </>
              )}
            </div>
            <div className="text-emerald-900/80">{remaining ? `${remaining} more waiting for you` : "You're all caught up."}</div>
          </div>
          {next && (
            <Button variant="success" size="lg" onClick={() => onOpen(next.id)}>
              Review next <ArrowRight />
            </Button>
          )}
        </motion.div>
      )}

      <div className="flex items-start gap-3 pr-8">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-bold tracking-tight text-primary">{tender.title}</h2>
          <div className="mt-1.5 text-sm text-muted-foreground">
            {tender.buyer} · {tender.emirate}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            <span className="font-mono">{tender.id}</span> · lead <span className="font-mono">{tender.lead.leadId}</span> ·{" "}
            {tender.category}
          </div>
        </div>
        <AiSpark label="AI pre-qualification">
          <span className="flex items-center gap-2 font-semibold">
            AI pre-qualification <PrequalBadge yes={aiPrequalified(tender)} />
          </span>
          <span className="block opacity-80">{tender.aiNarrative}</span>
        </AiSpark>
      </div>

      <Button
        variant="link"
        nativeButton={false}
        render={<Link href={`/opportunity?id=${encodeURIComponent(tender.id)}&from=approvals`} />}
      >
        Open full lead and AI reasoning <ArrowUpRight />
      </Button>

      <div className="rounded-xl bg-muted/30 p-5">
        <h3 className="mb-4 text-sm font-bold text-primary">Conflict check, then approval</h3>
        <DecisionPanel tender={tender} />
        {!isHod && PENDING.includes(tender.status) && (
          <Button variant="secondary" size="lg" className="mt-3 w-full" onClick={() => openHodEmail(tender.id)}>
            <Mail /> Preview email to {PEOPLE.vp.name}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Whether VP Commercial's final decision matches the AI's Yes / No. */
function agreesWithAi(t: Tender): boolean {
  return aiPrequalified(t) === (t.status === "Opportunity created");
}

function exportCsv(tenders: Tender[]) {
  const header = [
    "Tender ID",
    "Title",
    "Buyer",
    "Due date",
    "AI pre-qualification",
    "HoD",
    "HoD input",
    "Status",
    "Decided by",
    "Decided at",
    "Rationale",
    "D365 lead",
    "Lead state",
    "D365 opportunity",
    "Lead created by",
    "Note",
  ];
  const rows = tenders.map((t) => [
    t.id,
    t.title,
    t.buyer,
    t.deadline.slice(0, 10),
    aiPrequalified(t) ? "Yes" : "No",
    serviceLineFor(t.category).opsHead,
    opsSummary(t).text,
    prospectStatus(t.status),
    t.approval?.decidedBy ?? "",
    t.approval?.decidedAt ?? "",
    t.approval?.decisionComment ?? "",
    t.lead.leadId,
    t.lead.state,
    t.opportunity?.oppId ?? "",
    t.approval?.submittedBy ?? "",
    t.approval?.note ?? "",
  ]);
  downloadCsv("agfs-approval-register.csv", header, rows, "Register exported");
}

/** Pending first (soonest due date first), then decided (most recent first). */
function registerOrder(a: Tender, b: Tender) {
  const pa = PENDING.includes(a.status);
  const pb = PENDING.includes(b.status);
  if (pa !== pb) return pa ? -1 : 1;
  if (pa) return a.deadline.localeCompare(b.deadline);
  return (b.approval?.decidedAt ?? "").localeCompare(a.approval?.decidedAt ?? "");
}

/** Register of D365 leads: AI pre-qualification, HoD input, status, and the D365 lead or opportunity. */
function Register({
  tenders,
  onOpen,
  selectedId,
  highlightId,
  mine,
  notSubmitted,
  tabs,
}: {
  tenders: Tender[];
  onOpen: (id: string) => void;
  selectedId: string | null;
  /** A row to draw attention to, e.g. the prospect an email linked to. */
  highlightId?: string | null;
  showHod?: boolean;
  /** The signed-in approver's own step(s): those rows are marked "Your step". */
  mine?: Tender["status"][];
  tabs?: React.ReactNode;
  /** Drafts not yet created as leads; linked in the toolbar. */
  notSubmitted?: number;
}) {
  const [q, setQ] = useState("");
  const filters = useTableFilters();
  const facets: Facet[] = [
    // Only prospects sent for approval are listed here.
    { key: "status", label: "Status", options: APPROVAL_STATUSES },
    { key: "line", label: "Service line", options: SERVICE_LINES.map((l) => l.name) },
    { key: "ai", label: "AI pre-qual", options: ["Yes", "No"] },
  ];
  const [sort, setSort] = useState<SortState<RegisterSort>>({ key: "order", dir: "asc" });
  const onSort = (key: RegisterSort) => setSort((s) => nextSort(s, key, ["order", "id", "deadline", "ops", "status"]));

  const needle = q.trim().toLowerCase();
  const sorted = tenders
    .filter(
      (t) =>
        filters.matches("status", prospectStatus(t.status)) &&
        filters.matches("line", serviceLineFor(t.category).name) &&
        filters.matches("ai", aiPrequalified(t) ? "Yes" : "No") &&
        (!needle || `${t.id} ${t.lead.leadId} ${t.opportunity?.oppId ?? ""} ${t.title} ${t.buyer}`.toLowerCase().includes(needle)),
    )
    .sort((a, b) => {
      if (sort.key === "order") return sort.dir === "asc" ? registerOrder(a, b) : registerOrder(b, a);
      const key = sort.key;
      // Ties fall back to the default order so the list stays stable.
      return compareBy<Tender>(sort.dir, (t) => registerValue(t, key))(a, b) || registerOrder(a, b);
    });
  const pager = usePagination(sorted, `${q}|${filters.key}|${sort.key}|${sort.dir}`);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* The table fills the rest of the window and scrolls inside, with its headings pinned. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card shadow-soft in-data-step-section:rounded-none in-data-step-section:shadow-none">
        <TableHeader title="Approval register" count={sorted.length} search={q} onSearch={setQ} tabs={tabs}>
          {notSubmitted ? (
            <Link href="/inbox" className="px-1 text-xs text-muted-foreground hover:text-primary">
              {notSubmitted} draft{notSubmitted === 1 ? "" : "s"} still to review →
            </Link>
          ) : null}
          <FilterMenu facets={facets} filters={filters} />
          <Button size="lg" onClick={() => exportCsv(sorted)} disabled={!sorted.length}>
            Export CSV <Download />
          </Button>
        </TableHeader>
        <FilterChips facets={facets} filters={filters} />
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="sticky top-0 z-10 border-b bg-zinc-50 text-left text-xs text-muted-foreground">
              <tr>
                <SortTh sortKey="id" sort={sort} onSort={onSort} className="pl-5">
                  Tender no.
                </SortTh>
                <SortTh sortKey="order" sort={sort} onSort={onSort}>
                  Prospect
                </SortTh>
                <SortTh sortKey="deadline" sort={sort} onSort={onSort}>
                  Due date
                </SortTh>
                <SortTh sortKey="ai" sort={sort} onSort={onSort}>
                  AI pre-qual
                </SortTh>
                <SortTh sortKey="ops" sort={sort} onSort={onSort}>
                  HoD input
                </SortTh>
                <SortTh sortKey="status" sort={sort} onSort={onSort}>
                  Status
                </SortTh>
                <SortTh sortKey="lead" sort={sort} onSort={onSort} className="pr-5">
                  D365
                </SortTh>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pager.pageItems.map((t) => {
                const line = serviceLineFor(t.category);
                const pending = PENDING.includes(t.status);
                const days = daysUntil(t.deadline);
                const agrees = agreesWithAi(t);
                const ops = opsSummary(t);
                return (
                  <tr
                    key={t.id}
                    onClick={() => onOpen(t.id)}
                    className={cn(
                      "cursor-pointer align-top transition-colors hover:bg-muted/30",
                      PENDING.includes(t.status) && "bg-amber-50/40",
                      selectedId === t.id && "bg-primary/5",
                      highlightId === t.id &&
                        "bg-primary/[0.035] shadow-[inset_2px_0_0_color-mix(in_oklab,var(--primary)_55%,transparent)]",
                    )}
                  >
                    <td className="py-3 pr-3 pl-5 whitespace-nowrap">
                      <span className="font-mono text-xs text-muted-foreground">{t.id}</span>
                    </td>
                    <td className="max-w-[320px] px-3 py-3">
                      <div className="truncate font-medium">{t.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{t.buyer}</div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {formatDate(t.deadline)}
                      <div className={cn("text-xs", days <= 14 && days > 0 ? "text-orange-700" : "text-muted-foreground")}>
                        {days > 0 ? `${days} days left` : "Closed"}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <PrequalBadge yes={aiPrequalified(t)} />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={cn("text-sm", ops.tone)}>{ops.text}</span>
                      <div className="text-xs text-muted-foreground">
                        {line.opsHead} · {line.name}
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <StatusBadge status={t.status} />
                      <div className="mt-1.5 text-[11px] text-muted-foreground">
                        {mine?.includes(t.status) ? (
                          <span className="font-semibold text-primary">Your step</span>
                        ) : pending ? (
                          t.approval && `Lead created ${timeAgo(t.approval.submittedAt).toLowerCase()}`
                        ) : (
                          <span className={cn("font-medium", !agrees && "text-magenta")}>
                            {agrees ? "Matches AI" : "Overrides AI"}
                            {t.approval?.decidedAt && (
                              <span className="font-normal text-muted-foreground"> · {formatDate(t.approval.decidedAt)}</span>
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 pr-5 whitespace-nowrap">
                      {t.opportunity ? (
                        <>
                          <span className="font-mono text-xs font-medium text-emerald-700">{t.opportunity.oppId}</span>
                          <div className="text-xs text-muted-foreground">Opportunity · from {t.lead.leadId}</div>
                        </>
                      ) : (
                        <>
                          <span className="font-mono text-xs font-medium text-teal-700">{t.lead.leadId}</span>
                          <div className="text-xs text-muted-foreground">Lead · {t.lead.state}</div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    No prospects match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination {...pager} overall={tenders.length} />
      </div>
    </div>
  );
}

/**
 * Tracker of HoD requests (workshop: "Tracker / Status / Response of HoDs"): who was asked, when it is due against the
 * 24-hour SLA, the reply, reminders, and where the lead is now. Open requests first, soonest due first.
 */
function HodTracker({ tenders, onOpen, tabs }: { tenders: Tender[]; onOpen: (id: string) => void; tabs: React.ReactNode }) {
  const rows = [...tenders].sort((a, b) => {
    const oa = a.status === "Awaiting HoD";
    const ob = b.status === "Awaiting HoD";
    if (oa !== ob) return oa ? -1 : 1;
    return oa ? a.opsInput!.dueAt.localeCompare(b.opsInput!.dueAt) : b.opsInput!.askedAt.localeCompare(a.opsInput!.askedAt);
  });
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card shadow-soft in-data-step-section:rounded-none in-data-step-section:shadow-none">
      <div className="flex min-h-[65px] shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-5">
        {tabs}
        <span className="text-xs text-muted-foreground sm:ml-auto">
          Interested or not within 24 h · overdue requests escalate to the BD Head
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="sticky top-0 z-10 border-b bg-zinc-50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-3 pr-3 pl-5 font-medium">HoD</th>
              <th className="px-3 py-3 font-medium">Lead</th>
              <th className="px-3 py-3 font-medium">Asked</th>
              <th className="px-3 py-3 font-medium">24 h SLA</th>
              <th className="px-3 py-3 font-medium">Response</th>
              <th className="px-3 py-3 font-medium">Reminders</th>
              <th className="px-3 py-3 pr-5 font-medium">Now with</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((t) => {
              const o = t.opsInput!;
              const open = t.status === "Awaiting HoD";
              const left = hoursLeft(o.dueAt);
              const ops = opsSummary(t);
              return (
                <tr
                  key={t.id}
                  onClick={() => onOpen(t.id)}
                  className={cn("cursor-pointer align-top transition-colors hover:bg-muted/30", open && "bg-amber-50/40")}
                >
                  <td className="py-3 pr-3 pl-5 whitespace-nowrap">
                    <div className="font-medium">{o.person}</div>
                    <div className="text-xs text-muted-foreground">{o.line}</div>
                  </td>
                  <td className="max-w-[300px] px-3 py-3">
                    <div className="truncate font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{t.lead.leadId}</span> · {t.buyer}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(o.askedAt)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {open ? (
                      left > 0 ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
                          <Clock className="size-3.5" /> {left} h left
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-orange-700">Overdue · reminded</span>
                      )
                    ) : o.repliedAt ? (
                      <span className={cn("text-xs", new Date(o.repliedAt) <= new Date(o.dueAt) ? "text-emerald-700" : "text-orange-700")}>
                        {new Date(o.repliedAt) <= new Date(o.dueAt) ? "Within SLA" : "Late"}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Missed</span>
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className={cn("text-sm", ops.tone)}>{ops.text}</span>
                    <div className="text-xs text-muted-foreground">{o.reply ? "Logged in D365" : ""}</div>
                  </td>
                  <td className="tabular px-3 py-3 text-xs">{o.remindersSent}</td>
                  <td className="px-3 py-3 pr-5 whitespace-nowrap">
                    <StatusBadge status={t.status} />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-sm text-muted-foreground">
                  No HoD requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card py-16 text-center">
      <Inbox className="size-8 text-muted-foreground/60" />
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
